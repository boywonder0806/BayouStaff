import { useState, useEffect } from 'react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import api from '../../../lib/api.js';

const STATUS_STYLE = {
  pending:  { dot: 'bg-gold',      badge: 'bg-gold/10 border-gold/30 text-gold',                label: 'Pending'  },
  approved: { dot: 'bg-green-400', badge: 'bg-green-500/10 border-green-500/30 text-green-400', label: 'Approved' },
  denied:   { dot: 'bg-red-400',   badge: 'bg-red-500/10 border-red-500/30 text-red-400',       label: 'Denied'   },
};

const FILTERS = ['all', 'pending', 'approved', 'denied'];

export default function TimeOffAdmin() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('pending');
  const [reviewing, setReviewing] = useState(null);

  useEffect(() => {
    api.get('/admin/time-off')
      .then(r => setRequests(r.data.requests))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleReview(id, status, reviewNotes) {
    try {
      const { data } = await api.patch(`/admin/time-off/${id}`, { status, reviewNotes });
      setRequests(prev => prev.map(r =>
        r.id === id ? { ...r, status: data.request.status, reviewNotes: data.request.reviewNotes } : r
      ));
      setReviewing(null);
    } catch (err) {
      console.error(err);
    }
  }

  const visible = filter === 'all' ? requests : requests.filter(r => r.status === filter);
  const counts = { all: requests.length, pending: 0, approved: 0, denied: 0 };
  for (const r of requests) counts[r.status] = (counts[r.status] || 0) + 1;

  return (
    <div className="flex flex-col gap-5" style={{ height: 'calc(100vh - 3rem)' }}>

      {/* Header */}
      <div className="flex items-end justify-between shrink-0">
        <div>
          <p className="label-xs mb-1">Staff Management / Time Off</p>
          <h1 className="font-heading font-black text-ink text-3xl leading-none uppercase tracking-tight">
            Time Off Requests
          </h1>
        </div>
        {counts.pending > 0 && (
          <span className="px-3 py-1.5 rounded-full text-10 font-bold tracking-widest uppercase bg-gold/10 border border-gold/30 text-gold">
            {counts.pending} pending
          </span>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 shrink-0">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold tracking-wide border transition-all capitalize
              ${filter === f
                ? 'bg-shell border-rim/80 text-ink'
                : 'border-transparent text-fog hover:text-fog-hi'
              }`}
          >
            {f} {counts[f] > 0 && <span className="ml-1 opacity-70">({counts[f]})</span>}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <p className="text-fog text-sm py-8 text-center">Loading…</p>
        ) : visible.length === 0 ? (
          <div className="panel p-10 text-center">
            <p className="text-fog text-sm">No {filter === 'all' ? '' : filter} requests.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {visible.map(req => {
              const s = STATUS_STYLE[req.status] ?? STATUS_STYLE.pending;
              const days = differenceInCalendarDays(parseISO(req.endDate), parseISO(req.startDate)) + 1;
              const isReviewing = reviewing === req.id;

              return (
                <div key={req.id} className="panel px-5 py-4 flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-shell border border-rim flex items-center justify-center text-xs font-heading font-bold text-fog-hi shrink-0">
                      {req.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="font-semibold text-ink text-sm">{req.employeeName}</span>
                        <span className={`flex items-center gap-1 text-10 font-bold tracking-widest uppercase px-2 py-0.5 rounded-full border ${s.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                          {s.label}
                        </span>
                      </div>
                      <p className="text-xs text-fog-hi">
                        {format(parseISO(req.startDate), 'MMM d')}
                        {req.startDate !== req.endDate && ` – ${format(parseISO(req.endDate), 'MMM d, yyyy')}`}
                        {req.startDate === req.endDate && `, ${format(parseISO(req.startDate), 'yyyy')}`}
                        <span className="text-fog ml-2">({days} day{days !== 1 ? 's' : ''})</span>
                      </p>
                      {req.reason && <p className="text-xs text-fog mt-0.5">{req.reason}</p>}
                      {req.reviewNotes && <p className="text-xs text-fog mt-0.5 italic">Note: "{req.reviewNotes}"</p>}
                    </div>
                    {req.status === 'pending' && !isReviewing && (
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleReview(req.id, 'approved', '')}
                          className="px-3 py-1.5 rounded-md text-xs font-bold bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => setReviewing(req.id)}
                          className="px-3 py-1.5 rounded-md text-xs font-bold bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors"
                        >
                          Deny
                        </button>
                      </div>
                    )}
                  </div>

                  {isReviewing && (
                    <DenyForm
                      onConfirm={notes => handleReview(req.id, 'denied', notes)}
                      onCancel={() => setReviewing(null)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function DenyForm({ onConfirm, onCancel }) {
  const [notes, setNotes] = useState('');
  return (
    <div className="flex flex-col gap-2 pt-1 border-t border-rim/30">
      <textarea
        className="field text-xs resize-none"
        rows={2}
        placeholder="Optional note to the employee…"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        autoFocus
      />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="btn-ghost text-xs px-3 py-1.5">Cancel</button>
        <button
          onClick={() => onConfirm(notes.trim())}
          className="px-3 py-1.5 rounded-md text-xs font-bold bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors"
        >
          Confirm Deny
        </button>
      </div>
    </div>
  );
}
