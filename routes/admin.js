// No auth in Phase 1, matching the roadmap ("no auth" for the pilot admin
// panel). Add a login check here before this ever goes on the public internet.

const express = require('express');
const db = require('../db/database');

const router = express.Router();

router.get('/segments', (req, res) => {
  const rows = db.prepare(`
    SELECT s.*, f.name AS from_name, t.name AS to_name
    FROM segments s
    JOIN stops f ON f.id = s.from_stop_id
    JOIN stops t ON t.id = s.to_stop_id
    WHERE s.corridor_id = ?
    ORDER BY s.id
  `).all(req.query.corridor_id);
  res.json(rows);
});

router.put('/segments/:id', (req, res) => {
  const { duration_min, scheduled_times, reliability_note, last_updated_by } = req.body;
  db.prepare(`
    UPDATE segments
    SET duration_min = COALESCE(?, duration_min),
        scheduled_times = COALESCE(?, scheduled_times),
        reliability_note = COALESCE(?, reliability_note),
        last_updated_by = ?,
        last_updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    duration_min ?? null,
    scheduled_times ? JSON.stringify(scheduled_times) : null,
    reliability_note ?? null,
    last_updated_by ?? 'admin',
    req.params.id
  );
  res.json({ ok: true });
});

router.get('/metrics', (req, res) => {
  const visits = db.prepare(`SELECT COUNT(*) n FROM events WHERE type = 'visit'`).get().n;
  const searches = db.prepare(`SELECT COUNT(*) n FROM events WHERE type = 'search'`).get().n;
  const saves = db.prepare(`SELECT COUNT(*) n FROM events WHERE type = 'save'`).get().n;
  const feedbackRows = db.prepare(`SELECT accurate, COUNT(*) n FROM feedback GROUP BY accurate`).all();
  const accurate = feedbackRows.find(r => r.accurate === 1)?.n || 0;
  const inaccurate = feedbackRows.find(r => r.accurate === 0)?.n || 0;

  const avgSavings = db.prepare(`
    SELECT AVG(baseline_min - computed_total_min) avg_saved
    FROM route_requests
    WHERE baseline_min IS NOT NULL
  `).get().avg_saved;

  res.json({
    visits, searches, saves,
    feedback: { accurate, inaccurate },
    avg_minutes_saved: avgSavings ? Math.round(avgSavings) : null
  });
});

module.exports = router;
