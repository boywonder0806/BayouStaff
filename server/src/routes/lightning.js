import { Router } from 'express';
import axios from 'axios';
import pool from '../db/index.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

const API_KEY  = process.env.TOMORROW_API_KEY;
const LOCATION = process.env.TOMORROW_LOCATION || '70810';
// Lat/lon for NOAA point lookup — defaults to 70810 (East Baton Rouge)
const LAT = parseFloat(process.env.TOMORROW_LAT || '30.3600');
const LON = parseFloat(process.env.TOMORROW_LON || '-91.0823');

const ALERT_RADIUS_KM  = 12.87; // 8 miles
const ALL_CLEAR_MS     = 30 * 60 * 1000;
const POLL_INTERVAL_MS = 3 * 60 * 1000;  // Tomorrow.io: every 3 min
const NOAA_INTERVAL_MS = 5 * 60 * 1000;  // NOAA: every 5 min

// Tomorrow.io weather code for thunderstorm
const THUNDERSTORM_CODE = 8000;

// NOAA alert event types that indicate active lightning risk
const LIGHTNING_EVENTS = new Set([
  'Severe Thunderstorm Warning',
  'Tornado Warning',
  'Thunderstorm Warning',
  'Severe Thunderstorm Watch',
]);

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
  lastStrikeAt:   null,
  allClearAt:     null,
  lastPollAt:     null,
  distanceMi:     null,
  overrideActive: false,
  alertSource:    null,   // 'tomorrow_distance' | 'tomorrow_code' | 'noaa'
  noaaAlertType:  null,
  weatherCode:    null,
  error:          null,
};

// ── NOAA zone resolution (run once on startup) ────────────────────────────────
let noaaZone = null;

async function resolveNoaaZone() {
  try {
    const { data } = await axios.get(
      `https://api.weather.gov/points/${LAT},${LON}`,
      { headers: { 'User-Agent': 'BayouStaffApp/1.0 (bluebayoustaff.com)' }, timeout: 10000 }
    );
    noaaZone = data?.properties?.forecastZone?.split('/').pop() ?? null;
  } catch {
    noaaZone = null;
  }
}

// ── NOAA alert state ──────────────────────────────────────────────────────────
let noaaAlertActive = false;
let noaaAlertType   = null;

async function pollNoaa() {
  try {
    const url = noaaZone
      ? `https://api.weather.gov/alerts/active?zone=${noaaZone}`
      : `https://api.weather.gov/alerts/active?point=${LAT},${LON}`;

    const { data } = await axios.get(url, {
      headers: { 'User-Agent': 'BayouStaffApp/1.0 (bluebayoustaff.com)' },
      timeout: 10000,
    });

    const match = (data?.features ?? []).find(f =>
      LIGHTNING_EVENTS.has(f?.properties?.event)
    );
    noaaAlertActive = !!match;
    noaaAlertType   = match?.properties?.event ?? null;
  } catch {
    // Keep last known NOAA state on transient error
  }
}

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

    const values      = data?.data?.values ?? {};
    const distKm      = values.lightningDistance ?? null;
    const weatherCode = values.weatherCode ?? null;
    const distMi      = distKm != null ? Math.round(distKm * 0.621371 * 10) / 10 : null;

    // Lightning is in range if: paid distance field says so, OR thunderstorm code, OR NOAA alert
    const distanceHit     = distKm != null && distKm <= ALERT_RADIUS_KM;
    const thunderstormHit = weatherCode === THUNDERSTORM_CODE;
    const withinRange     = distanceHit || thunderstormHit || noaaAlertActive;

    const alertSource = distanceHit     ? 'tomorrow_distance'
                      : thunderstormHit ? 'tomorrow_code'
                      : noaaAlertActive ? 'noaa'
                      : null;

    const now = new Date();
    state.lastPollAt  = now.toISOString();
    state.distanceMi  = distMi;
    state.weatherCode = weatherCode;
    state.noaaAlertType = noaaAlertType;
    state.error       = null;

    if (state.overrideActive) return;

    if (withinRange) {
      const wasAlreadyActive = state.alertActive;
      state.alertActive  = true;
      state.lastStrikeAt = now.toISOString();
      state.allClearAt   = null;
      state.alertSource  = alertSource;

      if (!wasAlreadyActive) {
        await pool.query(
          `INSERT INTO lightning_events (event_type, distance_mi, note) VALUES ('alert_triggered', $1, $2)`,
          [distMi, alertSource]
        ).catch(() => {});
      }
    } else if (state.alertActive) {
      const lastStrike = state.lastStrikeAt ? new Date(state.lastStrikeAt) : null;
      const clearable  = lastStrike && (now - lastStrike) >= ALL_CLEAR_MS;

      if (clearable) {
        state.alertActive = false;
        state.allClearAt  = now.toISOString();
        state.alertSource = null;
        await pool.query(
          `INSERT INTO lightning_events (event_type) VALUES ('all_clear')`
        ).catch(() => {});
      }
    }
  } catch (err) {
    state.error = err.message ?? 'Failed to reach weather service';
  }
}

// ── Startup ───────────────────────────────────────────────────────────────────
resolveNoaaZone().then(() => {
  pollNoaa();
  pollTomorrow();
});

setInterval(pollNoaa,     NOAA_INTERVAL_MS);
setInterval(pollTomorrow, POLL_INTERVAL_MS);

// ── Routes ────────────────────────────────────────────────────────────────────
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
    alertSource:      state.alertSource,
    noaaAlertType:    state.noaaAlertType,
    weatherCode:      state.weatherCode,
    error:            state.error,
  });
});

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

router.post('/override', requireAdmin, async (req, res) => {
  const { active, note } = req.body;
  state.overrideActive = !!active;

  if (active) {
    state.alertActive  = true;
    state.lastStrikeAt = new Date().toISOString();
    state.allClearAt   = null;
    state.alertSource  = 'manual';
    await pool.query(
      `INSERT INTO lightning_events (event_type, actor_id, note) VALUES ('manual_alert', $1, $2)`,
      [req.user.id, note || null]
    ).catch(() => {});
  } else {
    state.alertActive    = false;
    state.overrideActive = false;
    state.allClearAt     = new Date().toISOString();
    state.alertSource    = null;
    await pool.query(
      `INSERT INTO lightning_events (event_type, actor_id, note) VALUES ('manual_clear', $1, $2)`,
      [req.user.id, note || null]
    ).catch(() => {});
  }

  res.json({ ok: true });
});

router.post('/poll-now', requireAdmin, async (_req, res) => {
  await Promise.all([pollNoaa(), pollTomorrow()]);
  res.json({ ok: true, state, noaaZone });
});

export default router;
