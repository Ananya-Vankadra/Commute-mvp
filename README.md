# Commute MVP — Benz Circle → Gannavaram

A real backend + database version of the multi-modal commute planner:
one corridor, no hardcoded routing logic, live-ish walk/auto times via
Google Maps, and a reactive vanilla-JS frontend (no framework, no page
reloads).

## What's actually "live" here

- **Walk and auto legs** — fetched from the Google Maps Directions API if
  you add a key (see below). Without a key, the app falls back to a
  straight-line-distance estimate so it still runs end to end.
- **Bus / shuttle / train legs** — no public live-GPS feed exists for
  this corridor, so these come from the database, editable through the
  admin panel at any time. This mirrors how a real pilot would run: you
  (or a teammate) update the numbers by hand as you learn the corridor.

Nothing about which route is fastest is written in JavaScript — it's all
rows in `db/commute.db`, seeded once from `db/seed.js`.

## Setup

```bash
npm install
cp .env.example .env      # optional — see below
npm run seed               # creates db/commute.db and fills the corridor data
npm start                  # http://localhost:3000
```

Open **http://localhost:3000** for the rider view, and
**http://localhost:3000/admin.html** for the admin panel.

### Adding a Google Maps key (optional but recommended)

1. Go to console.cloud.google.com, create a project, enable "Directions API"
2. Create an API key
3. Paste it into `.env` as `GOOGLE_MAPS_API_KEY=...`
4. Restart the server (`npm start`)

The free tier comfortably covers a pilot with a few dozen testers. Without
a key, walk/auto times are estimated from straight-line distance instead
of real traffic — still usable for testing the product, just less
accurate.

## Project structure

```
server.js              Express app entry point
db/schema.sql           Table definitions
db/seed.js               One-time corridor data (edit this to add stops/routes)
db/database.js           SQLite connection
services/googleMaps.js   Live duration lookups, with fallback
services/routing.js      Combines DB segments + live legs into ranked routes
routes/api.js             Rider-facing endpoints
routes/admin.js            Admin endpoints (no auth yet — see note below)
public/index.html, app.js, styles.css   Rider frontend
public/admin.html, admin.js              Admin frontend
```

## Adding a new origin/destination or corridor

Everything lives in `db/seed.js`. Add a new `stop(...)` call for a place,
new `seg(...)` calls for the legs between stops, and a `route(...)` call
combining them into a named route. Re-run `npm run seed` (this wipes and
rebuilds the database — fine for a pilot, not something you'd do once
real user data matters).

To edit timings and notes without touching code, use the admin panel —
that's what it's for.

## Known limitations (intentional, for a Phase 1 pilot)

- **No authentication** — matches the roadmap's "no auth" pilot phase.
  Add a login check to `routes/admin.js` before this goes anywhere public.
- **One corridor only** — the frontend loads whichever corridor comes
  back first from `/api/corridors`.
- **SQLite** — fine for a 30–50 person pilot, not for real concurrent
  scale. See the stack comparison doc for when to move to Postgres.
- **Routes are hand-curated, not auto-generated** — the app doesn't
  invent a walk+train+auto combination on its own; someone has to define
  that combination once in `seed.js` or (eventually) an admin route
  builder. This was a deliberate scope decision, not an oversight — see
  the routing-engine architecture notes from earlier.
