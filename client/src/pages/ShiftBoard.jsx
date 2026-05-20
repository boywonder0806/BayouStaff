import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import api from '../lib/api.js';
import { DEPT_COLOR } from '../components/Layout/Sidebar.jsx';

function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
}

export default function ShiftBoard() {
  const [shifts, setShifts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [claimed, setClaimed] = useState(new Set());

  useEffect(() => {
    api.get('/shiftboard')
      .then(r => setShifts(r.data.shifts))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function claim(id) {
    try {
      await api.post(`/shiftboard/${id}/claim`);
      setClaimed(prev => new Set([...prev, id]));
      setShifts(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      alert(err.response?.data?.error || 'Unable to claim shift.');
    }
  }

  // Group by date
  const grouped = {};
  for (const s of shifts) {
    if (!grouped[s.date]) grouped[s.date] = [];
    grouped[s.date].push(s);
  }
  const dates = Object.keys(grouped).sort();

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-5">

      {/* Header */}
      <div>
        <p className="label-xs mb-1">Employee</p>
        <h1 className="font-heading font-black text-ink text-3xl leading-none uppercase tracking-tight">
          Shift Board
        </h1>
        <p className="text-sm text-fog-hi mt-1">Available open shifts you can claim.</p>
      </div>

      {claimed.size > 0 && (
        <div className="panel px-5 py-3 border-green-500/30 bg-green-500/5">
          <p className="text-sm text-green-400 font-semibold">
            {claimed.size} shift{claimed.size !== 1 ? 's' : ''} claimed — check your schedule for confirmation.
          </p>
        </div>
      )}

      {loading ? (
        <p className="text-fog text-sm py-8 text-center">Loading…</p>
      ) : dates.length === 0 ? (
        <div className="panel p-10 text-center">
          <p className="text-fog text-sm">No open shifts available right now.</p>
          <p className="text-fog text-xs mt-1">Check back later or ask your manager.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {dates.map(date => (
            <div key={date}>
              <p className="label-xs mb-2">{format(parseISO(date), 'EEEE, MMMM d')}</p>
              <div className="flex flex-col gap-2">
                {grouped[date].map(shift => {
                  const dc = DEPT_COLOR[shift.department] ?? { bar: 'bg-fog', text: 'text-fog', ring: 'border-fog/30' };
                  return (
                    <div key={shift.id} className={`panel px-5 py-4 flex items-center gap-4 border-l-2 ${dc.ring}`}>
                      <div className={`w-0.5 self-stretch rounded-full ${dc.bar} shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-xs font-bold ${dc.text}`}>{shift.department}</span>
                          {shift.position && (
                            <span className="text-10 text-fog bg-shell border border-rim/40 rounded px-1.5 py-0.5">
                              {shift.position}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-ink">
                          {fmtTime(shift.start)} – {fmtTime(shift.end)}
                        </p>
                        {shift.notes && <p className="text-xs text-fog mt-0.5">{shift.notes}</p>}
                      </div>
                      <button
                        onClick={() => claim(shift.id)}
                        className="shrink-0 btn-primary text-xs px-4 py-2"
                      >
                        Claim
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
