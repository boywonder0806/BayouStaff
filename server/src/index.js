import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import scheduleRouter from './routes/schedule.js';
import messagesRouter from './routes/messages.js';
import adminRouter from './routes/admin.js';
import announcementsRouter from './routes/announcements.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/schedule', scheduleRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/admin', adminRouter);
app.use('/api/announcements', announcementsRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Blue Bayou Staff API' });
});

app.listen(PORT, () => {
  console.log(`Blue Bayou Staff API running on http://localhost:${PORT}`);
});
