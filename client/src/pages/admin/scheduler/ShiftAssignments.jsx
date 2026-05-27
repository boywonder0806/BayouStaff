import { useState, useEffect, useMemo } from 'react';
import { format, addWeeks, subWeeks, parseISO } from 'date-fns';
import { useAuth } from '../../../context/AuthContext.jsx';
import api from '../../../lib/api.js';

const DEPT_CONFIG = {
  'Aquatics':        { color: 'text-aq',   bg: 'bg-aq/10',   border: 'border-aq/30'   },
  'Guest Services':  { color: 'text-gs',   bg: 'bg-gs/10',   border: 'border-gs/30'   },
  'Food & Beverage': { color: 'text-fb',   bg: 'bg-fb/10',   border: 'border-fb/30'   },
  'Cleaning Crew':   { color: 'text-cc',   bg: 'bg-cc/10',   border: 'border-cc/30'   },
};

const SCHEDULABLE_DEPTS = ['Aquatics', 'Guest Services', 'Food & Beverage', 'Cleaning Crew'];

function getMondayOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function getWeekDates(weekStart) {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export default function ShiftAssignments() {
  const { user } = useAuth();
  const [weekStart, setWeekStart]     = useState(getMondayOfWeek());
  const [employees, setEmployees]     = useState([]);
  const [shifts, setShifts]           = useState([]);
  const [rolesByDept, setRolesByDept] = useState({});
  const [loading, setLoading]         = useState(true);
  const [assigning, setAssigning]     = useState(null);
  const [saving, setSaving]           = useState(new Set());
  const [showAutoModal, setShowAutoModal] = useState(false);
  const [aiGenerating, setAiGenerating]   = useState(false);
  const [aiConfig, setAiConfig] = useState({
    departments: SCHEDULABLE_DEPTS,
    minHours: 16,
    maxHours: 40,
    shiftStart: '09:00',
    shiftEnd: '17:00',
  });

  const availableDepts = (!user || user.role === 'sysadmin')
    ? SCHEDULABLE_DEPTS
    : SCHEDULABLE_DEPTS.filter(d => user.departments?.includes(d));

  const [activeDept, setActiveDept] = useState(() => availableDepts[0] || SCHEDULABLE_DEPTS[0]);

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

  const weekEnd = new Date(weekStart + 'T00:00:00');
  weekEnd.setDate(weekEnd.getDate() + 6);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/admin/scheduler/plan?weekStart=${weekStart}`),
      api.get(`/admin/scheduler?weekStart=${weekStart}`),
      api.get('/admin/departments/roles'),
    ])
      .then(([planRes, publishedRes, rolesRes]) => {
        setEmployees(planRes.data.employees);
        // Merge draft + published shifts; mark each with a source flag
        const drafts    = planRes.data.shifts.map(s => ({ ...s, _source: 'draft' }));
        const published = publishedRes.data.shifts.map(s => ({ ...s, _source: 'published' }));
        // Avoid showing a published shift that also has a matching draft (same emp+date+pos)
        const draftKeys = new Set(drafts.map(s => `${s.employeeId}-${s.date}-${s.position}`));
        const filteredPublished = published.filter(s => !draftKeys.has(`${s.employeeId}-${s.date}-${s.position}`));
        setShifts([...drafts, ...filteredPublished]);
        const grouped = {};
        for (const r of rolesRes.data.roles) {
          if (r.type !== 'position') continue;
          if (!grouped[r.department]) grouped[r.department] = [];
          grouped[r.department].push(r);
        }
        setRolesByDept(grouped);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [weekStart]);

  function prevWeek() {
    setWeekStart(getMondayOfWeek(subWeeks(new Date(weekStart + 'T00:00:00'), 1)));
  }
  function nextWeek() {
    setWeekStart(getMondayOfWeek(addWeeks(new Date(weekStart + 'T00:00:00'), 1)));
  }

  const empMap = useMemo(() => Object.fromEntries(employees.map(e => [e.id, e])), [employees]);

  const positions = rolesByDept[activeDept] || [];

  const deptShifts = useMemo(
    () => shifts.filter(s => s.department === activeDept),
    [shifts, activeDept]
  );

  const deptEmployees = useMemo(
    () => employees.filter(e => (e.departments || []).includes(activeDept)),
    [employees, activeDept]
  );

  function getCell(positionName, date) {
    return deptShifts.filter(s => s.position === positionName && s.date === date);
  }

  async function assignEmployee(positionName, date, employeeId, start, end) {
    const tmpKey = `tmp-${Date.now()}`;
    setSaving(s => new Set(s).add(tmpKey));
    try {
      const { data } = await api.post('/admin/scheduler/plan/shifts', {
        employeeId, date, start, end,
        department: activeDept,
        position: positionName,
      });
      setShifts(prev => [...prev, data.shift]);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(s => { const n = new Set(s); n.delete(tmpKey); return n; });
    }
  }

  async function removeAssignment(shiftId) {
    setSaving(s => new Set(s).add(shiftId));
    setShifts(prev => prev.filter(s => s.id !== shiftId));
    try {
      await api.delete(`/admin/scheduler/plan/shifts/${shiftId}`);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(s => { const n = new Set(s); n.delete(shiftId); return n; });
    }
  }

  async function handleAutoSchedule() {
    if (!aiConfig.departments.length) return;
    setAiGenerating(true);
    try {
      const { data } = await api.post('/admin/scheduler/auto-schedule', {
        weekStart,
        ...aiConfig,
      });
      // Merge the newly generated draft shifts into state
      const newShifts = (data.shifts || []).map(s => ({ ...s, _source: 'draft' }));
      setShifts(prev => {
        const existingIds = new Set(prev.map(s => `${s._source}-${s.id}`));
        const fresh = newShifts.filter(s => !existingIds.has(`draft-${s.id}`));
        return [...prev, ...fresh];
      });
      setShowAutoModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setAiGenerating(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  // Count open (unfilled) slots: each position = 1 slot per day
  const openSlots = positions.reduce((sum, p) =>
    sum + weekDates.filter(d => getCell(p.name, d).length === 0).length, 0
  );

  const cfg = DEPT_CONFIG[activeDept];

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
            {!loading && openSlots > 0 && (
              <span className="text-10 font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-full tracking-widest uppercase">
                {openSlots} open slot{openSlots !== 1 ? 's' : ''}
              </span>
            )}
            {!loading && openSlots === 0 && positions.length > 0 && (
              <span className="text-10 font-bold text-green-400 bg-green-500/10 border border-green-500/30 px-2.5 py-1 rounded-full tracking-widest uppercase">
                Fully staffed
              </span>
            )}
            <button
              onClick={() => {
                setAiConfig(c => ({ ...c, departments: availableDepts }));
                setShowAutoModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all bg-violet-500/15 border-violet-500/40 text-violet-300 hover:bg-violet-500/25"
            >
              <SparkleIcon />
              Auto-Schedule
            </button>
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
        {availableDepts.map(d => {
          const dcfg = DEPT_CONFIG[d];
          const isActive = d === activeDept;
          return (
            <button
              key={d}
              onClick={() => setActiveDept(d)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold tracking-wide border transition-all
                ${isActive
                  ? `${dcfg.bg} ${dcfg.border} ${dcfg.color}`
                  : 'bg-transparent border-rim/40 text-fog hover:text-fog-hi hover:border-rim/70'
                }`}
            >
              {d}
              {(rolesByDept[d] || []).length > 0 && (
                <span className={`text-10 px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/10' : 'bg-shell/60'}`}>
                  {(rolesByDept[d] || []).length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div className="flex-1 min-h-0 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <span className="text-fog text-sm">Loading…</span>
          </div>
        ) : positions.length === 0 ? (
          <div className="panel flex flex-col items-center justify-center h-40 gap-2">
            <p className="text-fog text-sm">No positions configured for {activeDept}.</p>
            <p className="text-fog/60 text-xs">Add positions in SysAdmin → Departments.</p>
          </div>
        ) : (
          <div className="panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse" style={{ minWidth: '860px' }}>
                <thead>
                  <tr className="border-b border-rim/40">
                    <th
                      className="text-left py-3 px-4 text-10 font-bold tracking-widest uppercase text-fog bg-deep sticky left-0 z-10 border-r border-rim/30 min-w-[170px]"
                    >
                      Position
                    </th>
                    {weekDates.map(date => (
                      <th
                        key={date}
                        className={`py-3 px-2 text-center min-w-[108px] text-10 font-bold tracking-wide uppercase ${date === today ? 'text-cyan-400' : 'text-fog'}`}
                      >
                        <div>{format(parseISO(date), 'EEE')}</div>
                        <div className={`font-mono text-[11px] mt-0.5 ${date === today ? 'text-cyan-400' : 'text-fog-hi'}`}>
                          {format(parseISO(date), 'M/d')}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos, pi) => {
                    const hasOpen = weekDates.some(d => getCell(pos.name, d).length === 0);
                    return (
                      <tr key={pos.id} className={`border-b border-rim/20 last:border-0 ${pi % 2 !== 0 ? 'bg-shell/[0.03]' : ''}`}>

                        {/* Position label */}
                        <td className="py-3 px-4 align-top bg-deep sticky left-0 z-10 border-r border-rim/30">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-ink text-xs leading-tight">{pos.name}</span>
                            <div className="mt-0.5">
                              {hasOpen
                                ? <span className="text-[9px] font-bold text-amber-400 tracking-wide">⚠ open</span>
                                : <span className="text-[9px] text-green-400/60">✓ filled</span>
                              }
                            </div>
                            {pos.schedulingNotes && (
                              <p className="text-[9px] text-violet-400/60 leading-tight mt-0.5 line-clamp-2 max-w-[145px]">
                                {pos.schedulingNotes}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Day cells */}
                        {weekDates.map(date => {
                          const cellShifts = getCell(pos.name, date);
                          const isEmpty    = cellShifts.length === 0;
                          const isFilled   = cellShifts.length >= 1;

                          return (
                            <td
                              key={date}
                              className={`py-2 px-1.5 align-top transition-colors ${isEmpty ? 'bg-amber-500/[0.04]' : ''}`}
                            >
                              <div className="flex flex-col gap-1">
                                {cellShifts.map(shift => {
                                  const emp = empMap[shift.employeeId];
                                  const isPublished = shift._source === 'published';
                                  return (
                                    <div
                                      key={`${shift._source}-${shift.id}`}
                                      className={`flex items-center gap-1 rounded px-1.5 py-1 group border ${
                                        isPublished
                                          ? 'bg-shell/40 border-rim/20'
                                          : 'bg-shell/80 border-rim/40'
                                      }`}
                                    >
                                      <div className="w-4 h-4 rounded-full bg-deep border border-rim/60 flex items-center justify-center text-[8px] font-bold text-fog-hi shrink-0">
                                        {emp?.avatar || '?'}
                                      </div>
                                      <span className={`text-[10px] font-medium truncate flex-1 min-w-0 ${isPublished ? 'text-fog-hi' : 'text-ink'}`}>
                                        {emp?.name?.split(' ')[0] || 'Unknown'}
                                      </span>
                                      {isPublished ? (
                                        <span className="text-[8px] text-fog/40 shrink-0 ml-0.5">✓</span>
                                      ) : (
                                        <button
                                          onClick={() => removeAssignment(shift.id)}
                                          className="opacity-0 group-hover:opacity-100 transition-opacity text-fog/60 hover:text-red-400 shrink-0 ml-0.5"
                                          title="Remove assignment"
                                        >
                                          <XIcon />
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}

                                {isEmpty && (
                                  <button
                                    onClick={() => setAssigning({ positionName: pos.name, positionId: pos.id, date })}
                                    className="flex items-center justify-center gap-0.5 rounded border border-dashed px-1.5 py-1 text-[9px] font-semibold tracking-wide transition-colors border-amber-500/40 text-amber-400/60 hover:bg-amber-500/10 hover:text-amber-400"
                                  >
                                    <PlusIcon />
                                    Assign
                                  </button>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Auto-Schedule modal */}
      {showAutoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !aiGenerating && setShowAutoModal(false)} />
          <div className="relative bg-deep border border-rim/60 rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">

            <div className="flex items-center justify-between px-6 py-4 border-b border-rim/40">
              <div>
                <h2 className="font-heading font-bold text-ink text-lg flex items-center gap-2">
                  <span className="text-violet-400">✦</span> Auto-Schedule
                </h2>
                <p className="text-fog text-xs mt-0.5">
                  AI will fill every position slot for{' '}
                  <span className="text-amber-400 font-semibold">
                    {format(parseISO(weekStart), 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
                  </span>
                </p>
              </div>
              {!aiGenerating && (
                <button onClick={() => setShowAutoModal(false)} className="text-fog hover:text-ink transition-colors text-2xl leading-none">×</button>
              )}
            </div>

            <div className="px-6 py-5 space-y-5 max-h-[65vh] overflow-y-auto">

              {/* Departments */}
              <div>
                <p className="label-xs mb-2">Departments to schedule</p>
                <div className="flex flex-wrap gap-2">
                  {availableDepts.map(d => {
                    const on = aiConfig.departments.includes(d);
                    const dcfg = DEPT_CONFIG[d];
                    return (
                      <button
                        key={d}
                        onClick={() => setAiConfig(c => ({
                          ...c,
                          departments: on ? c.departments.filter(x => x !== d) : [...c.departments, d]
                        }))}
                        className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors
                          ${on
                            ? `${dcfg.bg} ${dcfg.border} ${dcfg.color}`
                            : 'border-rim/40 text-fog hover:border-rim'
                          }`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Hours range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="label-xs mb-1.5">Min hours / employee</p>
                  <input
                    type="number" min={8} max={40}
                    value={aiConfig.minHours}
                    onChange={e => setAiConfig(c => ({ ...c, minHours: parseInt(e.target.value) || 16 }))}
                    className="field text-sm"
                  />
                </div>
                <div>
                  <p className="label-xs mb-1.5">Max hours / employee</p>
                  <input
                    type="number" min={8} max={60}
                    value={aiConfig.maxHours}
                    onChange={e => setAiConfig(c => ({ ...c, maxHours: parseInt(e.target.value) || 40 }))}
                    className="field text-sm"
                  />
                </div>
              </div>

              {/* Default shift times */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="label-xs mb-1.5">Default shift start</p>
                  <input type="time" className="field text-sm" value={aiConfig.shiftStart}
                    onChange={e => setAiConfig(c => ({ ...c, shiftStart: e.target.value }))} />
                </div>
                <div>
                  <p className="label-xs mb-1.5">Default shift end</p>
                  <input type="time" className="field text-sm" value={aiConfig.shiftEnd}
                    onChange={e => setAiConfig(c => ({ ...c, shiftEnd: e.target.value }))} />
                </div>
              </div>

              {aiGenerating && (
                <div className="flex items-center gap-3 py-2">
                  <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin shrink-0" />
                  <span className="text-sm text-violet-300">Claude is building your schedule…</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-rim/40">
              <button
                onClick={() => setShowAutoModal(false)}
                disabled={aiGenerating}
                className="btn-ghost text-xs px-4 py-1.5 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleAutoSchedule}
                disabled={aiGenerating || aiConfig.departments.length === 0}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all
                  bg-violet-500/20 text-violet-300 border border-violet-500/40
                  hover:bg-violet-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {aiGenerating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>✦ Generate Schedule</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assignment modal */}
      {assigning && (
        <AssignModal
          positionName={assigning.positionName}
          date={assigning.date}
          dept={activeDept}
          employees={deptEmployees}
          alreadyAssigned={getCell(assigning.positionName, assigning.date).map(s => Number(s.employeeId))}
          onAssign={(empId, start, end) => {
            assignEmployee(assigning.positionName, assigning.date, empId, start, end);
            setAssigning(null);
          }}
          onClose={() => setAssigning(null)}
        />
      )}
    </div>
  );
}

// ── Assign Modal ──────────────────────────────────────────────────────────────
function AssignModal({ positionName, date, dept, employees, alreadyAssigned, onAssign, onClose }) {
  const [selectedEmp, setSelectedEmp] = useState('');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('17:00');

  const cfg = DEPT_CONFIG[dept];
  const available = employees.filter(e => !alreadyAssigned.includes(e.id));

  function submit(e) {
    e.preventDefault();
    if (!selectedEmp || !available.length) return;
    onAssign(parseInt(selectedEmp), start, end);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-deep border border-rim/60 rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">

        <div>
          <p className="label-xs mb-1">{format(parseISO(date), 'EEEE, MMMM d')}</p>
          <h2 className="font-heading font-black text-ink text-xl uppercase tracking-tight leading-none">
            {positionName}
          </h2>
          <p className={`text-xs font-semibold mt-1 ${cfg?.color || 'text-fog'}`}>{dept}</p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">

          <div className="flex flex-col gap-1">
            <label className="text-10 text-fog uppercase tracking-widest">Employee *</label>
            {available.length === 0 ? (
              <p className="text-xs text-fog italic py-1">
                All {dept} employees are already assigned to this position today.
              </p>
            ) : (
              <select
                className="field text-sm"
                value={selectedEmp}
                onChange={e => setSelectedEmp(e.target.value)}
                autoFocus
              >
                <option value="">Select employee…</option>
                {available.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-10 text-fog uppercase tracking-widest">Start</label>
              <input
                type="time"
                className="field text-sm"
                value={start}
                onChange={e => setStart(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-10 text-fog uppercase tracking-widest">End</label>
              <input
                type="time"
                className="field text-sm"
                value={end}
                onChange={e => setEnd(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="btn-ghost text-xs px-4 py-1.5">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedEmp || available.length === 0}
              className="btn-primary text-xs px-4 py-1.5 disabled:opacity-40"
            >
              Assign
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
  );
}
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
function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-2.5 h-2.5 mr-0.5">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-2.5 h-2.5">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
