import { Router } from 'express';
import { MOCK_USERS, MOCK_SHIFTS, MOCK_DRAFT_SHIFTS } from '../data/mockData.js';
import { requireAdmin, requireSysAdmin } from '../middleware/auth.js';

let nextShiftId = MOCK_SHIFTS.length + 1;
let nextDraftId = 2000;

function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function getWeekDates(mondayStr) {
  const base = new Date(mondayStr + 'T00:00:00');
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

function getTwoWeekDates(mondayStr) {
  const base = new Date(mondayStr + 'T00:00:00');
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

const router = Router();

// GET /api/admin/stats
router.get('/stats', requireAdmin, (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const todayShifts = MOCK_SHIFTS.filter(s => s.date === today);
  const activeEmployees = MOCK_USERS.filter(u => u.role === 'crew_member');

  res.json({
    totalStaff: activeEmployees.length,
    onDutyToday: todayShifts.length,
    shiftsThisWeek: MOCK_SHIFTS.length,
    openRequests: 1, // placeholder
  });
});

// GET /api/admin/employees
router.get('/employees', requireAdmin, (_req, res) => {
  const employees = MOCK_USERS.map(({ password: _pw, ...u }) => u);
  res.json({ employees });
});

// GET /api/admin/schedule?date=2026-05-18
router.get('/schedule', requireAdmin, (req, res) => {
  const { date } = req.query;
  const target = date || new Date().toISOString().slice(0, 10);

  const shifts = MOCK_SHIFTS
    .filter(s => s.date === target)
    .map(s => {
      const emp = MOCK_USERS.find(u => u.id === s.employeeId);
      return { ...s, employeeName: emp?.name, avatar: emp?.avatar };
    });

  res.json({ date: target, shifts });
});

// PATCH /api/admin/employees/:id/password — manager or sysadmin
router.patch('/employees/:id/password', requireAdmin, (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  const user = MOCK_USERS.find(u => u.id === parseInt(req.params.id));
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.password = password;
  res.json({ success: true });
});

// PATCH /api/admin/employees/:id/departments — manager or sysadmin
const VALID_DEPARTMENTS = ['Aquatics', 'Guest Services', 'Food & Beverage', 'Cleaning Crew', 'Management'];
router.patch('/employees/:id/departments', requireAdmin, (req, res) => {
  const { departments } = req.body;
  if (!Array.isArray(departments) || departments.length === 0) {
    return res.status(400).json({ error: 'departments must be a non-empty array.' });
  }
  const invalid = departments.filter(d => !VALID_DEPARTMENTS.includes(d));
  if (invalid.length) {
    return res.status(400).json({ error: `Invalid departments: ${invalid.join(', ')}` });
  }
  const user = MOCK_USERS.find(u => u.id === parseInt(req.params.id));
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.departments = departments;
  const { password: _pw, ...safe } = user;
  res.json({ user: safe });
});

// ── Scheduler ────────────────────────────────────────────────────────────────

// GET /api/admin/scheduler?weekStart=YYYY-MM-DD
router.get('/scheduler', requireAdmin, (req, res) => {
  const weekStart = req.query.weekStart || getMondayOfWeek(new Date());
  const days = getWeekDates(weekStart);
  const employees = MOCK_USERS.map(({ password: _pw, ...u }) => u);
  const shifts = MOCK_SHIFTS.filter(s => days.includes(s.date));
  res.json({ weekStart, days, employees, shifts });
});

// POST /api/admin/scheduler/shifts
router.post('/scheduler/shifts', requireAdmin, (req, res) => {
  const { employeeId, date, start, end, department, position, location, notes } = req.body;
  if (!employeeId || !date || !start || !end) {
    return res.status(400).json({ error: 'employeeId, date, start, and end are required.' });
  }
  if (!MOCK_USERS.find(u => u.id === parseInt(employeeId))) {
    return res.status(404).json({ error: 'Employee not found.' });
  }
  const shift = {
    id: nextShiftId++,
    employeeId: parseInt(employeeId),
    date,
    start,
    end,
    department: department || '',
    position: position || '',
    location: location || '',
    notes: notes || '',
  };
  MOCK_SHIFTS.push(shift);
  res.status(201).json({ shift });
});

// PATCH /api/admin/scheduler/shifts/:id
router.patch('/scheduler/shifts/:id', requireAdmin, (req, res) => {
  const idx = MOCK_SHIFTS.findIndex(s => s.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Shift not found.' });
  const allowed = ['date', 'start', 'end', 'department', 'position', 'location', 'notes'];
  allowed.forEach(k => { if (req.body[k] !== undefined) MOCK_SHIFTS[idx][k] = req.body[k]; });
  if (req.body.employeeId !== undefined) MOCK_SHIFTS[idx].employeeId = parseInt(req.body.employeeId);
  res.json({ shift: MOCK_SHIFTS[idx] });
});

// DELETE /api/admin/scheduler/shifts/:id
router.delete('/scheduler/shifts/:id', requireAdmin, (req, res) => {
  const idx = MOCK_SHIFTS.findIndex(s => s.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Shift not found.' });
  MOCK_SHIFTS.splice(idx, 1);
  res.json({ success: true });
});

// ── Plan Schedule (draft) ─────────────────────────────────────────────────────

// GET /api/admin/scheduler/plan?weekStart=YYYY-MM-DD
router.get('/scheduler/plan', requireAdmin, (req, res) => {
  const weekStart = req.query.weekStart || getMondayOfWeek(new Date());
  const days = getTwoWeekDates(weekStart);
  const employees = MOCK_USERS.map(({ password: _pw, ...u }) => u);
  const shifts = MOCK_DRAFT_SHIFTS.filter(s => days.includes(s.date));
  res.json({ weekStart, days, employees, shifts });
});

// POST /api/admin/scheduler/plan/shifts
router.post('/scheduler/plan/shifts', requireAdmin, (req, res) => {
  const { employeeId, date, start, end, department, position, location, notes } = req.body;
  if (!employeeId || !date || !start || !end) {
    return res.status(400).json({ error: 'employeeId, date, start, and end are required.' });
  }
  if (!MOCK_USERS.find(u => u.id === parseInt(employeeId))) {
    return res.status(404).json({ error: 'Employee not found.' });
  }
  const shift = {
    id: nextDraftId++,
    employeeId: parseInt(employeeId),
    date, start, end,
    department: department || '',
    position: position || '',
    location: location || '',
    notes: notes || '',
  };
  MOCK_DRAFT_SHIFTS.push(shift);
  res.status(201).json({ shift });
});

// PATCH /api/admin/scheduler/plan/shifts/:id
router.patch('/scheduler/plan/shifts/:id', requireAdmin, (req, res) => {
  const idx = MOCK_DRAFT_SHIFTS.findIndex(s => s.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Draft shift not found.' });
  const allowed = ['date', 'start', 'end', 'department', 'position', 'location', 'notes'];
  allowed.forEach(k => { if (req.body[k] !== undefined) MOCK_DRAFT_SHIFTS[idx][k] = req.body[k]; });
  if (req.body.employeeId !== undefined) MOCK_DRAFT_SHIFTS[idx].employeeId = parseInt(req.body.employeeId);
  res.json({ shift: MOCK_DRAFT_SHIFTS[idx] });
});

// DELETE /api/admin/scheduler/plan/shifts/:id
router.delete('/scheduler/plan/shifts/:id', requireAdmin, (req, res) => {
  const idx = MOCK_DRAFT_SHIFTS.findIndex(s => s.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Draft shift not found.' });
  MOCK_DRAFT_SHIFTS.splice(idx, 1);
  res.json({ success: true });
});

// POST /api/admin/scheduler/plan/publish  — body: { from, to }
router.post('/scheduler/plan/publish', requireAdmin, (req, res) => {
  const { from, to } = req.body;
  if (!from || !to) return res.status(400).json({ error: 'from and to dates are required.' });

  const toPublish = MOCK_DRAFT_SHIFTS.filter(s => s.date >= from && s.date <= to);
  if (toPublish.length === 0) return res.json({ published: 0 });

  toPublish.forEach(({ id: _draftId, ...fields }) => {
    MOCK_SHIFTS.push({ ...fields, id: nextShiftId++ });
  });

  const publishedIds = new Set(toPublish.map(s => s.id));
  const remaining = MOCK_DRAFT_SHIFTS.filter(s => !publishedIds.has(s.id));
  MOCK_DRAFT_SHIFTS.length = 0;
  MOCK_DRAFT_SHIFTS.push(...remaining);

  res.json({ published: toPublish.length });
});

// PATCH /api/admin/employees/:id/role — sysadmin only
router.patch('/employees/:id/role', requireSysAdmin, (req, res) => {
  const { role } = req.body;
  const VALID_ROLES = ['crew_member', 'manager', 'sysadmin'];
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Must be crew_member, manager, or sysadmin.' });
  }
  const user = MOCK_USERS.find(u => u.id === parseInt(req.params.id));
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.role = role;
  const { password: _pw, ...safe } = user;
  res.json({ user: safe });
});

export default router;
