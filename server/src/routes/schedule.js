import { Router } from 'express';
import pool from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function getMondayOfCurrentWeek() {
  const now = new Date();
  const diff = now.getDay() === 0 ? -6 : 1 - now.getDay();
  now.setDate(now.getDate() + diff);
  now.setHours(0, 0, 0, 0);
  return now;
}

// GET /api/schedule
router.get('/', requireAuth, async (req, res) => {
  const { startDate, endDate, weekStart } = req.query;
  const employeeId = req.user.id;

  let startStr, endStr;
  if (startDate && endDate) {
    startStr = startDate;
    endStr = endDate;
  } else {
    const start = weekStart ? new Date(weekStart) : getMondayOfCurrentWeek();
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    startStr = start.toISOString().slice(0, 10);
    endStr = end.toISOString().slice(0, 10);
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, employee_id AS "employeeId", date::text, start_time AS start, end_time AS end,
              department, position, location, notes
       FROM shifts
       WHERE employee_id = $1 AND date >= $2 AND date <= $3
       ORDER BY date, start_time`,
      [employeeId, startStr, endStr]
    );
    res.json({ startDate: startStr, endDate: endStr, shifts: rows });
  } catch (err) {
    console.error('Schedule fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

// GET /api/schedule/upcoming
router.get('/upcoming', requireAuth, async (req, res) => {
  const employeeId = req.user.id;
  const today = new Date().toISOString().slice(0, 10);
  try {
    const { rows } = await pool.query(
      `SELECT id, employee_id AS "employeeId", date::text, start_time AS start, end_time AS end,
              department, position, location, notes
       FROM shifts
       WHERE employee_id = $1 AND date >= $2
       ORDER BY date, start_time LIMIT 10`,
      [employeeId, today]
    );
    res.json({ shifts: rows });
  } catch (err) {
    console.error('Upcoming shifts error:', err.message);
    res.status(500).json({ error: 'Failed to fetch upcoming shifts' });
  }
});

export default router;
