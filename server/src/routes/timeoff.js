import { Router } from 'express';
import pool from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, start_date::text AS "startDate", end_date::text AS "endDate",
              reason, status, review_notes AS "reviewNotes", created_at AS "createdAt"
       FROM time_off_requests WHERE employee_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ requests: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch time off requests' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { startDate, endDate, reason } = req.body;
  if (!startDate || !endDate) return res.status(400).json({ error: 'startDate and endDate are required' });
  if (endDate < startDate) return res.status(400).json({ error: 'endDate must be on or after startDate' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO time_off_requests (employee_id, start_date, end_date, reason)
       VALUES ($1, $2, $3, $4)
       RETURNING id, start_date::text AS "startDate", end_date::text AS "endDate",
                 reason, status, created_at AS "createdAt"`,
      [req.user.id, startDate, endDate, reason || null]
    );
    res.status(201).json({ request: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit request' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM time_off_requests WHERE id = $1 AND employee_id = $2 AND status = 'pending'`,
      [parseInt(req.params.id), req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Request not found or already reviewed' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel request' });
  }
});

export default router;
