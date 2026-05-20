import { Router } from 'express';
import { MOCK_ANNOUNCEMENTS, MOCK_SHIFTS } from '../data/mockData.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET /api/announcements?department=Aquatics
router.get('/', requireAuth, (req, res) => {
  const { department } = req.query;
  let list = [...MOCK_ANNOUNCEMENTS].sort((a, b) => b.date.localeCompare(a.date));
  if (department && department !== 'all') {
    list = list.filter(a => a.department === department);
  }
  res.json({ announcements: list });
});

// GET /api/announcements/home — employee home dashboard summary
router.get('/home', requireAuth, (req, res) => {
  const employeeId = req.user.id;
  const today = new Date().toISOString().slice(0, 10);

  const nextShift = MOCK_SHIFTS
    .filter(s => s.employeeId === employeeId && s.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;

  const upcomingShifts = MOCK_SHIFTS
    .filter(s => s.employeeId === employeeId && s.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(1, 4);

  const announcements = [...MOCK_ANNOUNCEMENTS]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);

  res.json({ nextShift, upcomingShifts, announcements });
});

// POST /api/announcements — managers and sysadmin
router.post('/', requireAdmin, (req, res) => {
  const { title, body, priority = 'normal', department = null } = req.body;
  if (!title?.trim() || !body?.trim()) {
    return res.status(400).json({ error: 'Title and body are required' });
  }
  const announcement = {
    id: Date.now(),
    title: title.trim(),
    body: body.trim(),
    author: req.user.name,
    authorAvatar: req.user.avatar,
    department: department || null,
    date: new Date().toISOString().slice(0, 10),
    priority,
  };
  MOCK_ANNOUNCEMENTS.unshift(announcement);
  res.status(201).json({ announcement });
});

// PATCH /api/announcements/:id — managers and sysadmin
router.patch('/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const ann = MOCK_ANNOUNCEMENTS.find(a => a.id === id);
  if (!ann) return res.status(404).json({ error: 'Announcement not found' });
  const { title, body, priority, department } = req.body;
  if (title !== undefined) ann.title = title.trim();
  if (body !== undefined) ann.body = body.trim();
  if (priority !== undefined) ann.priority = priority;
  if (department !== undefined) ann.department = department || null;
  res.json({ announcement: ann });
});

// DELETE /api/announcements/:id — managers and sysadmin
router.delete('/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const idx = MOCK_ANNOUNCEMENTS.findIndex(a => a.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Announcement not found' });
  MOCK_ANNOUNCEMENTS.splice(idx, 1);
  res.json({ success: true });
});

export default router;
