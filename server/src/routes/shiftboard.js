import { Router } from 'express';
import pool from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const { rows } = await pool.query(
      `SELECT id, date::text, start_time AS start, end_time AS end,
              department, position, notes, claimed_by AS "claimedBy"
       FROM open_shifts
       WHERE date >= $1 AND claimed_by IS NULL
       ORDER BY date, start_time`,
      [today]
    );
    res.json({ shifts: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch open shifts' });
  }
});

router.post('/:id/claim', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE open_shifts SET claimed_by = $1, claimed_at = NOW()
       WHERE id = $2 AND claimed_by IS NULL
       RETURNING id`,
      [req.user.id, parseInt(req.params.id)]
    );
    if (!rows[0]) return res.status(409).json({ error: 'Shift already claimed or not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to claim shift' });
  }
});

export default router;
