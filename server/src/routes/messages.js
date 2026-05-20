import { Router } from 'express';
import pool from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/messages/conversations
router.get('/conversations', requireAuth, async (req, res) => {
  const userId = req.user.id;
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.name, c.type,
              (SELECT text FROM messages m WHERE m.conversation_id = c.id ORDER BY sent_at DESC LIMIT 1) AS "lastMessage",
              (SELECT sent_at FROM messages m WHERE m.conversation_id = c.id ORDER BY sent_at DESC LIMIT 1) AS "lastMessageTime",
              JSON_AGG(JSON_BUILD_OBJECT('id', e.id, 'name', e.name, 'avatar', e.avatar)) AS "memberDetails"
       FROM conversations c
       JOIN conversation_members cm ON cm.conversation_id = c.id
       JOIN conversation_members my ON my.conversation_id = c.id AND my.employee_id = $1
       JOIN employees e ON e.id = cm.employee_id
       GROUP BY c.id
       ORDER BY "lastMessageTime" DESC NULLS LAST`,
      [userId]
    );
    res.json({ conversations: rows });
  } catch (err) {
    console.error('Conversations error:', err.message);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// GET /api/messages/conversations/:id
router.get('/conversations/:id', requireAuth, async (req, res) => {
  const convoId = parseInt(req.params.id);
  const userId = req.user.id;
  try {
    const memberCheck = await pool.query(
      'SELECT 1 FROM conversation_members WHERE conversation_id=$1 AND employee_id=$2',
      [convoId, userId]
    );
    if (!memberCheck.rowCount) return res.status(404).json({ error: 'Conversation not found' });

    const [convoRes, msgsRes] = await Promise.all([
      pool.query(
        `SELECT c.id, c.name, c.type,
                JSON_AGG(JSON_BUILD_OBJECT('id', e.id, 'name', e.name, 'avatar', e.avatar)) AS "memberDetails"
         FROM conversations c
         JOIN conversation_members cm ON cm.conversation_id = c.id
         JOIN employees e ON e.id = cm.employee_id
         WHERE c.id = $1 GROUP BY c.id`,
        [convoId]
      ),
      pool.query(
        `SELECT m.id, m.sender_id AS "senderId", e.name AS "senderName", e.avatar AS "senderAvatar",
                m.text, m.sent_at AS time
         FROM messages m JOIN employees e ON e.id = m.sender_id
         WHERE m.conversation_id = $1 ORDER BY m.sent_at ASC`,
        [convoId]
      ),
    ]);

    res.json({ conversation: convoRes.rows[0], messages: msgsRes.rows });
  } catch (err) {
    console.error('Messages error:', err.message);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /api/messages/conversations/:id
router.post('/conversations/:id', requireAuth, async (req, res) => {
  const convoId = parseInt(req.params.id);
  const userId = req.user.id;
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Message text required' });

  try {
    const memberCheck = await pool.query(
      'SELECT 1 FROM conversation_members WHERE conversation_id=$1 AND employee_id=$2',
      [convoId, userId]
    );
    if (!memberCheck.rowCount) return res.status(404).json({ error: 'Conversation not found' });

    const { rows } = await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, text)
       VALUES ($1, $2, $3)
       RETURNING id, sender_id AS "senderId", text, sent_at AS time`,
      [convoId, userId, text.trim()]
    );
    const msg = rows[0];
    res.status(201).json({
      message: {
        ...msg,
        senderName: req.user.name,
        senderAvatar: req.user.avatar,
      },
    });
  } catch (err) {
    console.error('Send message error:', err.message);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

export default router;
