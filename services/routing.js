const db = require('../db/database');
const { getDuration } = require('./googleMaps');

const MODE_LABELS = {
  walk: 'Walk',
  auto: 'Auto',
  bus: 'City bus',
  shuttle: 'Shuttle',
  train: 'Train'
};

function nextDeparture(scheduledTimesJson, departAt) {
  if (!scheduledTimesJson) return null;
  const times = JSON.parse(scheduledTimesJson); // ["07:50","08:20",...]
  const [dh, dm] = departAt.split(':').map(Number);
  const departMinutes = dh * 60 + dm;

  for (const t of times) {
    const [h, m] = t.split(':').map(Number);
    const minutes = h * 60 + m;
    if (minutes >= departMinutes) {
      return { time: t, waitMin: minutes - departMinutes };
    }
  }
  // nothing left today — first departure tomorrow
  return { time: times[0], waitMin: null, nextDay: true };
}

async function resolveSegment(segment, stopsById, clockMinutes) {
  const from = stopsById.get(segment.from_stop_id);
  const to = stopsById.get(segment.to_stop_id);

  if (segment.dynamic) {
    const { minutes, source } = await getDuration(from, to, segment.mode);
    return {
      mode: MODE_LABELS[segment.mode],
      from: from.name,
      to: to.name,
      duration_min: minutes,
      wait_min: 0,
      note: source === 'google-maps' ? null : 'Estimated — live traffic data not available',
      live: source === 'google-maps'
    };
  }

  // Fixed-schedule leg: bus/shuttle/train
  const departAtStr = clockMinutes;
  const dep = nextDeparture(segment.scheduled_times, departAtStr);
  const waitMin = dep?.waitMin ?? 0;

  return {
    mode: MODE_LABELS[segment.mode],
    from: from.name,
    to: to.name,
    duration_min: segment.duration_min,
    wait_min: dep?.nextDay ? null : waitMin,
    departs_at: dep?.time ?? null,
    note: segment.reliability_note,
    live: false
  };
}

async function searchRoutes({ originStopId, destStopId, departAt, baselineMin }) {
  const routes = db.prepare(`
    SELECT * FROM routes WHERE origin_stop_id = ? AND dest_stop_id = ?
  `).all(originStopId, destStopId);

  if (!routes.length) return [];

  const allStops = db.prepare(`SELECT * FROM stops`).all();
  const stopsById = new Map(allStops.map(s => [s.id, s]));

  const results = [];

  for (const route of routes) {
    const segRows = db.prepare(`
      SELECT s.* FROM route_segments rs
      JOIN segments s ON s.id = rs.segment_id
      WHERE rs.route_id = ?
      ORDER BY rs.position ASC
    `).all(route.id);

    const legs = [];
    for (const seg of segRows) {
      const leg = await resolveSegment(seg, stopsById, departAt);
      legs.push(leg);
    }

    const totalMin = legs.reduce((sum, l) => sum + l.duration_min + (l.wait_min || 0), 0);

    results.push({
      route_id: route.id,
      name: route.name,
      note: route.note,
      total_min: totalMin,
      legs
    });
  }

  results.sort((a, b) => a.total_min - b.total_min);

  // Log the request against the fastest route for metrics purposes.
  const best = results[0];
  const insertReq = db.prepare(`
    INSERT INTO route_requests (route_id, origin_stop_id, dest_stop_id, depart_at, baseline_min, computed_total_min)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const requestId = insertReq.run(
    best.route_id, originStopId, destStopId, departAt, baselineMin ?? null, best.total_min
  ).lastInsertRowid;

  return { requestId, routes: results };
}

module.exports = { searchRoutes };
