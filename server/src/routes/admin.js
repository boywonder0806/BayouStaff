import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db/index.js';
import { requireAdmin, requireSysAdmin } from '../middleware/auth.js';

const router = Router();

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

function getMondayOfWeek(date) {
  const d = new Date(date);
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

const EMP_SELECT = `
  id, email, name, role, department, departments, position, avatar, phone,
  hire_date AS "hireDate", is_active AS "isActive", created_at AS "createdAt"
`;

const SHIFT_SELECT = `
  id, employee_id AS "employeeId", date::text, start_time AS start, end_time AS end,
  department, position, location, COALESCE(notes,'') AS notes
`;

// ── Stats ─────────────────────────────────────────────────────────────────────

router.get('/stats', requireAdmin, async (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const [staffRes, todayRes, weekRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM employees WHERE is_active = TRUE AND role != 'sysadmin'`),
      pool.query(`SELECT COUNT(*) FROM shifts WHERE date = $1`, [today]),
      pool.query(`SELECT COUNT(*) FROM shifts WHERE date >= date_trunc('week', NOW())::date AND date < (date_trunc('week', NOW()) + interval '7 days')::date`),
    ]);
    res.json({
      totalStaff:      parseInt(staffRes.rows[0].count),
      onDutyToday:     parseInt(todayRes.rows[0].count),
      shiftsThisWeek:  parseInt(weekRes.rows[0].count),
      openRequests:    0,
    });
  } catch (err) {
    console.error('Stats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── Employees ─────────────────────────────────────────────────────────────────

router.get('/employees', requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(`SELECT ${EMP_SELECT} FROM employees WHERE is_active = TRUE ORDER BY name`);
    res.json({ employees: rows });
  } catch (err) {
    console.error('Employees error:', err.message);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

router.get('/schedule', requireAdmin, async (req, res) => {
  const target = req.query.date || new Date().toISOString().slice(0, 10);
  try {
    const { rows } = await pool.query(
      `SELECT s.${SHIFT_SELECT.replace(/\n/g,' ')}, e.name AS "employeeName", e.avatar
       FROM shifts s JOIN employees e ON e.id = s.employee_id
       WHERE s.date = $1 ORDER BY s.start_time`,
      [target]
    );
    res.json({ date: target, shifts: rows });
  } catch (err) {
    console.error('Admin schedule error:', err.message);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

const VALID_DEPTS = ['Aquatics', 'Guest Services', 'Food & Beverage', 'Cleaning Crew', 'Management'];

router.patch('/employees/:id/password', requireAdmin, async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rowCount } = await pool.query('UPDATE employees SET password_hash=$1 WHERE id=$2', [hash, parseInt(req.params.id)]);
    if (!rowCount) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Password update error:', err.message);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

router.patch('/employees/:id/departments', requireAdmin, async (req, res) => {
  const { departments } = req.body;
  if (!Array.isArray(departments) || departments.length === 0) return res.status(400).json({ error: 'departments must be a non-empty array.' });
  const invalid = departments.filter(d => !VALID_DEPTS.includes(d));
  if (invalid.length) return res.status(400).json({ error: `Invalid departments: ${invalid.join(', ')}` });
  try {
    const { rows } = await pool.query(
      `UPDATE employees SET departments=$1, department=$2 WHERE id=$3 RETURNING ${EMP_SELECT}`,
      [departments, departments[0], parseInt(req.params.id)]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('Departments update error:', err.message);
    res.status(500).json({ error: 'Failed to update departments' });
  }
});

// ── Scheduler (live shifts) ───────────────────────────────────────────────────

router.get('/scheduler', requireAdmin, async (req, res) => {
  const weekStart = req.query.weekStart || getMondayOfWeek(new Date());
  const days = getWeekDates(weekStart);
  try {
    const [empsRes, shiftsRes] = await Promise.all([
      pool.query(`SELECT ${EMP_SELECT} FROM employees WHERE is_active=TRUE ORDER BY name`),
      pool.query(`SELECT ${SHIFT_SELECT} FROM shifts WHERE date = ANY($1::date[]) ORDER BY date, start_time`, [days]),
    ]);
    res.json({ weekStart, days, employees: empsRes.rows, shifts: shiftsRes.rows });
  } catch (err) {
    console.error('Scheduler error:', err.message);
    res.status(500).json({ error: 'Failed to fetch scheduler' });
  }
});

router.post('/scheduler/shifts', requireAdmin, async (req, res) => {
  const { employeeId, date, start, end, department, position, location, notes } = req.body;
  if (!employeeId || !date || !start || !end) return res.status(400).json({ error: 'employeeId, date, start, and end are required.' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO shifts (employee_id,date,start_time,end_time,department,position,location,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${SHIFT_SELECT}`,
      [parseInt(employeeId), date, start, end, department||'', position||'', location||'', notes||'']
    );
    res.status(201).json({ shift: rows[0] });
  } catch (err) {
    console.error('Create shift error:', err.message);
    res.status(500).json({ error: 'Failed to create shift' });
  }
});

router.patch('/scheduler/shifts/:id', requireAdmin, async (req, res) => {
  const { employeeId, date, start, end, department, position, location, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE shifts SET
         employee_id = COALESCE($1, employee_id),
         date        = COALESCE($2::date, date),
         start_time  = COALESCE($3::time, start_time),
         end_time    = COALESCE($4::time, end_time),
         department  = COALESCE($5, department),
         position    = COALESCE($6, position),
         location    = COALESCE($7, location),
         notes       = COALESCE($8, notes)
       WHERE id = $9 RETURNING ${SHIFT_SELECT}`,
      [employeeId ? parseInt(employeeId) : null, date||null, start||null, end||null,
       department??null, position??null, location??null, notes??null, parseInt(req.params.id)]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Shift not found.' });
    res.json({ shift: rows[0] });
  } catch (err) {
    console.error('Update shift error:', err.message);
    res.status(500).json({ error: 'Failed to update shift' });
  }
});

router.delete('/scheduler/shifts/:id', requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM shifts WHERE id=$1', [parseInt(req.params.id)]);
    if (!rowCount) return res.status(404).json({ error: 'Shift not found.' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete shift error:', err.message);
    res.status(500).json({ error: 'Failed to delete shift' });
  }
});

// ── Plan Schedule (draft shifts) ──────────────────────────────────────────────

router.get('/scheduler/plan', requireAdmin, async (req, res) => {
  const weekStart = req.query.weekStart || getMondayOfWeek(new Date());
  const days = getTwoWeekDates(weekStart);
  try {
    const [empsRes, shiftsRes] = await Promise.all([
      pool.query(`SELECT ${EMP_SELECT} FROM employees WHERE is_active=TRUE ORDER BY name`),
      pool.query(`SELECT ${SHIFT_SELECT} FROM draft_shifts WHERE date = ANY($1::date[]) ORDER BY date, start_time`, [days]),
    ]);
    res.json({ weekStart, days, employees: empsRes.rows, shifts: shiftsRes.rows });
  } catch (err) {
    console.error('Plan scheduler error:', err.message);
    res.status(500).json({ error: 'Failed to fetch plan' });
  }
});

router.post('/scheduler/plan/shifts', requireAdmin, async (req, res) => {
  const { employeeId, date, start, end, department, position, location, notes } = req.body;
  if (!employeeId || !date || !start || !end) return res.status(400).json({ error: 'employeeId, date, start, and end are required.' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO draft_shifts (employee_id,date,start_time,end_time,department,position,location,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${SHIFT_SELECT}`,
      [parseInt(employeeId), date, start, end, department||'', position||'', location||'', notes||'']
    );
    res.status(201).json({ shift: rows[0] });
  } catch (err) {
    console.error('Create draft shift error:', err.message);
    res.status(500).json({ error: 'Failed to create draft shift' });
  }
});

router.patch('/scheduler/plan/shifts/:id', requireAdmin, async (req, res) => {
  const { employeeId, date, start, end, department, position, location, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE draft_shifts SET
         employee_id = COALESCE($1, employee_id),
         date        = COALESCE($2::date, date),
         start_time  = COALESCE($3::time, start_time),
         end_time    = COALESCE($4::time, end_time),
         department  = COALESCE($5, department),
         position    = COALESCE($6, position),
         location    = COALESCE($7, location),
         notes       = COALESCE($8, notes)
       WHERE id = $9 RETURNING ${SHIFT_SELECT}`,
      [employeeId ? parseInt(employeeId) : null, date||null, start||null, end||null,
       department??null, position??null, location??null, notes??null, parseInt(req.params.id)]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Draft shift not found.' });
    res.json({ shift: rows[0] });
  } catch (err) {
    console.error('Update draft shift error:', err.message);
    res.status(500).json({ error: 'Failed to update draft shift' });
  }
});

router.delete('/scheduler/plan/shifts/:id', requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM draft_shifts WHERE id=$1', [parseInt(req.params.id)]);
    if (!rowCount) return res.status(404).json({ error: 'Draft shift not found.' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete draft shift error:', err.message);
    res.status(500).json({ error: 'Failed to delete draft shift' });
  }
});

router.post('/scheduler/plan/publish', requireAdmin, async (req, res) => {
  const { from, to } = req.body;
  if (!from || !to) return res.status(400).json({ error: 'from and to dates are required.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: drafts } = await client.query(
      `SELECT ${SHIFT_SELECT} FROM draft_shifts WHERE date >= $1 AND date <= $2`,
      [from, to]
    );
    if (drafts.length === 0) { await client.query('COMMIT'); return res.json({ published: 0 }); }

    for (const d of drafts) {
      await client.query(
        `INSERT INTO shifts (employee_id,date,start_time,end_time,department,position,location,notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [d.employeeId, d.date, d.start, d.end, d.department, d.position, d.location, d.notes]
      );
    }
    await client.query('DELETE FROM draft_shifts WHERE date >= $1 AND date <= $2', [from, to]);
    await client.query('COMMIT');
    res.json({ published: drafts.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Publish error:', err.message);
    res.status(500).json({ error: 'Failed to publish shifts' });
  } finally {
    client.release();
  }
});

export default router;
