const express = require('express');
const db = require('../db/database');
const { searchRoutes } = require('../services/routing');

const router = express.Router();

function logEvent(type, meta) {
  db.prepare(`INSERT INTO events (type, meta) VALUES (?, ?)`)
    .run(type, meta ? JSON.stringify(meta) : null);
}

router.get('/corridors', (req, res) => {
  const corridors = db.prepare(`SELECT id, name, city FROM corridors WHERE active = 1`).all();
  res.json(corridors);
});

router.get('/corridors/:id/stops', (req, res) => {
  const stops = db.prepare(`SELECT id, name, lat, lng FROM stops WHERE corridor_id = ?`)
    .all(req.params.id);
  res.json(stops);
});

router.post('/routes/search', async (req, res) => {
  const { origin_stop_id, dest_stop_id, depart_at, baseline_min } = req.body;

  if (!origin_stop_id || !dest_stop_id || !depart_at) {
    return res.status(400).json({ error: 'origin_stop_id, dest_stop_id and depart_at are required' });
  }
  if (origin_stop_id === dest_stop_id) {
    return res.status(400).json({ error: 'Origin and destination must be different stops' });
  }

  try {
    const result = await searchRoutes({
      originStopId: origin_stop_id,
      destStopId: dest_stop_id,
      departAt: depart_at,
      baselineMin: baseline_min
    });

    logEvent('search', { origin_stop_id, dest_stop_id, depart_at });

    if (!result.routes || !result.routes.length) {
      return res.status(404).json({ error: 'No known route between these stops yet. Add one in the admin panel.' });
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not compute a route right now.' });
  }
});

router.post('/feedback', (req, res) => {
  const { request_id, accurate } = req.body;
  if (!request_id || typeof accurate !== 'boolean') {
    return res.status(400).json({ error: 'request_id and accurate (boolean) are required' });
  }
  db.prepare(`INSERT INTO feedback (route_request_id, accurate) VALUES (?, ?)`)
    .run(request_id, accurate ? 1 : 0);
  logEvent('feedback', { request_id, accurate });
  res.json({ ok: true });
});

router.post('/events', (req, res) => {
  const { type, meta } = req.body;
  if (!type) return res.status(400).json({ error: 'type is required' });
  logEvent(type, meta);
  res.json({ ok: true });
});

module.exports = router;
