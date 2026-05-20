import { Router } from 'express';
import pool from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, clock_in AS "clockIn", clock_out AS "clockOut", date::text, notes, status
       FROM timecards WHERE employee_id = $1 ORDER BY clock_in DESC LIMIT 60`,
      [req.user.id]
    );
    res.json({ timecards: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch timecards' });
  }
});

router.get('/status', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, clock_in AS "clockIn" FROM timecards
       WHERE employee_id = $1 AND clock_out IS NULL
       ORDER BY clock_in DESC LIMIT 1`,
      [req.user.id]
    );
    res.json({ open: rows[0] || null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch clock status' });
  }
});

router.post('/clock-in', requireAuth, async (req, res) => {
  try {
    const { rows: open } = await pool.query(
      `SELECT id FROM timecards WHERE employee_id = $1 AND clock_out IS NULL`,
      [req.user.id]
    );
    if (open.length) return res.status(409).json({ error: 'Already clocked in.' });
    const now = new Date();
    const { rows } = await pool.query(
      `INSERT INTO timecards (employee_id, clock_in, date)
       VALUES ($1, $2, $3)
       RETURNING id, clock_in AS "clockIn", clock_out AS "clockOut", date::text, status`,
      [req.user.id, now, now.toISOString().slice(0, 10)]
    );
    res.status(201).json({ timecard: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clock in' });
  }
});

router.patch('/clock-out', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE timecards SET clock_out = NOW(), status = 'closed'
       WHERE employee_id = $1 AND clock_out IS NULL
       RETURNING id, clock_in AS "clockIn", clock_out AS "clockOut", date::text, status`,
      [req.user.id]
    );
    if (!rows[0]) return res.status(409).json({ error: 'Not clocked in.' });
    res.json({ timecard: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clock out' });
  }
});

export default router;
