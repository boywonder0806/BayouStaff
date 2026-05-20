import { useState, useEffect } from 'react';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import api from '../../../lib/api.js';

const STATUS_STYLE = {
  open:     { dot: 'bg-cyan',      badge: 'bg-cyan/10 border-cyan/30 text-cyan',                 label: 'Open'     },
  closed:   { dot: 'bg-fog',       badge: 'bg-shell border-rim/50 text-fog',                      label: 'Closed'   },
  approved: { dot: 'bg-green-400', badge: 'bg-green-500/10 border-green-500/30 text-green-400',   label: 'Approved' },
};

function fmtDuration(clockIn, clockOut) {
  if (!clockOut) return '—';
  const mins = differenceInMinutes(new Date(clockOut), new Date(clockIn));
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function TimecardsAdmin() {
  const [timecards, setTimecards] = useState([]);
  const [loading, setLoading]     = useState(true);
  const today = new Date().toISOString().slice(0, 10);
  const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(twoWeeksAgo);
  const [to, setTo]     = useState(today);
  const [filter, setFilter] = useState('all');

  function load() {
    setLoading(true);
    api.get(`/admin/timecards?from=${from}&to=${to}`)
      .then(r => setTimecards(r.data.timecards))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function approve(id) {
    try {
      const { data } = await api.patch(`/admin/timecards/${id}/approve`);
      setTimecards(prev => prev.map(tc => tc.id === id ? { ...tc, status: data.timecard.status } : tc));
    } catch (err) { console.error(err); }
  }

  const visible = filter === 'all' ? timecards : timecards.filter(tc => tc.status === filter);

  const totalHours = timecards
    .filter(tc => tc.clockOut)
    .reduce((sum, tc) => sum + differenceInMinutes(new Date(tc.clockOut), new Date(tc.clockIn)) / 60, 0);

  return (
    <div className="flex flex-col gap-5" style={{ height: 'calc(100vh - 3rem)' }}>

      {/* Header */}
      <div className="flex items-end justify-between shrink-0">
        <div>
          <p className="label-xs mb-1">Staff Management / Timecards</p>
          <h1 className="font-heading font-black text-ink text-3xl leading-none uppercase tracking-tight">
            Timecards
          </h1>
        </div>
        <span className="text-10 text-fog pb-1">{totalHours.toFixed(1)}h total in range</span>
      </div>

      {/* Date filter */}
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-10 text-fog uppercase tracking-widest">From</label>
          <input type="date" className="field text-xs" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-10 text-fog uppercase tracking-widest">To</label>
          <input type="date" className="field text-xs" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <button onClick={load} className="btn-ghost border border-rim/60 rounded-md px-3 py-1.5 text-xs font-bold">
          Apply
        </button>
        <div className="flex gap-1 ml-auto">
          {['all', 'open', 'closed', 'approved'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all capitalize
                ${filter === f ? 'bg-shell border-rim/80 text-ink' : 'border-transparent text-fog hover:text-fog-hi'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <p className="text-fog text-sm py-8 text-center">Loading…</p>
        ) : visible.length === 0 ? (
          <div className="panel p-10 text-center">
            <p className="text-fog text-sm">No timecards in this range.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {visible.map(tc => {
              const s = STATUS_STYLE[tc.status] ?? STATUS_STYLE.closed;
              return (
                <div key={tc.id} className="panel px-5 py-3.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-shell border border-rim flex items-center justify-center text-xs font-heading font-bold text-fog-hi shrink-0">
                    {tc.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink">{tc.employeeName}</p>
                    <p className="text-xs text-fog-hi">
                      {format(parseISO(tc.date), 'EEE, MMM d')} ·{' '}
                      {format(new Date(tc.clockIn), 'h:mm a')}
                      {tc.clockOut ? ` – ${format(new Date(tc.clockOut), 'h:mm a')}` : ' → still open'}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-fog-hi shrink-0 tabular-nums">
                    {fmtDuration(tc.clockIn, tc.clockOut)}
                  </span>
                  <span className={`flex items-center gap-1.5 text-10 font-bold tracking-widest uppercase px-2 py-1 rounded-full border shrink-0 ${s.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                    {s.label}
                  </span>
                  {tc.status === 'closed' && (
                    <button
                      onClick={() => approve(tc.id)}
                      className="shrink-0 px-3 py-1.5 rounded-md text-xs font-bold bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 transition-colors"
                    >
                      Approve
                    </button>
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
