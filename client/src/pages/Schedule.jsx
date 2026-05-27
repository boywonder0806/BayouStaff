import { useState, useEffect } from 'react';
import {
  format, startOfWeek, endOfWeek, eachDayOfInterval,
  addWeeks, subWeeks, parseISO, isToday, isSameDay,
} from 'date-fns';
import api from '../lib/api.js';
import { fmt12 } from '../lib/time.js';
import { DEPT_COLOR } from '../components/Layout/Sidebar.jsx';

export default function Schedule() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [shifts, setShifts]       = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/schedule', {
      params: {
        startDate: format(weekStart, 'yyyy-MM-dd'),
        endDate:   format(endOfWeek(addWeeks(weekStart, 2)), 'yyyy-MM-dd'),
      },
    }).then(r => setShifts(r.data.shifts)).catch(console.error).finally(() => setLoading(false));
  }, [weekStart]);

  const week0 = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart) });
  const week1 = eachDayOfInterval({ start: addWeeks(weekStart, 1), end: endOfWeek(addWeeks(weekStart, 1)) });
  const week2 = eachDayOfInterval({ start: addWeeks(weekStart, 2), end: endOfWeek(addWeeks(weekStart, 2)) });

  function shiftsFor(day) {
    return shifts.filter(s => isSameDay(parseISO(s.date), day));
  }

  const thisWeekShifts = shifts.filter(s => {
    const d = parseISO(s.date);
    return d >= weekStart && d <= endOfWeek(weekStart);
  });
  const totalHours = thisWeekShifts.reduce((sum, s) => {
    const [sh, sm] = s.start.split(':').map(Number);
    const [eh, em] = s.end.split(':').map(Number);
    return sum + (eh + em / 60 - sh - sm / 60);
  }, 0);

  return (
    <div className="flex flex-col gap-5" style={{ height: 'calc(100vh - 3rem)', overflowY: 'auto' }}>

      {/* Header */}
      <div className="flex items-end justify-between shrink-0">
        <div>
          <p className="label-xs mb-1">Schedule</p>
          <h1 className="font-heading font-black text-ink text-4xl leading-none tracking-tight uppercase">
            {format(weekStart, 'MMM d')}
            <span className="text-fog"> – {format(endOfWeek(weekStart), 'MMM d, yyyy')}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 pb-1">
          <div className="flex gap-4 mr-4">
            <Kpi label="Shifts" value={thisWeekShifts.length} />
            <Kpi label="Hours" value={`${Number.isInteger(totalHours) ? totalHours : totalHours.toFixed(1)}h`} />
          </div>
          <button onClick={() => setWeekStart(w => subWeeks(w, 1))} className="btn-ghost px-3 py-1.5">‹</button>
          <button onClick={() => setWeekStart(startOfWeek(new Date()))} className="btn-ghost px-3 py-1.5 text-xs">
            This Week
          </button>
          <button onClick={() => setWeekStart(w => addWeeks(w, 1))} className="btn-ghost px-3 py-1.5">›</button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-fog text-sm">Loading…</div>
      ) : (
        <div className="space-y-5 pb-6">

          {/* ── Current week — full view ── */}
          <div className="panel p-4">
            <div className="grid grid-cols-7 gap-3">
              {week0.map((day, i) => {
                const ds    = shiftsFor(day);
                const today = isToday(day);
                return (
                  <div
                    key={i}
                    className={[
                      'flex flex-col rounded-xl p-3 min-h-36',
                      today
                        ? 'bg-cyan/10 border border-cyan/25'
                        : 'bg-shell/40 border border-rim/30',
                    ].join(' ')}
                  >
                    {/* Day label */}
                    <div className="mb-3 flex flex-col items-start">
                      <p className="text-10 font-bold tracking-widest uppercase text-fog">
                        {format(day, 'EEE')}
                      </p>
                      <span className={[
                        'w-7 h-7 flex items-center justify-center rounded-full text-sm font-heading font-bold mt-1',
                        today ? 'bg-cyan text-void' : 'text-ink',
                      ].join(' ')}>
                        {format(day, 'd')}
                      </span>
                    </div>

                    {/* Shift cards */}
                    {ds.length === 0 ? (
                      <p className="text-10 text-fog/40 italic mt-auto">Off</p>
                    ) : (
                      <div className="space-y-2 flex-1">
                        {ds.map(s => {
                          const dc = DEPT_COLOR[s.department];
                          return (
                            <div key={s.id} className="relative rounded-lg p-2 pl-3 bg-deep overflow-hidden">
                              <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${dc?.bar ?? 'bg-cyan'}`} />
                              <p className="text-10 text-fog font-semibold truncate">{s.department}</p>
                              <p className="text-xs font-bold text-ink leading-snug">{fmt12(s.start)}</p>
                              <p className="text-10 text-fog leading-snug">– {fmt12(s.end)}</p>
                              {s.position && (
                                <p className="text-10 text-fog-hi truncate mt-0.5">{s.position}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Next 2 weeks preview ── */}
          <div>
            <p className="label-xs mb-3">Upcoming Preview</p>
            <div className="space-y-3">
              {[week1, week2].map((weekDays, wi) => (
                <div key={wi} className="panel p-4">
                  <p className="text-xs font-semibold text-fog-hi mb-4">
                    {format(weekDays[0], 'MMMM d')}
                    <span className="text-fog"> – {format(weekDays[6], 'MMMM d')}</span>
                  </p>
                  <div className="grid grid-cols-7 gap-2">
                    {weekDays.map((day, i) => {
                      const ds = shiftsFor(day);
                      return (
                        <div key={i} className="flex flex-col items-center">
                          <p className="text-10 text-fog tracking-wide font-medium">{format(day, 'EEE')}</p>
                          <p className="text-xs text-fog-hi font-semibold mt-0.5">{format(day, 'd')}</p>
                          <div className="mt-2 w-full space-y-1">
                            {ds.length === 0 ? (
                              <div className="h-1 rounded-full bg-rim/30" />
                            ) : (
                              ds.map(s => {
                                const dc = DEPT_COLOR[s.department];
                                return (
                                  <div key={s.id} className={`h-1.5 rounded-full ${dc?.bar ?? 'bg-cyan'}`} />
                                );
                              })
                            )}
                          </div>
                          {ds.length > 0 && (
                            <p className="text-10 text-fog mt-1.5 text-center leading-tight">
                              {fmt12(ds[0].start)}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
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
