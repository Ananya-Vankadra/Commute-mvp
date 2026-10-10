// Run with: npm run seed
//
// This populates one corridor the way an admin would use the admin panel —
// it's real-world reference data (stop locations, timetables), not routing
// logic. Delete db/commute.db and re-run this any time to reset the pilot.

const db = require('./database');

const insertCorridor = db.prepare(`INSERT INTO corridors (name, city) VALUES (?, ?)`);
const insertStop = db.prepare(`INSERT INTO stops (corridor_id, name, lat, lng) VALUES (?, ?, ?, ?)`);
const insertSegment = db.prepare(`
  INSERT INTO segments (corridor_id, mode, from_stop_id, to_stop_id, dynamic, duration_min, scheduled_times, reliability_note, last_updated_by)
  VALUES (@corridor_id, @mode, @from_stop_id, @to_stop_id, @dynamic, @duration_min, @scheduled_times, @reliability_note, @last_updated_by)
`);
const insertRoute = db.prepare(`
  INSERT INTO routes (corridor_id, name, origin_stop_id, dest_stop_id, note) VALUES (?, ?, ?, ?, ?)
`);
const insertRouteSegment = db.prepare(`
  INSERT INTO route_segments (route_id, segment_id, position) VALUES (?, ?, ?)
`);

const reset = db.transaction(() => {
db.exec(`
  DELETE FROM feedback;
  DELETE FROM route_requests;
  DELETE FROM route_segments;
  DELETE FROM routes;
  DELETE FROM segments;
  DELETE FROM stops;
  DELETE FROM corridors;
  DELETE FROM events;
`);

  const corridorId = insertCorridor.run('Benz Circle – Gannavaram', 'Vijayawada').lastInsertRowid;

  // Real-ish coordinates for the named places along this corridor.
  const stop = (name, lat, lng) => insertStop.run(corridorId, name, lat, lng).lastInsertRowid;

  const benzCircle   = stop('Benz Circle', 16.5062, 80.6480);
  const patamata     = stop('Patamata', 16.5100, 80.6360);
  const governorpet  = stop('Governorpet', 16.5158, 80.6209);
  const benzBay      = stop('Benz Circle Bus Bay', 16.5058, 80.6489);
  const gvmStation   = stop('Gannavaram Railway Station', 16.5440, 80.8020);
  const itPark       = stop('Gannavaram IT Park', 16.5310, 80.7990);
  const airport      = stop('Gannavaram Airport', 16.5304, 80.7963);

  const seg = (mode, from, to, dynamic, duration_min, scheduled_times, note) =>
    insertSegment.run({
      corridor_id: corridorId,
      mode, from_stop_id: from, to_stop_id: to,
      dynamic: dynamic ? 1 : 0,
      duration_min: duration_min ?? null,
      scheduled_times: scheduled_times ? JSON.stringify(scheduled_times) : null,
      reliability_note: note ?? null,
      last_updated_by: 'seed'
    }).lastInsertRowid;

  // Walk/auto legs are "dynamic" — duration is fetched live from Google Maps
  // (or the haversine fallback) at request time, not stored here.
  const walkToBay     = seg('walk', benzCircle, benzBay, true, null, null, null);
  const walkFromPat    = seg('walk', patamata, benzBay, true, null, null, null);
  const autoFromGovt   = seg('auto', governorpet, benzCircle, true, null, null, 'Autos scarce before 7:30am');
  const autoStationToPark = seg('auto', gvmStation, itPark, true, null, null, null);
  const autoStationToAirport = seg('auto', benzBay, airport, true, null, null, null);
  const itParkGate = stop('IT Park Gate', 16.5312, 80.7992);
  const walkGateToBlock = seg('walk', itParkGate, itPark, true, null, null, null);
  // Bus/shuttle/train legs are admin-curated — no live GPS feed exists yet,
  // so these are the numbers someone on the ground updates by hand.
  const busRoute301   = seg('bus', benzBay, itPark, false, 44, ['07:50','08:20','08:50'], 'Usually 6–8 min late at Benz Circle');
  const shuttleITPark = seg('shuttle', benzBay, itPark, false, 38, ['08:15'], 'Seats fill by 8:05');
  const trainPassenger = seg('train', benzBay, gvmStation, false, 26, ['08:05'], 'Only worth it for the 8:05 departure');

  // Routes: named, ordered chains of segments for an origin/destination pair.
  const route = (name, origin, dest, note, segmentIds) => {
    const routeId = insertRoute.run(corridorId, name, origin, dest, note).lastInsertRowid;
    segmentIds.forEach((segId, i) => insertRouteSegment.run(routeId, segId, i));
    return routeId;
  };

  // Benz Circle -> IT Park
  route('Train + auto', benzCircle, itPark, 'Fastest when you catch the 8:05',
    [walkToBay, trainPassenger, autoStationToPark]);
  route('Direct shuttle', benzCircle, itPark, 'No transfer, but seats fill early',
    [walkToBay, shuttleITPark]);
  route('City bus 301', benzCircle, itPark, 'Cheapest, runs every 30 min',
    [walkToBay, busRoute301]);

  // Patamata -> IT Park
  route('Train + auto', patamata, itPark, 'Fastest when you catch the 8:05',
    [walkFromPat, trainPassenger, autoStationToPark]);
  route('Direct shuttle', patamata, itPark, 'No transfer, but seats fill early',
    [walkFromPat, shuttleITPark]);

  // Governorpet -> IT Park
  route('Auto + train + auto', governorpet, itPark, 'Best option from Governorpet',
    [autoFromGovt, walkToBay, trainPassenger, autoStationToPark]);
  route('Auto + bus 301', governorpet, itPark, 'Simpler, one fewer transfer',
    [autoFromGovt, walkToBay, busRoute301]);

  // Benz Circle -> Airport
  route('Direct auto', benzCircle, airport, 'Best with luggage',
    [walkToBay, autoStationToAirport]);

  console.log('Seeded corridor:', corridorId);
});

reset();
console.log('Done. Run `npm start` to boot the server.');
