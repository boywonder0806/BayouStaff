import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { MOCK_USERS } from '../data/mockData.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // TODO: replace with DB lookup + bcrypt.compare once Netchex/DB is wired
  const user = MOCK_USERS.find(u => u.email === email && u.password === password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const { password: _pw, ...safeUser } = user;
  const token = jwt.sign(safeUser, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, user: safeUser });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const { iat, exp, ...user } = req.user;
  res.json({ user });
});

export default router;
