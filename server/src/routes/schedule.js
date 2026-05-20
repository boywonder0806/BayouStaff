import { Router } from 'express';
import { MOCK_SHIFTS } from '../data/mockData.js';
import * as netchex from '../services/netchex.js';
import { requireAuth } from '../middleware/auth.js';

const useNetchex = !!process.env.NETCHEX_API_KEY;

const router = Router();

// GET /api/schedule
// Query: ?startDate=2026-05-01&endDate=2026-05-31  (any range)
//        ?weekStart=2026-05-18  (legacy — 7-day window from that Monday)
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
    const shifts = useNetchex
      ? await netchex.getShifts(employeeId, startStr, endStr)
      : MOCK_SHIFTS.filter(s => s.employeeId === employeeId && s.date >= startStr && s.date <= endStr);

    res.json({ startDate: startStr, endDate: endStr, shifts });
  } catch (err) {
    console.error('Schedule fetch error:', err.message);
    res.status(502).json({ error: 'Failed to fetch schedule' });
  }
});

// GET /api/schedule/upcoming — next 14 days for the authenticated employee
router.get('/upcoming', requireAuth, (req, res) => {
  const employeeId = req.user.id;
  const today = new Date().toISOString().slice(0, 10);
  const shifts = MOCK_SHIFTS
    .filter(s => s.employeeId === employeeId && s.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 10);
  res.json({ shifts });
});

function getMondayOfCurrentWeek() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  now.setDate(now.getDate() + diff);
  now.setHours(0, 0, 0, 0);
  return now;
}

export default router;
