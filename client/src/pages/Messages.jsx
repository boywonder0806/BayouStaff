import { useState, useEffect, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import api from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Messages() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId]           = useState(null);
  const [messages, setMessages]           = useState([]);
  const [text, setText]                   = useState('');
  const [sending, setSending]             = useState(false);
  const endRef = useRef(null);
  const { user } = useAuth();

  useEffect(() => {
    api.get('/messages/conversations').then(r => {
      setConversations(r.data.conversations);
      if (r.data.conversations.length) setActiveId(r.data.conversations[0].id);
    });
  }, []);

  useEffect(() => {
    if (!activeId) return;
    api.get(`/messages/conversations/${activeId}`).then(r => setMessages(r.data.messages));
  }, [activeId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function send(e) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const { data } = await api.post(`/messages/conversations/${activeId}`, { text });
      setMessages(p => [...p, data.message]);
      setText('');
      setConversations(p => p.map(c =>
        c.id === activeId ? { ...c, lastMessage: text.trim(), lastMessageTime: new Date().toISOString() } : c
      ));
    } finally { setSending(false); }
  }

  const active = conversations.find(c => c.id === activeId);

  return (
    <div className="flex gap-4" style={{ height: 'calc(100vh - 3rem)' }}>

      {/* Conversation list */}
      <div className="w-64 panel flex flex-col shrink-0 overflow-hidden">
        <div className="px-4 py-4 border-b border-rim/40 shrink-0">
          <p className="label-xs">Messages</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map(c => {
            const isActive = c.id === activeId;
            const name = convoName(c, user);
            const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
            return (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`w-full text-left px-4 py-3.5 flex items-center gap-3 transition-colors border-l-2
                  ${isActive
                    ? 'bg-shell border-l-cyan'
                    : 'border-l-transparent hover:bg-shell/50'
                  }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-heading font-bold
                  ${isActive ? 'bg-cyan text-void' : 'bg-shell text-fog-hi'}`}>
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate leading-tight ${isActive ? 'text-ink' : 'text-fog-hi'}`}>
                    {name}
                  </p>
                  <p className="text-10 text-fog truncate mt-0.5">{c.lastMessage}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 panel flex flex-col overflow-hidden">
        {active ? (
          <>
            {/* Thread header */}
            <div className="px-5 py-3.5 border-b border-rim/40 shrink-0 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-cyan/20 border border-cyan/30 flex items-center justify-center shrink-0">
                <span className="text-xs font-heading font-bold text-cyan">
                  {convoName(active, user).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-heading font-bold text-ink text-sm leading-tight">{convoName(active, user)}</p>
                <p className="text-10 text-fog tracking-wide">
                  {active.type === 'group' ? `${active.memberDetails?.length ?? 0} members` : 'Direct message'}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              {messages.map(m => {
                const isMe = m.senderId === user.id;
                return (
                  <div key={m.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                    {!isMe && (
                      <div className="w-7 h-7 rounded-full bg-shell border border-rim flex items-center justify-center shrink-0 text-10 font-bold text-fog-hi">
                        {m.senderAvatar}
                      </div>
                    )}
                    <div className={`flex flex-col gap-1 max-w-sm ${isMe ? 'items-end' : 'items-start'}`}>
                      {!isMe && (
                        <p className="text-10 text-fog font-bold tracking-wide">{m.senderName}</p>
                      )}
                      <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed
                        ${isMe
                          ? 'bg-cyan text-void rounded-tr-sm font-medium'
                          : 'bg-shell text-ink border border-rim/60 rounded-tl-sm'
                        }`}>
                        {m.text}
                      </div>
                      <p className="text-10 text-fog">{format(parseISO(m.time), 'h:mm a')}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>

            {/* Input */}
            <form onSubmit={send} className="px-4 py-3 border-t border-rim/40 flex gap-3 items-center shrink-0">
              <input
                className="field flex-1 py-2"
                placeholder="Message…"
                value={text}
                onChange={e => setText(e.target.value)}
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={sending || !text.trim()}
                className="btn-primary px-5 py-2"
              >
                Send
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-fog text-sm">
            Select a conversation
          </div>
        )}
      </div>
    </div>
  );
}

function convoName(c, user) {
  if (c.type === 'group') return c.name;
  const other = c.memberDetails?.find(m => m.id !== user.id);
  return other?.name ?? 'Direct Message';
}
