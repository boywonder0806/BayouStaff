import { useState, useEffect } from 'react';
import {
  format, startOfWeek, endOfWeek, eachDayOfInterval,
  addWeeks, subWeeks, parseISO, isToday, isSameDay,
} from 'date-fns';
import api from '../lib/api.js';
import { fmt12 } from '../lib/time.js';
import { DEPT_COLOR } from '../components/Layout/Sidebar.jsx';

export default function Schedule() {
  const [weekStart, setWeekStart]   = useState(() => startOfWeek(new Date()));
  const [shifts, setShifts]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selectedShift, setSelected] = useState(null);

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

      {/* Shift detail modal */}
      {selectedShift && (
        <ShiftModal shift={selectedShift} onClose={() => setSelected(null)} />
      )}

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
                            <button
                              key={s.id}
                              onClick={() => setSelected(s)}
                              className="relative w-full text-left rounded-lg p-2 pl-3 bg-deep overflow-hidden hover:bg-shell transition-colors"
                            >
                              <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${dc?.bar ?? 'bg-cyan'}`} />
                              <p className="text-10 text-fog font-semibold truncate">{s.department}</p>
                              <p className="text-xs font-bold text-ink leading-snug">{fmt12(s.start)}</p>
                              <p className="text-10 text-fog leading-snug">– {fmt12(s.end)}</p>
                              {s.position && (
                                <p className="text-10 text-fog-hi truncate mt-0.5">{s.position}</p>
                              )}
                            </button>
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
                      const hasShift = ds.length > 0;
                      return (
                        <button
                          key={i}
                          disabled={!hasShift}
                          onClick={() => hasShift && setSelected(ds[0])}
                          className={[
                            'flex flex-col items-center rounded-lg py-1 px-0.5 w-full transition-colors',
                            hasShift ? 'cursor-pointer hover:bg-shell/60' : 'cursor-default',
                          ].join(' ')}
                        >
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
                          {hasShift && (
                            <p className="text-10 text-fog mt-1.5 text-center leading-tight">
                              {fmt12(ds[0].start)}
                            </p>
                          )}
                        </button>
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

function ShiftModal({ shift, onClose }) {
  const dc = DEPT_COLOR[shift.department];

  const [sh, sm] = shift.start.split(':').map(Number);
  const [eh, em] = shift.end.split(':').map(Number);
  const duration = eh + em / 60 - sh - sm / 60;
  const durationStr = Number.isInteger(duration) ? `${duration}h` : `${duration.toFixed(1)}h`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-void/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm mx-4 bg-deep border border-rim/60 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-6 py-5 border-b border-rim/40 overflow-hidden">
          <div className={`absolute left-0 top-0 bottom-0 w-1 ${dc?.bar ?? 'bg-cyan'}`} />
          <div className="flex items-start justify-between">
            <div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-10 font-bold tracking-widest uppercase border bg-shell/60 ${dc?.ring ?? 'border-cyan/20'} ${dc?.text ?? 'text-cyan'}`}>
                {shift.department}
              </span>
              <p className="font-heading font-black text-ink text-xl leading-tight mt-2">
                {format(parseISO(shift.date), 'EEEE, MMMM d')}
              </p>
              <p className="text-sm text-fog mt-0.5">{format(parseISO(shift.date), 'yyyy')}</p>
            </div>
            <button
              onClick={onClose}
              className="text-fog hover:text-ink text-2xl leading-none ml-4 mt-0.5 shrink-0"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Time */}
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-shell border border-rim flex items-center justify-center shrink-0">
              <ClockIcon />
            </span>
            <div>
              <p className="text-sm font-bold text-ink">
                {fmt12(shift.start)} – {fmt12(shift.end)}
              </p>
              <p className="text-10 text-fog">{durationStr} shift</p>
            </div>
          </div>

          {/* Position */}
          {shift.position && (
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-shell border border-rim flex items-center justify-center shrink-0">
                <BadgeIcon />
              </span>
              <div>
                <p className="text-sm font-bold text-ink">{shift.position}</p>
                <p className="text-10 text-fog">Position</p>
              </div>
            </div>
          )}

          {/* Location */}
          {shift.location && (
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-shell border border-rim flex items-center justify-center shrink-0">
                <PinIcon />
              </span>
              <div>
                <p className="text-sm font-bold text-ink">{shift.location}</p>
                <p className="text-10 text-fog">Location</p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 flex gap-3">
          <button
            onClick={onClose}
            className="btn-ghost border border-rim/60 rounded-md flex-1 py-2.5 text-sm"
          >
            Close
          </button>
          <button
            onClick={() => {}}
            className="btn-primary flex-1 py-2.5 text-sm"
          >
            Manage Shift
          </button>
        </div>
      </div>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-fog">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function BadgeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-fog">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <line x1="12" y1="12" x2="12" y2="16" />
      <line x1="10" y1="14" x2="14" y2="14" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-fog">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
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
