import { useState, useEffect } from 'react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import api from '../lib/api.js';

const STATUS_STYLE = {
  pending:  { dot: 'bg-gold',     badge: 'bg-gold/10 border-gold/30 text-gold',         label: 'Pending'  },
  approved: { dot: 'bg-green-400', badge: 'bg-green-500/10 border-green-500/30 text-green-400', label: 'Approved' },
  denied:   { dot: 'bg-red-400',  badge: 'bg-red-500/10 border-red-500/30 text-red-400', label: 'Denied'   },
};

export default function TimeOff() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    api.get('/time-off')
      .then(r => setRequests(r.data.requests))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(form) {
    try {
      const { data } = await api.post('/time-off', form);
      setRequests(prev => [data.request, ...prev]);
      setShowForm(false);
    } catch (err) {
      return err.response?.data?.error || 'Failed to submit';
    }
  }

  async function handleCancel(id) {
    try {
      await api.delete(`/time-off/${id}`);
      setRequests(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

  const pending  = requests.filter(r => r.status === 'pending').length;
  const approved = requests.filter(r => r.status === 'approved').length;

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="label-xs mb-1">Employee</p>
          <h1 className="font-heading font-black text-ink text-3xl leading-none uppercase tracking-tight">
            Time Off
          </h1>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="btn-primary text-xs px-4 py-2"
        >
          {showForm ? 'Cancel' : '+ Request Time Off'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="panel px-5 py-3 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-gold" />
          <span className="text-sm text-fog-hi">{pending} pending</span>
        </div>
        <div className="panel px-5 py-3 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-sm text-fog-hi">{approved} approved</span>
        </div>
      </div>

      {/* New request form */}
      {showForm && (
        <TimeOffForm onSubmit={handleSubmit} onCancel={() => setShowForm(false)} />
      )}

      {/* Request list */}
      {loading ? (
        <p className="text-fog text-sm py-8 text-center">Loading…</p>
      ) : requests.length === 0 && !showForm ? (
        <div className="panel p-10 text-center">
          <p className="text-fog text-sm">No time off requests yet.</p>
          <p className="text-fog text-xs mt-1">Click "+ Request Time Off" to submit one.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {requests.map(req => {
            const s = STATUS_STYLE[req.status] ?? STATUS_STYLE.pending;
            const days = differenceInCalendarDays(parseISO(req.endDate), parseISO(req.startDate)) + 1;
            return (
              <div key={req.id} className="panel px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-ink text-sm">
                        {format(parseISO(req.startDate), 'MMM d')}
                        {req.startDate !== req.endDate && ` – ${format(parseISO(req.endDate), 'MMM d, yyyy')}`}
                        {req.startDate === req.endDate && `, ${format(parseISO(req.startDate), 'yyyy')}`}
                      </span>
                      <span className="text-10 text-fog">{days} day{days !== 1 ? 's' : ''}</span>
                    </div>
                    {req.reason && <p className="text-xs text-fog-hi">{req.reason}</p>}
                    {req.reviewNotes && (
                      <p className="text-xs text-fog mt-1 italic">"{req.reviewNotes}"</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`flex items-center gap-1.5 text-10 font-bold tracking-widest uppercase px-2 py-1 rounded-full border ${s.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                      {s.label}
                    </span>
                    {req.status === 'pending' && (
                      <button
                        onClick={() => handleCancel(req.id)}
                        className="p-1.5 rounded-md text-fog hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Cancel request"
                      >
                        <XIcon />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TimeOffForm({ onSubmit, onCancel }) {
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStart] = useState(today);
  const [endDate, setEnd]     = useState(today);
  const [reason, setReason]   = useState('');
  const [error, setError]     = useState('');
  const [saving, setSaving]   = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (endDate < startDate) { setError('End date must be on or after start date.'); return; }
    setSaving(true);
    setError('');
    const err = await onSubmit({ startDate, endDate, reason: reason.trim() || undefined });
    setSaving(false);
    if (err) setError(err);
  }

  return (
    <form onSubmit={submit} className="panel px-5 py-5 border border-dashed border-rim/60 flex flex-col gap-4">
      <p className="label-xs">New Request</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-10 text-fog uppercase tracking-widest">Start Date</label>
          <input type="date" className="field text-sm" value={startDate} min={today}
            onChange={e => { setStart(e.target.value); if (e.target.value > endDate) setEnd(e.target.value); }} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-10 text-fog uppercase tracking-widest">End Date</label>
          <input type="date" className="field text-sm" value={endDate} min={startDate}
            onChange={e => setEnd(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-10 text-fog uppercase tracking-widest">Reason (optional)</label>
        <textarea className="field text-sm resize-none" rows={2}
          placeholder="Vacation, personal time, appointment…"
          value={reason} onChange={e => setReason(e.target.value)} />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="btn-ghost text-xs px-4 py-1.5">Cancel</button>
        <button type="submit" disabled={saving} className="btn-primary text-xs px-4 py-1.5">
          {saving ? 'Submitting…' : 'Submit Request'}
        </button>
      </div>
    </form>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
