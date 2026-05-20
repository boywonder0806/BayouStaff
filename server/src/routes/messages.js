import { Router } from 'express';
import { MOCK_CONVERSATIONS, MOCK_MESSAGES, MOCK_USERS } from '../data/mockData.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/messages/conversations
router.get('/conversations', requireAuth, (req, res) => {
  const userId = req.user.id;
  const convos = MOCK_CONVERSATIONS.filter(c => c.members.includes(userId)).map(c => {
    const memberDetails = c.members.map(id => {
      const u = MOCK_USERS.find(u => u.id === id);
      return u ? { id: u.id, name: u.name, avatar: u.avatar } : null;
    }).filter(Boolean);
    return { ...c, memberDetails };
  });
  res.json({ conversations: convos });
});

// GET /api/messages/conversations/:id
router.get('/conversations/:id', requireAuth, (req, res) => {
  const convoId = parseInt(req.params.id);
  const userId = req.user.id;
  const convo = MOCK_CONVERSATIONS.find(c => c.id === convoId && c.members.includes(userId));
  if (!convo) return res.status(404).json({ error: 'Conversation not found' });

  const messages = (MOCK_MESSAGES[convoId] || []).map(m => {
    const sender = MOCK_USERS.find(u => u.id === m.senderId);
    return { ...m, senderName: sender?.name, senderAvatar: sender?.avatar };
  });

  res.json({ conversation: convo, messages });
});

// POST /api/messages/conversations/:id — send a message
router.post('/conversations/:id', requireAuth, (req, res) => {
  const convoId = parseInt(req.params.id);
  const userId = req.user.id;
  const { text } = req.body;

  if (!text?.trim()) return res.status(400).json({ error: 'Message text required' });

  const convo = MOCK_CONVERSATIONS.find(c => c.id === convoId && c.members.includes(userId));
  if (!convo) return res.status(404).json({ error: 'Conversation not found' });

  const sender = MOCK_USERS.find(u => u.id === userId);
  const newMessage = {
    id: Date.now(),
    senderId: userId,
    senderName: sender?.name,
    senderAvatar: sender?.avatar,
    text: text.trim(),
    time: new Date().toISOString(),
  };

  if (!MOCK_MESSAGES[convoId]) MOCK_MESSAGES[convoId] = [];
  MOCK_MESSAGES[convoId].push(newMessage);
  convo.lastMessage = text.trim();
  convo.lastMessageTime = newMessage.time;

  res.status(201).json({ message: newMessage });
});

export default router;
