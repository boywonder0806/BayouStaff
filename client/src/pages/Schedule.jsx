import { useState, useEffect } from 'react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth, isSameDay,
  addMonths, subMonths, parseISO, isToday,
} from 'date-fns';
import api from '../lib/api.js';
import { fmt12 } from '../lib/time.js';
import { DEPT_COLOR } from '../components/Layout/Sidebar.jsx';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Schedule() {
  const [month, setMonth]         = useState(() => new Date());
  const [shifts, setShifts]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get('/schedule', {
      params: {
        startDate: format(startOfMonth(month), 'yyyy-MM-dd'),
        endDate:   format(endOfMonth(month),   'yyyy-MM-dd'),
      },
    }).then(r => setShifts(r.data.shifts)).catch(console.error).finally(() => setLoading(false));
  }, [month]);

  const calDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month)),
    end:   endOfWeek(endOfMonth(month)),
  });

  const totalHours = shifts.reduce((sum, s) => {
    const [sh, sm] = s.start.split(':').map(Number);
    const [eh, em] = s.end.split(':').map(Number);
    return sum + (eh + em / 60 - sh - sm / 60);
  }, 0);

  function dayShifts(day) {
    return shifts.filter(s => isSameDay(parseISO(s.date), day));
  }

  const selectedShifts = selected ? dayShifts(selected) : [];

  return (
    <div className="flex flex-col gap-5" style={{ height: 'calc(100vh - 3rem)' }}>

      {/* Header row */}
      <div className="flex items-end justify-between shrink-0">
        <div>
          <p className="label-xs mb-1">Schedule</p>
          <h1 className="font-heading font-black text-ink text-4xl leading-none tracking-tight uppercase">
            {format(month, 'MMMM')}{' '}
            <span className="text-fog">{format(month, 'yyyy')}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 pb-1">
          {/* Stats */}
          <div className="flex gap-4 mr-4">
            <Kpi label="Shifts" value={shifts.length} />
            <Kpi label="Hours" value={`${Number.isInteger(totalHours) ? totalHours : totalHours.toFixed(1)}h`} />
            <Kpi label="Days" value={new Set(shifts.map(s => s.date)).size} />
          </div>
          <button onClick={() => { subMonth(); }} className="btn-ghost px-3 py-1.5">‹</button>
          <button onClick={() => { setMonth(new Date()); setSelected(null); }} className="btn-ghost px-3 py-1.5 text-xs">Today</button>
          <button onClick={() => { addMonth(); }} className="btn-ghost px-3 py-1.5">›</button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* Calendar */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map(d => (
              <div key={d} className="label-xs text-center py-2">{d}</div>
            ))}
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center text-fog text-sm">Loading…</div>
          ) : (
            <div
              className="flex-1 grid grid-cols-7"
              style={{ gap: '2px', gridAutoRows: '1fr' }}
            >
              {calDays.map((day, i) => {
                const ds       = dayShifts(day);
                const inMonth  = isSameMonth(day, month);
                const today    = isToday(day);
                const sel      = selected && isSameDay(day, selected);
                const hasShift = ds.length > 0;

                return (
                  <div
                    key={i}
                    onClick={() => hasShift && setSelected(sel ? null : day)}
                    className={[
                      'relative flex flex-col rounded-md p-1.5 transition-all duration-150 overflow-hidden',
                      inMonth ? 'bg-deep' : 'bg-void',
                      sel ? 'ring-1 ring-cyan ring-inset' : '',
                      hasShift && !sel ? 'cursor-pointer hover:bg-shell' : '',
                    ].join(' ')}
                    style={sel ? { boxShadow: '0 0 0 1px #29ABE2, inset 0 0 20px rgba(41,171,226,0.06)' } : {}}
                  >
                    {/* Day number */}
                    <div className="flex justify-end mb-1">
                      <span className={[
                        'w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold',
                        today
                          ? 'bg-cyan text-void'
                          : inMonth ? 'text-ink' : 'text-fog/30',
                      ].join(' ')}>
                        {format(day, 'd')}
                      </span>
                    </div>

                    {/* Shift bars */}
                    <div className="space-y-0.5 overflow-hidden">
                      {ds.slice(0, 3).map(s => {
                        const dc = DEPT_COLOR[s.department];
                        return (
                          <div
                            key={s.id}
                            className={`h-1.5 rounded-full ${dc?.bar ?? 'bg-cyan'}`}
                          />
                        );
                      })}
                    </div>

                    {/* Shift time label (small) */}
                    {ds.length > 0 && (
                      <p className="text-10 text-fog-hi mt-1 leading-none truncate">
                        {fmt12(ds[0].start)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="w-60 shrink-0 flex flex-col gap-3">
          <div className="panel flex-1 overflow-y-auto p-4">
            {selected ? (
              <DayDetail day={selected} shifts={selectedShifts} onClose={() => setSelected(null)} />
            ) : (
              <MonthSummary shifts={shifts} />
            )}
          </div>

          {/* Legend */}
          {shifts.length > 0 && (
            <div className="panel p-4 shrink-0">
              <p className="label-xs mb-3">Departments</p>
              <div className="space-y-2">
                {[...new Set(shifts.map(s => s.department))].map(d => {
                  const dc = DEPT_COLOR[d];
                  return (
                    <div key={d} className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-sm ${dc?.bar ?? 'bg-cyan'}`} />
                      <span className="text-xs text-fog-hi">{d}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  function subMonth() { setMonth(m => subMonths(m, 1)); setSelected(null); }
  function addMonth() { setMonth(m => addMonths(m, 1)); setSelected(null); }
}

function DayDetail({ day, shifts, onClose }) {
  return (
    <>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="label-xs mb-1">{format(day, 'EEEE')}</p>
          <p className="font-heading font-bold text-ink text-lg leading-tight">
            {format(day, 'MMMM d')}
          </p>
        </div>
        <button onClick={onClose} className="text-fog hover:text-ink text-xl leading-none mt-0.5">×</button>
      </div>

      {shifts.length === 0 ? (
        <p className="text-fog text-sm">No shifts.</p>
      ) : (
        <div className="space-y-4">
          {shifts.map(s => {
            const dc = DEPT_COLOR[s.department];
            return (
              <div
                key={s.id}
                className="panel-raised p-4 relative overflow-hidden"
                style={{ boxShadow: `0 0 20px ${dc?.glow ?? 'transparent'}` }}
              >
                <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${dc?.bar ?? 'bg-cyan'}`} />
                <p className="label-xs mb-2">{s.department}</p>
                <p className="num-display text-3xl text-ink">{fmt12(s.start)}</p>
                <p className="num-display text-xl text-fog">– {fmt12(s.end)}</p>
                <div className="mt-3 space-y-1">
                  <p className="text-xs text-ink font-semibold">{s.position}</p>
                  <p className="text-xs text-fog">📍 {s.location}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function MonthSummary({ shifts }) {
  if (shifts.length === 0) {
    return <p className="text-fog text-sm">No shifts this month.</p>;
  }
  return (
    <>
      <p className="label-xs mb-4">This month</p>
      <div className="space-y-3">
        {[...shifts].sort((a, b) => a.date.localeCompare(b.date)).map(s => {
          const dc = DEPT_COLOR[s.department];
          return (
            <div key={s.id} className="flex items-center gap-2.5">
              <div className={`w-0.5 h-7 rounded-full shrink-0 ${dc?.bar ?? 'bg-cyan'}`} />
              <div>
                <p className="text-xs font-semibold text-ink">{format(parseISO(s.date), 'EEE d')}</p>
                <p className="text-10 text-fog tracking-wide">{fmt12(s.start)}–{fmt12(s.end)} · {s.location}</p>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Kpi({ label, value }) {
  return (
    <div className="text-right">
      <p className="num-display text-xl text-ink leading-none">{value}</p>
      <p className="label-xs mt-0.5">{label}</p>
    </div>
  );
}
