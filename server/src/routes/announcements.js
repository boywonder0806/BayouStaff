import { Router } from 'express';
import pool from '../db/index.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET /api/announcements
router.get('/', requireAuth, async (req, res) => {
  const { department } = req.query;
  try {
    const { rows } = await pool.query(
      `SELECT id, title, body, author_name AS "author", author_avatar AS "authorAvatar",
              department, priority, date::text
       FROM announcements
       ${department && department !== 'all' ? 'WHERE department = $1 OR department IS NULL' : ''}
       ORDER BY date DESC, created_at DESC`,
      department && department !== 'all' ? [department] : []
    );
    res.json({ announcements: rows });
  } catch (err) {
    console.error('Announcements error:', err.message);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// GET /api/announcements/home
router.get('/home', requireAuth, async (req, res) => {
  const employeeId = req.user.id;
  const today = new Date().toISOString().slice(0, 10);
  try {
    const [shiftsRes, annsRes] = await Promise.all([
      pool.query(
        `SELECT id, employee_id AS "employeeId", date::text, start_time AS start, end_time AS end,
                department, position, location, notes
         FROM shifts WHERE employee_id = $1 AND date >= $2
         ORDER BY date, start_time LIMIT 10`,
        [employeeId, today]
      ),
      pool.query(
        `SELECT id, title, body, author_name AS "author", author_avatar AS "authorAvatar",
                department, priority, date::text
         FROM announcements ORDER BY date DESC, created_at DESC LIMIT 4`
      ),
    ]);
    const allShifts = shiftsRes.rows;
    res.json({
      nextShift: allShifts[0] ?? null,
      upcomingShifts: allShifts.slice(1, 4),
      announcements: annsRes.rows,
    });
  } catch (err) {
    console.error('Home data error:', err.message);
    res.status(500).json({ error: 'Failed to fetch home data' });
  }
});

// POST /api/announcements
router.post('/', requireAdmin, async (req, res) => {
  const { title, body, priority = 'normal', department = null } = req.body;
  if (!title?.trim() || !body?.trim()) {
    return res.status(400).json({ error: 'Title and body are required' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO announcements (title,body,author_id,author_name,author_avatar,department,priority)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, title, body, author_name AS "author", author_avatar AS "authorAvatar",
                 department, priority, date::text`,
      [title.trim(), body.trim(), req.user.id, req.user.name, req.user.avatar, department || null, priority]
    );
    res.status(201).json({ announcement: rows[0] });
  } catch (err) {
    console.error('Create announcement error:', err.message);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

// PATCH /api/announcements/:id
router.patch('/:id', requireAdmin, async (req, res) => {
  const { title, body, priority, department } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE announcements SET
         title      = COALESCE($1, title),
         body       = COALESCE($2, body),
         priority   = COALESCE($3, priority),
         department = CASE WHEN $4::boolean THEN $5 ELSE department END
       WHERE id = $6
       RETURNING id, title, body, author_name AS "author", author_avatar AS "authorAvatar",
                 department, priority, date::text`,
      [title?.trim() ?? null, body?.trim() ?? null, priority ?? null,
       department !== undefined, department || null, parseInt(req.params.id)]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Announcement not found' });
    res.json({ announcement: rows[0] });
  } catch (err) {
    console.error('Update announcement error:', err.message);
    res.status(500).json({ error: 'Failed to update announcement' });
  }
});

// DELETE /api/announcements/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM announcements WHERE id = $1', [parseInt(req.params.id)]);
    if (!rowCount) return res.status(404).json({ error: 'Announcement not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete announcement error:', err.message);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

export default router;
