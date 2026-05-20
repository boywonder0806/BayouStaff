import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import api from '../../../lib/api.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { DEPT_COLOR } from '../../../components/Layout/Sidebar.jsx';

const SCHEDULABLE_DEPTS = ['Aquatics', 'Food & Beverage', 'Guest Services', 'Cleaning Crew'];

function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
}

export default function OpenShiftsAdmin() {
  const { user } = useAuth();
  const [shifts, setShifts]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter]     = useState('open');

  const availableDepts = user?.role === 'sysadmin'
    ? SCHEDULABLE_DEPTS
    : SCHEDULABLE_DEPTS.filter(d => user?.departments?.includes(d));

  useEffect(() => {
    api.get('/admin/open-shifts')
      .then(r => setShifts(r.data.shifts))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handlePost(form) {
    try {
      const { data } = await api.post('/admin/open-shifts', form);
      setShifts(prev => [...prev, data.shift].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)));
      setShowForm(false);
    } catch (err) {
      return err.response?.data?.error || 'Failed to post shift';
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/admin/open-shifts/${id}`);
      setShifts(prev => prev.filter(s => s.id !== id));
    } catch (err) { console.error(err); }
  }

  const open   = shifts.filter(s => !s.claimedBy);
  const claimed = shifts.filter(s => s.claimedBy);
  const visible = filter === 'open' ? open : filter === 'claimed' ? claimed : shifts;

  return (
    <div className="flex flex-col gap-5" style={{ height: 'calc(100vh - 3rem)' }}>

      {/* Header */}
      <div className="flex items-end justify-between shrink-0">
        <div>
          <p className="label-xs mb-1">Staff Management / Open Shifts</p>
          <h1 className="font-heading font-black text-ink text-3xl leading-none uppercase tracking-tight">
            Open Shifts
          </h1>
        </div>
        <button
          onClick={() => { setShowForm(s => !s); }}
          className="btn-primary text-xs px-4 py-2"
        >
          {showForm ? 'Cancel' : '+ Post Open Shift'}
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-1 shrink-0">
        {[['open', `Open (${open.length})`], ['claimed', `Claimed (${claimed.length})`], ['all', `All (${shifts.length})`]].map(([val, lbl]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold tracking-wide border transition-all
              ${filter === val ? 'bg-shell border-rim/80 text-ink' : 'border-transparent text-fog hover:text-fog-hi'}`}>
            {lbl}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3">
        {showForm && (
          <PostShiftForm
            depts={availableDepts}
            onPost={handlePost}
            onCancel={() => setShowForm(false)}
          />
        )}

        {loading ? (
          <p className="text-fog text-sm py-8 text-center">Loading…</p>
        ) : visible.length === 0 && !showForm ? (
          <div className="panel p-10 text-center">
            <p className="text-fog text-sm">No {filter} shifts.</p>
          </div>
        ) : (
          visible.map(shift => {
            const dc = DEPT_COLOR[shift.department] ?? { bar: 'bg-fog', text: 'text-fog', ring: 'border-fog/30' };
            return (
              <div key={shift.id} className="panel px-5 py-4 flex items-start gap-3">
                <div className={`w-0.5 self-stretch rounded-full ${dc.bar} shrink-0 mt-1`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className={`text-xs font-bold ${dc.text}`}>{shift.department}</span>
                    {shift.position && (
                      <span className="text-10 text-fog bg-shell border border-rim/40 rounded px-1.5 py-0.5">{shift.position}</span>
                    )}
                    {shift.claimedBy && (
                      <span className="text-10 text-green-400 bg-green-500/10 border border-green-500/30 rounded px-1.5 py-0.5 font-bold">
                        Claimed by {shift.claimedByName}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-ink">
                    {format(parseISO(shift.date), 'EEE, MMM d')} · {fmtTime(shift.start)} – {fmtTime(shift.end)}
                  </p>
                  {shift.notes && <p className="text-xs text-fog mt-0.5">{shift.notes}</p>}
                </div>
                {!shift.claimedBy && (
                  <button
                    onClick={() => handleDelete(shift.id)}
                    className="p-1.5 rounded-md text-fog hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                    title="Remove"
                  >
                    <TrashIcon />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function PostShiftForm({ depts, onPost, onCancel }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate]     = useState(today);
  const [start, setStart]   = useState('09:00');
  const [end, setEnd]       = useState('17:00');
  const [dept, setDept]     = useState(depts[0] || '');
  const [position, setPos]  = useState('');
  const [notes, setNotes]   = useState('');
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!dept) { setError('Department is required.'); return; }
    setSaving(true);
    setError('');
    const err = await onPost({ date, start, end, department: dept, position: position || undefined, notes: notes || undefined });
    setSaving(false);
    if (err) setError(err);
  }

  return (
    <form onSubmit={submit} className="panel px-5 py-4 border border-dashed border-rim/60 flex flex-col gap-3">
      <p className="label-xs">New Open Shift</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-10 text-fog uppercase tracking-widest">Date</label>
          <input type="date" className="field text-sm" value={date} min={today} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-10 text-fog uppercase tracking-widest">Department</label>
          <select className="field text-sm" value={dept} onChange={e => setDept(e.target.value)}>
            {depts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-10 text-fog uppercase tracking-widest">Start</label>
          <input type="time" className="field text-sm" value={start} onChange={e => setStart(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-10 text-fog uppercase tracking-widest">End</label>
          <input type="time" className="field text-sm" value={end} onChange={e => setEnd(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-10 text-fog uppercase tracking-widest">Position (optional)</label>
          <input className="field text-sm" placeholder="e.g. Tower 1" value={position} onChange={e => setPos(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-10 text-fog uppercase tracking-widest">Notes (optional)</label>
          <input className="field text-sm" placeholder="Any details…" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="btn-ghost text-xs px-4 py-1.5">Cancel</button>
        <button type="submit" disabled={saving} className="btn-primary text-xs px-4 py-1.5">
          {saving ? 'Posting…' : 'Post Shift'}
        </button>
      </div>
    </form>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}
