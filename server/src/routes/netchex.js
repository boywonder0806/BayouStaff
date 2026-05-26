import { Router } from 'express';
import pool from '../db/index.js';
import { requireAdmin } from '../middleware/auth.js';
import { parseNetchexPdf } from '../lib/netchexParser.js';

const router = Router();

// ── Ensure tables exist ─────────────────────────────────────────────────────
async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS netchex_imports (
      id             SERIAL PRIMARY KEY,
      source_file_name TEXT NOT NULL,
      date_range_start DATE NOT NULL,
      date_range_end   DATE NOT NULL,
      imported_at      TIMESTAMPTZ DEFAULT NOW(),
      status           TEXT CHECK (status IN ('confirmed','failed')) DEFAULT 'confirmed',
      shift_count      INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS netchex_shifts (
      id                SERIAL PRIMARY KEY,
      import_id         INTEGER NOT NULL REFERENCES netchex_imports(id) ON DELETE CASCADE,
      employee_name     TEXT NOT NULL,
      employee_id       INTEGER REFERENCES employees(id),
      shift_date        DATE NOT NULL,
      start_time        TIME NOT NULL,
      end_time          TIME NOT NULL,
      department_label  TEXT NOT NULL,
      source_confidence TEXT CHECK (source_confidence IN ('high','medium','low')) DEFAULT 'medium',
      source_notes      TEXT
    );
    CREATE TABLE IF NOT EXISTS netchex_daily_plans (
      id                 SERIAL PRIMARY KEY,
      department         TEXT NOT NULL,
      plan_date          DATE NOT NULL,
      positions_snapshot JSONB NOT NULL DEFAULT '[]',
      UNIQUE(department, plan_date)
    );
    CREATE TABLE IF NOT EXISTS netchex_assignments (
      id               SERIAL PRIMARY KEY,
      daily_plan_id    INTEGER NOT NULL REFERENCES netchex_daily_plans(id) ON DELETE CASCADE,
      netchex_shift_id INTEGER NOT NULL REFERENCES netchex_shifts(id) ON DELETE CASCADE,
      position_key     TEXT NOT NULL,
      sort_order       INTEGER DEFAULT 0,
      notes            TEXT,
      UNIQUE(daily_plan_id, netchex_shift_id)
    );
  `);
}

ensureTables().catch(err => console.error('Netchex table init failed:', err.message));

// ── POST /api/netchex/parse  ─────────────────────────────────────────────────
// Accepts raw PDF bytes, returns parsed draft (does NOT save to DB)
router.post('/parse', requireAdmin, async (req, res) => {
  try {
    const fileName = req.headers['x-file-name'] ?? 'schedule.pdf';
    const bytes    = req.body; // Buffer from express.raw()

    if (!bytes || bytes.length === 0) return res.status(400).json({ error: 'No PDF data received.' });
    if (bytes.length > 8 * 1024 * 1024) return res.status(413).json({ error: 'PDF too large (max 8 MB).' });
    if (bytes.subarray(0, 5).toString('utf8') !== '%PDF-') return res.status(415).json({ error: 'File must be a PDF.' });

    const draft = await parseNetchexPdf(bytes, fileName);

    if (draft.shifts.length === 0 && draft.dateRangeStart === '') {
      return res.status(422).json({ error: 'PDF could not be parsed as a Netchex schedule.', warnings: draft.warnings });
    }

    res.json(draft);
  } catch (err) {
    console.error('PDF parse error:', err);
    res.status(422).json({ error: 'PDF could not be parsed.', detail: err.message });
  }
});

// ── POST /api/netchex/import/confirm  ────────────────────────────────────────
// Saves a reviewed draft to the database
router.post('/import/confirm', requireAdmin, async (req, res) => {
  const { sourceFileName, dateRangeStart, dateRangeEnd, shifts } = req.body;
  if (!shifts?.length) return res.status(400).json({ error: 'No shifts to confirm.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [imp] } = await client.query(
      `INSERT INTO netchex_imports (source_file_name, date_range_start, date_range_end, shift_count)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [sourceFileName, dateRangeStart, dateRangeEnd, shifts.length]
    );

    for (const s of shifts) {
      // Try to match employee by name
      const { rows: [emp] } = await client.query(
        `SELECT id FROM employees WHERE LOWER(name) = LOWER($1) LIMIT 1`,
        [s.employeeName]
      );
      await client.query(
        `INSERT INTO netchex_shifts
           (import_id, employee_name, employee_id, shift_date, start_time, end_time, department_label, source_confidence, source_notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [imp.id, s.employeeName, emp?.id ?? null, s.shiftDate, s.startTime, s.endTime,
         s.departmentLabel, s.sourceConfidence ?? 'medium', s.sourceNotes ?? null]
      );
    }

    await client.query('COMMIT');
    res.json({ importId: imp.id, shiftCount: shifts.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Confirm import error:', err);
    res.status(500).json({ error: 'Failed to save import.' });
  } finally {
    client.release();
  }
});

// ── GET /api/netchex/imports  ────────────────────────────────────────────────
router.get('/imports', requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, source_file_name AS "sourceFileName", date_range_start AS "dateRangeStart",
              date_range_end AS "dateRangeEnd", imported_at AS "importedAt",
              status, shift_count AS "shiftCount"
       FROM netchex_imports ORDER BY imported_at DESC`
    );
    res.json({ imports: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch imports.' });
  }
});

// ── GET /api/netchex/imports/:id  ────────────────────────────────────────────
router.get('/imports/:id', requireAdmin, async (req, res) => {
  try {
    const { rows: [imp] } = await pool.query(
      `SELECT id, source_file_name AS "sourceFileName", date_range_start AS "dateRangeStart",
              date_range_end AS "dateRangeEnd", imported_at AS "importedAt", status, shift_count AS "shiftCount"
       FROM netchex_imports WHERE id = $1`, [req.params.id]
    );
    if (!imp) return res.status(404).json({ error: 'Import not found.' });

    const { rows: shifts } = await pool.query(
      `SELECT id, employee_name AS "employeeName", employee_id AS "employeeId",
              shift_date AS "shiftDate", start_time AS "startTime", end_time AS "endTime",
              department_label AS "departmentLabel", source_confidence AS "sourceConfidence", source_notes AS "sourceNotes"
       FROM netchex_shifts WHERE import_id = $1 ORDER BY shift_date, start_time`, [req.params.id]
    );
    res.json({ ...imp, shifts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch import.' });
  }
});

// ── GET /api/netchex/board?dept=X&date=YYYY-MM-DD  ──────────────────────────
// Returns positions + shifts + assignments for a dept+date combo
router.get('/board', requireAdmin, async (req, res) => {
  const { dept, date } = req.query;
  if (!dept || !date) return res.status(400).json({ error: 'dept and date are required.' });

  try {
    // Positions from department_roles
    const { rows: positions } = await pool.query(
      `SELECT id, name, min_count AS "minCount", max_count AS "maxCount", description
       FROM department_roles WHERE department = $1 AND type = 'position' ORDER BY name`, [dept]
    );

    // Netchex shifts for dept+date
    const { rows: shifts } = await pool.query(
      `SELECT ns.id, ns.employee_name AS "employeeName", ns.employee_id AS "employeeId",
              ns.shift_date AS "shiftDate", ns.start_time AS "startTime", ns.end_time AS "endTime",
              ns.department_label AS "departmentLabel"
       FROM netchex_shifts ns
       JOIN netchex_imports ni ON ni.id = ns.import_id
       WHERE ns.shift_date = $1
         AND LOWER(ns.department_label) ILIKE $2
         AND ni.status = 'confirmed'
       ORDER BY ns.start_time`, [date, `%${dept.toLowerCase()}%`]
    );

    // Existing daily plan
    const { rows: [plan] } = await pool.query(
      `SELECT id, positions_snapshot AS "positionsSnapshot"
       FROM netchex_daily_plans WHERE department = $1 AND plan_date = $2`, [dept, date]
    );

    // Assignments for this plan
    let assignments = [];
    if (plan) {
      const { rows } = await pool.query(
        `SELECT id, netchex_shift_id AS "shiftId", position_key AS "positionKey",
                sort_order AS "sortOrder", notes
         FROM netchex_assignments WHERE daily_plan_id = $1`, [plan.id]
      );
      assignments = rows;
    }

    res.json({ positions, shifts, assignments, planId: plan?.id ?? null });
  } catch (err) {
    console.error('Board fetch error:', err);
    res.status(500).json({ error: 'Failed to load board data.' });
  }
});

// ── POST /api/netchex/board/save  ────────────────────────────────────────────
// Saves assignments for a dept+date (upserts daily plan + replaces assignments)
router.post('/board/save', requireAdmin, async (req, res) => {
  const { dept, date, positions, assignments } = req.body;
  if (!dept || !date) return res.status(400).json({ error: 'dept and date are required.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Upsert daily plan
    const { rows: [plan] } = await client.query(
      `INSERT INTO netchex_daily_plans (department, plan_date, positions_snapshot)
       VALUES ($1, $2, $3)
       ON CONFLICT (department, plan_date) DO UPDATE
         SET positions_snapshot = EXCLUDED.positions_snapshot
       RETURNING id`,
      [dept, date, JSON.stringify(positions ?? [])]
    );

    // Replace all assignments for this plan
    await client.query(`DELETE FROM netchex_assignments WHERE daily_plan_id = $1`, [plan.id]);

    for (const a of (assignments ?? [])) {
      if (!a.shiftId || !a.positionKey) continue;
      await client.query(
        `INSERT INTO netchex_assignments (daily_plan_id, netchex_shift_id, position_key, sort_order, notes)
         VALUES ($1,$2,$3,$4,$5)`,
        [plan.id, a.shiftId, a.positionKey, a.sortOrder ?? 0, a.notes ?? null]
      );
    }

    await client.query('COMMIT');
    res.json({ planId: plan.id, saved: (assignments ?? []).length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Board save error:', err);
    res.status(500).json({ error: 'Failed to save assignments.' });
  } finally {
    client.release();
  }
});

export default router;
