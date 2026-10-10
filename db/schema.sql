-- Everything about corridors, stops, segments and routes lives in these tables.
-- Nothing about "which route is fastest" is hardcoded in JavaScript — it's all
-- data here, editable through the admin API, and combined with live Google
-- Maps estimates at request time.

CREATE TABLE IF NOT EXISTS corridors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS stops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  corridor_id INTEGER NOT NULL REFERENCES corridors(id),
  name TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL
);

-- A segment is one leg of a journey: walk, auto, bus, shuttle or train
-- between two stops.
--   dynamic = 1  -> duration is fetched live from Google Maps (walk/auto legs)
--   dynamic = 0  -> duration is admin-curated, because no live feed exists
--                   for this corridor's buses/shuttles/trains yet
CREATE TABLE IF NOT EXISTS segments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  corridor_id INTEGER NOT NULL REFERENCES corridors(id),
  mode TEXT NOT NULL CHECK(mode IN ('walk','auto','bus','shuttle','train')),
  from_stop_id INTEGER NOT NULL REFERENCES stops(id),
  to_stop_id INTEGER NOT NULL REFERENCES stops(id),
  dynamic INTEGER NOT NULL DEFAULT 0,
  duration_min INTEGER,            -- used when dynamic = 0
  scheduled_times TEXT,            -- JSON array of "HH:MM" departures, e.g. bus/shuttle/train
  reliability_note TEXT,
  last_updated_by TEXT,
  last_updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- A named, ordered chain of segments between an origin stop and a
-- destination stop. A single origin/destination pair can have several
-- competing routes (e.g. train route vs shuttle route) — the search
-- endpoint returns all of them, ranked by total time.
CREATE TABLE IF NOT EXISTS routes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  corridor_id INTEGER NOT NULL REFERENCES corridors(id),
  name TEXT NOT NULL,
  origin_stop_id INTEGER NOT NULL REFERENCES stops(id),
  dest_stop_id INTEGER NOT NULL REFERENCES stops(id),
  note TEXT
);

CREATE TABLE IF NOT EXISTS route_segments (
  route_id INTEGER NOT NULL REFERENCES routes(id),
  segment_id INTEGER NOT NULL REFERENCES segments(id),
  position INTEGER NOT NULL,
  PRIMARY KEY (route_id, position)
);

-- Event log: this is what turns into your engagement / referral / retention
-- numbers from the high-fidelity test.
CREATE TABLE IF NOT EXISTS route_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  route_id INTEGER REFERENCES routes(id),
  origin_stop_id INTEGER,
  dest_stop_id INTEGER,
  depart_at TEXT,
  baseline_min INTEGER,
  computed_total_min INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  route_request_id INTEGER NOT NULL REFERENCES route_requests(id),
  accurate INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,     -- 'visit' | 'search' | 'save' | 'feedback'
  meta TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
