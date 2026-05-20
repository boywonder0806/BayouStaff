import { useState, useEffect, useCallback } from 'react';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import api from '../lib/api.js';

const STATUS_STYLE = {
  open:     { dot: 'bg-cyan',      badge: 'bg-cyan/10 border-cyan/30 text-cyan',           label: 'Open'     },
  closed:   { dot: 'bg-fog',       badge: 'bg-shell border-rim/50 text-fog',                label: 'Closed'   },
  approved: { dot: 'bg-green-400', badge: 'bg-green-500/10 border-green-500/30 text-green-400', label: 'Approved' },
};

function fmtDuration(clockIn, clockOut) {
  if (!clockOut) return null;
  const mins = differenceInMinutes(new Date(clockOut), new Date(clockIn));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function Timecards() {
  const [timecards, setTimecards] = useState([]);
  const [openCard, setOpenCard]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [working, setWorking]     = useState(false);
  const [elapsed, setElapsed]     = useState('');

  const fetchStatus = useCallback(() => {
    return api.get('/timecards/status').then(r => setOpenCard(r.data.open));
  }, []);

  useEffect(() => {
    Promise.all([
      api.get('/timecards').then(r => setTimecards(r.data.timecards)),
      fetchStatus(),
    ]).catch(console.error).finally(() => setLoading(false));
  }, [fetchStatus]);

  useEffect(() => {
    if (!openCard) { setElapsed(''); return; }
    const tick = () => {
      const mins = differenceInMinutes(new Date(), new Date(openCard.clockIn));
      const h = Math.floor(mins / 60), m = mins % 60;
      setElapsed(h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [openCard]);

  async function clockIn() {
    setWorking(true);
    try {
      const { data } = await api.post('/timecards/clock-in');
      setOpenCard({ id: data.timecard.id, clockIn: data.timecard.clockIn });
    } catch (err) {
      alert(err.response?.data?.error || 'Unable to clock in.');
    } finally {
      setWorking(false);
    }
  }

  async function clockOut() {
    setWorking(true);
    try {
      const { data } = await api.patch('/timecards/clock-out');
      setOpenCard(null);
      setTimecards(prev => [data.timecard, ...prev.filter(tc => tc.id !== data.timecard.id)]);
    } catch (err) {
      alert(err.response?.data?.error || 'Unable to clock out.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-5">

      {/* Header */}
      <div>
        <p className="label-xs mb-1">Employee</p>
        <h1 className="font-heading font-black text-ink text-3xl leading-none uppercase tracking-tight">
          Timecards
        </h1>
      </div>

      {/* Clock in/out panel */}
      <div className={`panel px-6 py-6 flex items-center gap-5 border
        ${openCard ? 'border-cyan/30 bg-cyan/5' : 'border-rim/40'}`}>
        <div className={`w-3 h-3 rounded-full shrink-0 ${openCard ? 'bg-cyan animate-pulse' : 'bg-fog/40'}`} />
        <div className="flex-1 min-w-0">
          {openCard ? (
            <>
              <p className="text-sm font-bold text-cyan">Clocked In</p>
              <p className="text-xs text-fog-hi mt-0.5">
                Since {format(new Date(openCard.clockIn), 'h:mm a')} · {elapsed}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-ink">Not Clocked In</p>
              <p className="text-xs text-fog mt-0.5">Click to start tracking your hours.</p>
            </>
          )}
        </div>
        <button
          onClick={openCard ? clockOut : clockIn}
          disabled={working || loading}
          className={`shrink-0 px-5 py-2.5 rounded-lg text-xs font-bold tracking-wide border transition-all
            ${openCard
              ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
              : 'btn-primary'
            }
            ${(working || loading) ? 'opacity-60 cursor-wait' : ''}`}
        >
          {working ? '…' : openCard ? 'Clock Out' : 'Clock In'}
        </button>
      </div>

      {/* History */}
      <div>
        <p className="label-xs mb-3">Recent History</p>
        {loading ? (
          <p className="text-fog text-sm py-4 text-center">Loading…</p>
        ) : timecards.length === 0 ? (
          <div className="panel p-8 text-center">
            <p className="text-fog text-sm">No timecards yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {timecards.map(tc => {
              const s = STATUS_STYLE[tc.status] ?? STATUS_STYLE.closed;
              const duration = fmtDuration(tc.clockIn, tc.clockOut);
              return (
                <div key={tc.id} className="panel px-5 py-3.5 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink">
                      {format(parseISO(tc.date), 'EEE, MMM d')}
                    </p>
                    <p className="text-xs text-fog-hi mt-0.5">
                      {format(new Date(tc.clockIn), 'h:mm a')}
                      {tc.clockOut ? ` – ${format(new Date(tc.clockOut), 'h:mm a')}` : ' → still open'}
                      {duration && <span className="ml-2 text-fog">({duration})</span>}
                    </p>
                  </div>
                  <span className={`flex items-center gap-1.5 text-10 font-bold tracking-widest uppercase px-2 py-1 rounded-full border shrink-0 ${s.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
