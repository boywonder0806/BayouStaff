import { Router } from 'express';
import axios from 'axios';
import pool from '../db/index.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

const API_KEY  = process.env.TOMORROW_API_KEY;
const LOCATION = process.env.TOMORROW_LOCATION || '70810';

const ALERT_RADIUS_KM  = 12.87; // 8 miles
const ALL_CLEAR_MS     = 30 * 60 * 1000; // 30 minutes
const POLL_INTERVAL_MS = 3 * 60 * 1000;  // 3 minutes (free tier: 500 calls/day)

// ── DB migration ─────────────────────────────────────────────────────────────
pool.query(`
  CREATE TABLE IF NOT EXISTS lightning_events (
    id          SERIAL PRIMARY KEY,
    event_type  TEXT NOT NULL,
    distance_mi NUMERIC,
    actor_id    INT REFERENCES employees(id) ON DELETE SET NULL,
    note        TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(() => {});

// ── In-memory state ───────────────────────────────────────────────────────────
let state = {
  alertActive:    false,
  lastStrikeAt:   null,   // ISO string of last strike within range
  allClearAt:     null,   // ISO string when 30-min window completed
  lastPollAt:     null,
  distanceMi:     null,
  overrideActive: false,  // manager forced an alert manually
  error:          null,
};

// ── Tomorrow.io poll ──────────────────────────────────────────────────────────
async function pollTomorrow() {
  try {
    const { data } = await axios.get('https://api.tomorrow.io/v4/weather/realtime', {
      params: {
        location: LOCATION,
        fields:   'lightningDistance,weatherCode',
        units:    'metric',
        apikey:   API_KEY,
      },
      timeout: 10000,
    });

    const values   = data?.data?.values ?? {};
    const distKm   = values.lightningDistance ?? null;
    const distMi   = distKm != null ? Math.round(distKm * 0.621371 * 10) / 10 : null;
    const withinRange = distKm != null && distKm <= ALERT_RADIUS_KM;
    const now = new Date();

    state.lastPollAt = now.toISOString();
    state.distanceMi = distMi;
    state.error      = null;

    if (state.overrideActive) return; // manual override takes precedence

    if (withinRange) {
      const wasAlreadyActive = state.alertActive;
      state.alertActive  = true;
      state.lastStrikeAt = now.toISOString();
      state.allClearAt   = null;

      if (!wasAlreadyActive) {
        await pool.query(
          `INSERT INTO lightning_events (event_type, distance_mi) VALUES ('alert_triggered', $1)`,
          [distMi]
        ).catch(() => {});
      }
    } else if (state.alertActive) {
      // Strike has moved out of range — start/check the 30-min window
      const lastStrike = state.lastStrikeAt ? new Date(state.lastStrikeAt) : null;
      const clearable  = lastStrike && (now - lastStrike) >= ALL_CLEAR_MS;

      if (clearable) {
        state.alertActive = false;
        state.allClearAt  = now.toISOString();
        await pool.query(
          `INSERT INTO lightning_events (event_type) VALUES ('all_clear')`
        ).catch(() => {});
      }
      // else: still in the 30-min hold window, keep alertActive = true
    }
  } catch (err) {
    state.error = err.message ?? 'Failed to reach weather service';
  }
}

// Kick off polling loop
pollTomorrow();
setInterval(pollTomorrow, POLL_INTERVAL_MS);

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/lightning/status — current alert state (all authenticated users)
router.get('/status', requireAuth, (_req, res) => {
  const now = new Date();
  let minutesUntilClear = null;

  if (state.alertActive && state.lastStrikeAt && !state.overrideActive) {
    const elapsed = now - new Date(state.lastStrikeAt);
    const remaining = ALL_CLEAR_MS - elapsed;
    minutesUntilClear = remaining > 0 ? Math.ceil(remaining / 60000) : 0;
  }

  res.json({
    alertActive:      state.alertActive || state.overrideActive,
    overrideActive:   state.overrideActive,
    distanceMi:       state.distanceMi,
    lastStrikeAt:     state.lastStrikeAt,
    allClearAt:       state.allClearAt,
    lastPollAt:       state.lastPollAt,
    minutesUntilClear,
    error:            state.error,
  });
});

// GET /api/lightning/log — recent events (all authenticated users)
router.get('/log', requireAuth, async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT le.id, le.event_type AS "eventType", le.distance_mi AS "distanceMi",
             le.note, le.created_at AS "createdAt",
             e.name AS "actorName"
      FROM lightning_events le
      LEFT JOIN employees e ON le.actor_id = e.id
      ORDER BY le.created_at DESC
      LIMIT 50
    `);
    res.json({ events: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/lightning/override — manager manually triggers or clears alert
router.post('/override', requireAdmin, async (req, res) => {
  const { active, note } = req.body;

  state.overrideActive = !!active;

  if (active) {
    state.alertActive  = true;
    state.lastStrikeAt = new Date().toISOString();
    state.allClearAt   = null;
    await pool.query(
      `INSERT INTO lightning_events (event_type, actor_id, note) VALUES ('manual_alert', $1, $2)`,
      [req.user.id, note || null]
    ).catch(() => {});
  } else {
    state.alertActive    = false;
    state.overrideActive = false;
    state.allClearAt     = new Date().toISOString();
    await pool.query(
      `INSERT INTO lightning_events (event_type, actor_id, note) VALUES ('manual_clear', $1, $2)`,
      [req.user.id, note || null]
    ).catch(() => {});
  }

  res.json({ ok: true });
});

// POST /api/lightning/poll-now — force an immediate poll (admin only, for testing)
router.post('/poll-now', requireAdmin, async (_req, res) => {
  await pollTomorrow();
  res.json({ ok: true, state });
});

export default router;
