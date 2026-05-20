import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db/index.js';
import { requireAdmin, requireSysAdmin } from '../middleware/auth.js';

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────
function getMondayOfWeek(dateStr) {
  const d = new Date(dateStr);
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

const SHIFT_SELECT = `id, employee_id AS "employeeId", date::text, start_time AS start,
  end_time AS end, department, position, location, COALESCE(notes,'') AS notes`;

// Returns null for sysadmin (no filter), or the manager's departments array
function managerDepts(req) {
  if (req.user.role === 'sysadmin') return null;
  return req.user.departments ?? [];
}

// ── Stats ─────────────────────────────────────────────────────────────────────
router.get('/stats', requireAdmin, async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const depts = managerDepts(req);
  try {
    const [staffRes, todayRes, weekRes] = await Promise.all([
      depts
        ? pool.query(`SELECT COUNT(*) FROM employees WHERE is_active = true AND role = 'crew_member' AND departments && $1::text[]`, [depts])
        : pool.query(`SELECT COUNT(*) FROM employees WHERE is_active = true AND role = 'crew_member'`),
      depts
        ? pool.query(`SELECT COUNT(*) FROM shifts WHERE date = $1 AND department = ANY($2::text[])`, [today, depts])
        : pool.query(`SELECT COUNT(*) FROM shifts WHERE date = $1`, [today]),
      depts
        ? pool.query(`SELECT COUNT(*) FROM shifts WHERE date >= date_trunc('week', CURRENT_DATE) AND department = ANY($1::text[])`, [depts])
        : pool.query(`SELECT COUNT(*) FROM shifts WHERE date >= date_trunc('week', CURRENT_DATE)`),
    ]);
    res.json({
      totalStaff:     parseInt(staffRes.rows[0].count),
      onDutyToday:    parseInt(todayRes.rows[0].count),
      shiftsThisWeek: parseInt(weekRes.rows[0].count),
      openRequests:   0,
    });
  } catch (err) {
    console.error('Stats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── Employees ─────────────────────────────────────────────────────────────────
router.get('/employees', requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, name, role, department, departments, position,
              avatar, phone, hire_date AS "hireDate", is_active AS "isActive"
       FROM employees ORDER BY name`
    );
    res.json({ employees: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

router.patch('/employees/:id/password', requireAdmin, async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rowCount } = await pool.query(
      `UPDATE employees SET password_hash = $1 WHERE id = $2`,
      [hash, parseInt(req.params.id)]
    );
    if (!rowCount) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update password' });
  }
});

const VALID_DEPARTMENTS = ['Aquatics', 'Guest Services', 'Food & Beverage', 'Cleaning Crew', 'Management'];
router.patch('/employees/:id/departments', requireAdmin, async (req, res) => {
  const { departments } = req.body;
  if (!Array.isArray(departments)) {
    return res.status(400).json({ error: 'departments must be an array.' });
  }
  const invalid = departments.filter(d => !VALID_DEPARTMENTS.includes(d));
  if (invalid.length) {
    return res.status(400).json({ error: `Invalid departments: ${invalid.join(', ')}` });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE employees SET departments = $1, department = $2 WHERE id = $3
       RETURNING id, email, name, role, department, departments, position, avatar, phone`,
      [departments, departments[0] || null, parseInt(req.params.id)]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update departments' });
  }
});

// ── Daily schedule view ───────────────────────────────────────────────────────
router.get('/schedule', requireAdmin, async (req, res) => {
  const target = req.query.date || new Date().toISOString().slice(0, 10);
  const depts = managerDepts(req);
  try {
    const { rows } = depts
      ? await pool.query(
          `SELECT s.id, s.employee_id AS "employeeId", s.date::text, s.start_time AS start,
                  s.end_time AS end, s.department, s.position, s.location,
                  COALESCE(s.notes,'') AS notes, e.name AS "employeeName", e.avatar
           FROM shifts s JOIN employees e ON e.id = s.employee_id
           WHERE s.date = $1 AND s.department = ANY($2::text[]) ORDER BY s.start_time`,
          [target, depts]
        )
      : await pool.query(
          `SELECT s.id, s.employee_id AS "employeeId", s.date::text, s.start_time AS start,
                  s.end_time AS end, s.department, s.position, s.location,
                  COALESCE(s.notes,'') AS notes, e.name AS "employeeName", e.avatar
           FROM shifts s JOIN employees e ON e.id = s.employee_id
           WHERE s.date = $1 ORDER BY s.start_time`,
          [target]
        );
    res.json({ date: target, shifts: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

// ── Scheduler (current week) ──────────────────────────────────────────────────
router.get('/scheduler', requireAdmin, async (req, res) => {
  const weekStart = req.query.weekStart || getMondayOfWeek(new Date());
  const days = getWeekDates(weekStart);
  const depts = managerDepts(req);
  try {
    const [empRes, shiftRes] = await Promise.all([
      depts
        ? pool.query(`SELECT id, email, name, role, department, departments, position, avatar, phone,
                             hire_date AS "hireDate" FROM employees WHERE is_active = true AND departments && $1::text[] ORDER BY name`, [depts])
        : pool.query(`SELECT id, email, name, role, department, departments, position, avatar, phone,
                             hire_date AS "hireDate" FROM employees WHERE is_active = true ORDER BY name`),
      depts
        ? pool.query(`SELECT ${SHIFT_SELECT} FROM shifts WHERE date = ANY($1::date[]) AND department = ANY($2::text[]) ORDER BY date, start_time`, [days, depts])
        : pool.query(`SELECT ${SHIFT_SELECT} FROM shifts WHERE date = ANY($1::date[]) ORDER BY date, start_time`, [days]),
    ]);
    res.json({ weekStart, days, employees: empRes.rows, shifts: shiftRes.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch scheduler' });
  }
});

router.post('/scheduler/shifts', requireAdmin, async (req, res) => {
  const { employeeId, date, start, end, department, position, location, notes } = req.body;
  if (!employeeId || !date || !start || !end) {
    return res.status(400).json({ error: 'employeeId, date, start, and end are required.' });
  }
  const depts = managerDepts(req);
  if (depts && department && !depts.includes(department)) {
    return res.status(403).json({ error: 'You do not have access to this department.' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO shifts (employee_id,date,start_time,end_time,department,position,location,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${SHIFT_SELECT}`,
      [parseInt(employeeId), date, start, end, department||'', position||'', location||'', notes||'']
    );
    res.status(201).json({ shift: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create shift' });
  }
});

router.patch('/scheduler/shifts/:id', requireAdmin, async (req, res) => {
  const { employeeId, date, start, end, department, position, location, notes } = req.body;
  const depts = managerDepts(req);
  if (depts) {
    const { rows: cur } = await pool.query(`SELECT department FROM shifts WHERE id = $1`, [parseInt(req.params.id)]);
    if (!cur[0]) return res.status(404).json({ error: 'Shift not found.' });
    if (!depts.includes(cur[0].department)) return res.status(403).json({ error: 'You do not have access to this department.' });
    if (department && !depts.includes(department)) return res.status(403).json({ error: 'You do not have access to this department.' });
  }
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
      [employeeId ? parseInt(employeeId) : null,
       date||null, start||null, end||null,
       department??null, position??null, location??null, notes??null,
       parseInt(req.params.id)]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Shift not found.' });
    res.json({ shift: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update shift' });
  }
});

router.delete('/scheduler/shifts/:id', requireAdmin, async (req, res) => {
  const depts = managerDepts(req);
  if (depts) {
    const { rows: cur } = await pool.query(`SELECT department FROM shifts WHERE id = $1`, [parseInt(req.params.id)]);
    if (!cur[0]) return res.status(404).json({ error: 'Shift not found.' });
    if (!depts.includes(cur[0].department)) return res.status(403).json({ error: 'You do not have access to this department.' });
  }
  try {
    const { rowCount } = await pool.query(`DELETE FROM shifts WHERE id = $1`, [parseInt(req.params.id)]);
    if (!rowCount) return res.status(404).json({ error: 'Shift not found.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete shift' });
  }
});

// ── Plan Schedule (draft) ─────────────────────────────────────────────────────
router.get('/scheduler/plan', requireAdmin, async (req, res) => {
  const weekStart = req.query.weekStart || getMondayOfWeek(new Date());
  const days = getWeekDates(weekStart);
  const depts = managerDepts(req);
  try {
    const [empRes, shiftRes] = await Promise.all([
      depts
        ? pool.query(`SELECT id, email, name, role, department, departments, position, avatar, phone,
                             hire_date AS "hireDate" FROM employees WHERE is_active = true AND departments && $1::text[] ORDER BY name`, [depts])
        : pool.query(`SELECT id, email, name, role, department, departments, position, avatar, phone,
                             hire_date AS "hireDate" FROM employees WHERE is_active = true ORDER BY name`),
      depts
        ? pool.query(`SELECT ${SHIFT_SELECT} FROM draft_shifts WHERE date = ANY($1::date[]) AND department = ANY($2::text[]) ORDER BY date, start_time`, [days, depts])
        : pool.query(`SELECT ${SHIFT_SELECT} FROM draft_shifts WHERE date = ANY($1::date[]) ORDER BY date, start_time`, [days]),
    ]);
    res.json({ weekStart, days, employees: empRes.rows, shifts: shiftRes.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch plan' });
  }
});

router.post('/scheduler/plan/shifts', requireAdmin, async (req, res) => {
  const { employeeId, date, start, end, department, position, location, notes } = req.body;
  if (!employeeId || !date || !start || !end) {
    return res.status(400).json({ error: 'employeeId, date, start, and end are required.' });
  }
  const depts = managerDepts(req);
  if (depts && department && !depts.includes(department)) {
    return res.status(403).json({ error: 'You do not have access to this department.' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO draft_shifts (employee_id,date,start_time,end_time,department,position,location,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${SHIFT_SELECT}`,
      [parseInt(employeeId), date, start, end, department||'', position||'', location||'', notes||'']
    );
    res.status(201).json({ shift: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create draft shift' });
  }
});

router.patch('/scheduler/plan/shifts/:id', requireAdmin, async (req, res) => {
  const { employeeId, date, start, end, department, position, location, notes } = req.body;
  const depts = managerDepts(req);
  if (depts) {
    const { rows: cur } = await pool.query(`SELECT department FROM draft_shifts WHERE id = $1`, [parseInt(req.params.id)]);
    if (!cur[0]) return res.status(404).json({ error: 'Draft shift not found.' });
    if (!depts.includes(cur[0].department)) return res.status(403).json({ error: 'You do not have access to this department.' });
    if (department && !depts.includes(department)) return res.status(403).json({ error: 'You do not have access to this department.' });
  }
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
      [employeeId ? parseInt(employeeId) : null,
       date||null, start||null, end||null,
       department??null, position??null, location??null, notes??null,
       parseInt(req.params.id)]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Draft shift not found.' });
    res.json({ shift: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update draft shift' });
  }
});

router.delete('/scheduler/plan/shifts/:id', requireAdmin, async (req, res) => {
  const depts = managerDepts(req);
  if (depts) {
    const { rows: cur } = await pool.query(`SELECT department FROM draft_shifts WHERE id = $1`, [parseInt(req.params.id)]);
    if (!cur[0]) return res.status(404).json({ error: 'Draft shift not found.' });
    if (!depts.includes(cur[0].department)) return res.status(403).json({ error: 'You do not have access to this department.' });
  }
  try {
    const { rowCount } = await pool.query(`DELETE FROM draft_shifts WHERE id = $1`, [parseInt(req.params.id)]);
    if (!rowCount) return res.status(404).json({ error: 'Draft shift not found.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete draft shift' });
  }
});

router.post('/scheduler/plan/publish', requireAdmin, async (req, res) => {
  const { from, to } = req.body;
  if (!from || !to) return res.status(400).json({ error: 'from and to dates are required.' });
  const depts = managerDepts(req);
  const pgClient = await pool.connect();
  try {
    await pgClient.query('BEGIN');
    const { rows: drafts } = depts
      ? await pgClient.query(
          `SELECT * FROM draft_shifts WHERE date >= $1 AND date <= $2 AND department = ANY($3::text[])`,
          [from, to, depts]
        )
      : await pgClient.query(
          `SELECT * FROM draft_shifts WHERE date >= $1 AND date <= $2`, [from, to]
        );
    if (!drafts.length) { await pgClient.query('COMMIT'); return res.json({ published: 0 }); }
    for (const d of drafts) {
      await pgClient.query(
        `INSERT INTO shifts (employee_id,date,start_time,end_time,department,position,location,notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [d.employee_id, d.date, d.start_time, d.end_time, d.department, d.position, d.location, d.notes]
      );
    }
    if (depts) {
      await pgClient.query(
        `DELETE FROM draft_shifts WHERE date >= $1 AND date <= $2 AND department = ANY($3::text[])`,
        [from, to, depts]
      );
    } else {
      await pgClient.query(`DELETE FROM draft_shifts WHERE date >= $1 AND date <= $2`, [from, to]);
    }
    await pgClient.query('COMMIT');
    res.json({ published: drafts.length });
  } catch (err) {
    await pgClient.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to publish shifts' });
  } finally {
    pgClient.release();
  }
});

// ── SysAdmin ──────────────────────────────────────────────────────────────────
router.get('/sysadmin/users', requireSysAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, name, role, department, departments, position,
              avatar, phone, hire_date AS "hireDate", is_active AS "isActive", created_at AS "createdAt"
       FROM employees ORDER BY name`
    );
    res.json({ users: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/sysadmin/users', requireSysAdmin, async (req, res) => {
  const { email, password, name, role, department, departments, position, avatar, phone, hireDate } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'email, password, and name are required.' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO employees (email,password_hash,name,role,department,departments,position,avatar,phone,hire_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, email, name, role, department, departments, position, avatar, phone, hire_date AS "hireDate"`,
      [email.toLowerCase().trim(), hash, name, role||'crew_member',
       department||null, departments||[], position||null, avatar||null, phone||null, hireDate||null]
    );
    res.status(201).json({ user: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists.' });
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// ── Department Roles & Positions ─────────────────────────────────────────────
router.get('/departments/roles', requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, department, name, type, sort_order FROM department_roles ORDER BY department, type, sort_order, id`
    );
    res.json({ roles: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch department roles' });
  }
});

router.post('/departments/:dept/roles', requireAdmin, async (req, res) => {
  const { name, type = 'role' } = req.body;
  const department = decodeURIComponent(req.params.dept);
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  if (!['role', 'position'].includes(type)) return res.status(400).json({ error: 'type must be role or position' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO department_roles (department, name, type, sort_order)
       VALUES ($1, $2, $3, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM department_roles WHERE department = $1 AND type = $3))
       RETURNING id, department, name, type, sort_order`,
      [department, name.trim(), type]
    );
    res.status(201).json({ role: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Name already exists for this type.' });
    res.status(500).json({ error: 'Failed to add entry' });
  }
});

router.patch('/departments/roles/:id', requireAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  try {
    const { rows } = await pool.query(
      `UPDATE department_roles SET name = $1 WHERE id = $2 RETURNING id, department, name, type, sort_order`,
      [name.trim(), parseInt(req.params.id)]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({ role: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Name already exists for this type.' });
    res.status(500).json({ error: 'Failed to update entry' });
  }
});

router.delete('/departments/roles/:id', requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM department_roles WHERE id = $1`, [parseInt(req.params.id)]
    );
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

// ── SysAdmin ──────────────────────────────────────────────────────────────────
router.patch('/sysadmin/users/:id', requireSysAdmin, async (req, res) => {
  const { name, email, role, department, departments, position, phone, isActive } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE employees SET
         name        = COALESCE($1, name),
         email       = COALESCE($2, email),
         role        = COALESCE($3, role),
         department  = COALESCE($4, department),
         departments = COALESCE($5, departments),
         position    = COALESCE($6, position),
         phone       = COALESCE($7, phone),
         is_active   = COALESCE($8, is_active)
       WHERE id = $9
       RETURNING id, email, name, role, department, departments, position, avatar, phone, is_active AS "isActive"`,
      [name||null, email||null, role||null, department||null,
       departments||null, position||null, phone||null,
       isActive !== undefined ? isActive : null, parseInt(req.params.id)]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

export default router;
