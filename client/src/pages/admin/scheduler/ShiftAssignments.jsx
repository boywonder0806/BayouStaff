import { useState, useEffect, useRef } from 'react';
import { format, addWeeks, subWeeks, parseISO } from 'date-fns';
import api from '../../../lib/api.js';

const DEPT_CONFIG = {
  'Aquatics':        { color: 'text-aq',   bg: 'bg-aq/10',   border: 'border-aq/30',   bar: 'bg-aq'   },
  'Guest Services':  { color: 'text-gs',   bg: 'bg-gs/10',   border: 'border-gs/30',   bar: 'bg-gs'   },
  'Food & Beverage': { color: 'text-fb',   bg: 'bg-fb/10',   border: 'border-fb/30',   bar: 'bg-fb'   },
  'Cleaning Crew':   { color: 'text-cc',   bg: 'bg-cc/10',   border: 'border-cc/30',   bar: 'bg-cc'   },
  'Management':      { color: 'text-mgmt', bg: 'bg-mgmt/10', border: 'border-mgmt/30', bar: 'bg-mgmt' },
};

function getMondayOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export default function ShiftAssignments() {
  const [weekStart, setWeekStart]   = useState(getMondayOfWeek());
  const [employees, setEmployees]   = useState([]);
  const [shifts, setShifts]         = useState([]);
  const [rolesByDept, setRolesByDept] = useState({});
  const [activeDept, setActiveDept] = useState('All');
  const [saving, setSaving]         = useState(new Set());
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/admin/scheduler/plan?weekStart=${weekStart}`),
      api.get('/admin/departments/roles'),
    ])
      .then(([planRes, rolesRes]) => {
        setEmployees(planRes.data.employees);
        setShifts(planRes.data.shifts);
        const grouped = {};
        for (const r of rolesRes.data.roles) {
          if (!grouped[r.department]) grouped[r.department] = [];
          grouped[r.department].push(r);
        }
        setRolesByDept(grouped);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [weekStart]);

  async function handlePositionChange(shiftId, position) {
    setSaving(s => new Set(s).add(shiftId));
    setShifts(prev => prev.map(s => s.id === shiftId ? { ...s, position } : s));
    try {
      await api.patch(`/admin/scheduler/plan/shifts/${shiftId}`, { position });
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(s => { const n = new Set(s); n.delete(shiftId); return n; });
    }
  }

  const empMap = Object.fromEntries(employees.map(e => [e.id, e]));

  const weekEnd = new Date(weekStart + 'T00:00:00');
  weekEnd.setDate(weekEnd.getDate() + 6);

  function prevWeek() {
    setWeekStart(getMondayOfWeek(subWeeks(new Date(weekStart + 'T00:00:00'), 1)));
  }
  function nextWeek() {
    setWeekStart(getMondayOfWeek(addWeeks(new Date(weekStart + 'T00:00:00'), 1)));
  }

  // Departments that have shifts this week
  const activeDepts = Object.keys(DEPT_CONFIG).filter(d => shifts.some(s => s.department === d));
  const tabs = ['All', ...activeDepts];

  const visible = activeDept === 'All' ? shifts : shifts.filter(s => s.department === activeDept);

  const totalUnassigned = visible.filter(s => !s.position).length;

  // Group visible shifts by date
  const byDate = {};
  for (const s of visible) {
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  }
  const sortedDates = Object.keys(byDate).sort();

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 3rem)' }}>

      {/* Header */}
      <div className="shrink-0 mb-4">
        <p className="label-xs mb-1">Scheduler</p>
        <div className="flex items-end justify-between">
          <h1 className="font-heading font-black text-ink text-4xl leading-none uppercase tracking-tight">
            Shift Assignments
          </h1>
          <div className="flex items-center gap-2 pb-1">
            {!loading && visible.length > 0 && totalUnassigned > 0 && (
              <span className="text-10 font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-full tracking-widest uppercase">
                {totalUnassigned} unassigned
              </span>
            )}
            {!loading && visible.length > 0 && totalUnassigned === 0 && (
              <span className="text-10 font-bold text-green-400 bg-green-500/10 border border-green-500/30 px-2.5 py-1 rounded-full tracking-widest uppercase">
                All assigned
              </span>
            )}
            <div className="flex items-center gap-1">
              <button
                onClick={prevWeek}
                className="w-7 h-7 flex items-center justify-center rounded-md border border-rim/60 text-fog hover:text-ink hover:bg-shell transition-colors"
              >
                <ChevronLeftIcon />
              </button>
              <span className="text-xs font-semibold text-fog-hi px-2 min-w-[11rem] text-center">
                {format(parseISO(weekStart), 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
              </span>
              <button
                onClick={nextWeek}
                className="w-7 h-7 flex items-center justify-center rounded-md border border-rim/60 text-fog hover:text-ink hover:bg-shell transition-colors"
              >
                <ChevronRightIcon />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Department tabs */}
      <div className="flex items-center gap-2 shrink-0 mb-4 flex-wrap">
        {tabs.map(d => {
          const cfg = DEPT_CONFIG[d];
          const count = d === 'All' ? shifts.length : shifts.filter(s => s.department === d).length;
          const unassigned = d === 'All'
            ? shifts.filter(s => !s.position).length
            : shifts.filter(s => s.department === d && !s.position).length;
          const isActive = d === activeDept;
          return (
            <button
              key={d}
              onClick={() => setActiveDept(d)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold tracking-wide border transition-all
                ${isActive
                  ? cfg
                    ? `${cfg.bg} ${cfg.border} ${cfg.color}`
                    : 'bg-shell border-rim text-ink'
                  : 'bg-transparent border-rim/40 text-fog hover:text-fog-hi hover:border-rim/70'
                }`}
            >
              {d}
              <span className={`text-10 px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/10' : 'bg-shell/60'}`}>
                {count}
              </span>
              {unassigned > 0 && (
                <span className="text-10 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold">
                  {unassigned}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-5 pr-1">

        {loading && (
          <div className="flex items-center justify-center h-40">
            <span className="text-fog text-sm">Loading…</span>
          </div>
        )}

        {!loading && visible.length === 0 && (
          <div className="panel flex flex-col items-center justify-center h-40 gap-2">
            <p className="text-fog text-sm">No draft shifts for this week.</p>
            <p className="text-fog/60 text-xs">Use Plan Schedule or Auto-Schedule to generate shifts first, then come back here to assign positions.</p>
          </div>
        )}

        {!loading && sortedDates.map(date => {
          const dayShifts = [...byDate[date]].sort((a, b) => a.start.localeCompare(b.start));
          const dateObj = parseISO(date);
          const dayUnassigned = dayShifts.filter(s => !s.position).length;

          return (
            <div key={date}>
              {/* Day header */}
              <div className="flex items-center gap-3 mb-2">
                <span className="label-xs">{format(dateObj, 'EEEE, MMMM d')}</span>
                <span className="text-10 text-fog">{dayShifts.length} shift{dayShifts.length !== 1 ? 's' : ''}</span>
                {dayUnassigned > 0 && (
                  <span className="text-10 font-bold text-amber-400">{dayUnassigned} unassigned</span>
                )}
              </div>

              {/* Shifts table */}
              <div className="panel">
                <table className="w-full text-xs table-fixed">
                  <colgroup>
                    <col className="w-[32%]" />
                    <col className="w-[14%]" />
                    <col className="w-[20%]" />
                    <col />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-rim/40">
                      <th className="text-left py-2.5 px-4 text-10 font-bold tracking-widest uppercase text-fog">Employee</th>
                      <th className="text-left py-2.5 px-4 text-10 font-bold tracking-widest uppercase text-fog">Time</th>
                      <th className="text-left py-2.5 px-4 text-10 font-bold tracking-widest uppercase text-fog">Department</th>
                      <th className="text-left py-2.5 px-4 text-10 font-bold tracking-widest uppercase text-fog">Position</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayShifts.map(shift => {
                      const emp = empMap[shift.employeeId];
                      const cfg = DEPT_CONFIG[shift.department];
                      const roles = rolesByDept[shift.department] || [];
                      const isSaving = saving.has(shift.id);

                      return (
                        <tr
                          key={shift.id}
                          className={`border-b border-rim/20 last:border-0 hover:bg-shell/20 transition-colors ${isSaving ? 'opacity-60' : ''}`}
                        >
                          {/* Employee */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-shell border border-rim flex items-center justify-center text-10 font-heading font-bold text-fog-hi shrink-0">
                                {emp?.avatar || '?'}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-ink truncate">{emp?.name || 'Unknown'}</p>
                                <p className="text-10 text-fog truncate">{emp?.position || '—'}</p>
                              </div>
                            </div>
                          </td>

                          {/* Time */}
                          <td className="py-3 px-4">
                            <span className="font-mono text-fog-hi whitespace-nowrap">
                              {shift.start.slice(0, 5)}–{shift.end.slice(0, 5)}
                            </span>
                          </td>

                          {/* Department */}
                          <td className="py-3 px-4">
                            {cfg ? (
                              <span className={`inline-flex items-center text-10 font-bold tracking-wide px-2 py-1 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                                {shift.department}
                              </span>
                            ) : (
                              <span className="text-fog">{shift.department || '—'}</span>
                            )}
                          </td>

                          {/* Position dropdown */}
                          <td className="py-3 px-4">
                            <PositionSelect
                              value={shift.position}
                              roles={roles}
                              saving={isSaving}
                              onChange={pos => handlePositionChange(shift.id, pos)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Position dropdown ─────────────────────────────────────────────────────────
function PositionSelect({ value, roles, saving, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e) {
      if (!ref.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => !saving && setOpen(o => !o)}
        disabled={saving}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all min-w-[160px] max-w-[220px]
          ${value
            ? 'bg-shell/60 border-rim/60 text-ink hover:border-rim'
            : 'bg-amber-500/5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10'
          }
          ${saving ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
      >
        <span className="flex-1 text-left truncate">{value || '— Unassigned —'}</span>
        <ChevronDownIcon className={`shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 top-full mt-1 left-0 min-w-[200px] w-max max-w-[260px] bg-deep border border-rim/60 rounded-xl shadow-xl overflow-hidden">
          {/* Clear option */}
          <button
            onClick={() => { onChange(''); setOpen(false); }}
            className={`w-full text-left px-3 py-2 text-xs border-b border-rim/20 transition-colors hover:bg-shell/60
              ${!value ? 'bg-shell/40 text-ink font-semibold' : 'text-fog'}`}
          >
            — Unassigned —
          </button>

          {roles.length === 0 ? (
            <p className="text-10 text-fog px-3 py-2.5 italic">No positions configured.<br />Add them in SysAdmin → Departments.</p>
          ) : (
            roles.map(r => (
              <button
                key={r.id}
                onClick={() => { onChange(r.name); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-shell/60
                  ${value === r.name ? 'bg-shell/40 text-ink font-semibold' : 'text-fog-hi'}`}
              >
                {r.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
function ChevronDownIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`w-3 h-3 ${className}`}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
