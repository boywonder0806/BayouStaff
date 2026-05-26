import { useState, useEffect, useMemo, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { useAuth } from '../../../context/AuthContext.jsx';
import api from '../../../lib/api.js';

const SCHEDULABLE_DEPTS = ['Aquatics', 'Guest Services', 'Food & Beverage', 'Cleaning Crew'];

const DEPT_CONFIG = {
  'Aquatics':        { color: 'text-aq',   bg: 'bg-aq/10',   border: 'border-aq/30'   },
  'Guest Services':  { color: 'text-gs',   bg: 'bg-gs/10',   border: 'border-gs/30'   },
  'Food & Beverage': { color: 'text-fb',   bg: 'bg-fb/10',   border: 'border-fb/30'   },
  'Cleaning Crew':   { color: 'text-cc',   bg: 'bg-cc/10',   border: 'border-cc/30'   },
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function fmt12(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default function DailyAssignments() {
  const { user } = useAuth();

  const availableDepts = (!user || user.role === 'sysadmin')
    ? SCHEDULABLE_DEPTS
    : SCHEDULABLE_DEPTS.filter(d => user.departments?.includes(d));

  const [activeDept, setActiveDept] = useState(() => availableDepts[0] || SCHEDULABLE_DEPTS[0]);
  const [selectedDate, setSelectedDate]   = useState(todayISO());
  const [positions, setPositions]         = useState([]);
  const [shifts, setShifts]               = useState([]);
  const [assignments, setAssignments]     = useState([]); // [{ shiftId, positionKey }]
  const [planId, setPlanId]               = useState(null);
  const [loading, setLoading]             = useState(false);
  const [saving, setSaving]               = useState(false);
  const [dirty, setDirty]                 = useState(false);
  const [saveMsg, setSaveMsg]             = useState('');
  const [selectedShift, setSelectedShift] = useState(null); // shiftId being dragged/clicked to assign

  // Load board data whenever dept or date changes
  useEffect(() => {
    setLoading(true);
    setDirty(false);
    setSelectedShift(null);
    setSaveMsg('');
    api.get(`/netchex/board?dept=${encodeURIComponent(activeDept)}&date=${selectedDate}`)
      .then(({ data }) => {
        setPositions(data.positions ?? []);
        setShifts(data.shifts ?? []);
        setAssignments((data.assignments ?? []).map(a => ({ shiftId: a.shiftId, positionKey: a.positionKey })));
        setPlanId(data.planId ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeDept, selectedDate]);

  // Derive assigned set and unassigned shifts
  const assignedShiftIds = useMemo(() => new Set(assignments.map(a => a.shiftId)), [assignments]);

  const unassignedShifts = useMemo(
    () => shifts.filter(s => !assignedShiftIds.has(s.id)),
    [shifts, assignedShiftIds]
  );

  function getPositionShifts(posKey) {
    const ids = assignments.filter(a => a.positionKey === posKey).map(a => a.shiftId);
    return ids.map(id => shifts.find(s => s.id === id)).filter(Boolean);
  }

  function assignToPosition(posKey) {
    if (!selectedShift) return;
    // prevent double-assigning same shift
    if (assignedShiftIds.has(selectedShift)) return;
    setAssignments(prev => [...prev, { shiftId: selectedShift, positionKey: posKey }]);
    setSelectedShift(null);
    setDirty(true);
  }

  function unassign(shiftId) {
    setAssignments(prev => prev.filter(a => a.shiftId !== shiftId));
    setDirty(true);
  }

  function toggleSelectShift(shiftId) {
    setSelectedShift(prev => prev === shiftId ? null : shiftId);
  }

  async function handleSave() {
    setSaving(true);
    setSaveMsg('');
    try {
      const payload = {
        dept:        activeDept,
        date:        selectedDate,
        positions,
        assignments: assignments.map((a, i) => ({ ...a, sortOrder: i })),
      };
      const { data } = await api.post('/netchex/board/save', payload);
      setPlanId(data.planId);
      setDirty(false);
      setSaveMsg('Saved');
      setTimeout(() => setSaveMsg(''), 2500);
    } catch (err) {
      setSaveMsg('Save failed');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  const cfg = DEPT_CONFIG[activeDept];
  const formattedDate = selectedDate ? format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy') : '';

  return (
    <>
      {/* ── Print stylesheet ── */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-zone, .print-zone * { visibility: visible !important; }
          .print-zone { position: fixed; inset: 0; padding: 24px; background: white; color: black; }
          .no-print { display: none !important; }
          .print-table { width: 100%; border-collapse: collapse; font-size: 11px; }
          .print-table th, .print-table td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
          .print-table th { background: #f5f5f5; font-weight: 700; }
        }
      `}</style>

      <div className="flex flex-col" style={{ height: 'calc(100vh - 3rem)' }}>

        {/* ── Header ── */}
        <div className="shrink-0 mb-4 no-print">
          <p className="label-xs mb-1">T&A / Netchex</p>
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <h1 className="font-heading font-black text-ink text-3xl leading-none uppercase tracking-tight">
              Daily Assignments
            </h1>
            <div className="flex items-center gap-2 pb-1">
              {saveMsg && (
                <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                  saveMsg === 'Saved'
                    ? 'text-green-400 bg-green-500/10 border-green-500/30'
                    : 'text-red-400 bg-red-500/10 border-red-500/30'
                }`}>{saveMsg}</span>
              )}
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="field text-sm h-8 px-3"
              />
              <button
                onClick={handleSave}
                disabled={saving || !dirty}
                className="btn-primary text-xs px-4 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-rim/60 text-fog hover:text-ink hover:bg-shell transition-colors"
              >
                <PrintIcon />
                Print
              </button>
            </div>
          </div>
        </div>

        {/* ── Dept tabs ── */}
        <div className="flex items-center gap-2 shrink-0 mb-4 flex-wrap no-print">
          {availableDepts.map(d => {
            const dcfg = DEPT_CONFIG[d];
            const isActive = d === activeDept;
            return (
              <button
                key={d}
                onClick={() => setActiveDept(d)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold tracking-wide border transition-all
                  ${isActive
                    ? `${dcfg.bg} ${dcfg.border} ${dcfg.color}`
                    : 'bg-transparent border-rim/40 text-fog hover:text-fog-hi hover:border-rim/70'
                  }`}
              >
                {d}
              </button>
            );
          })}
        </div>

        {/* ── Main content ── */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center no-print">
            <div className="w-5 h-5 border-2 border-cyan border-t-transparent rounded-full animate-spin" />
          </div>
        ) : shifts.length === 0 ? (
          <div className="flex-1 flex items-center justify-center no-print">
            <div className="text-center max-w-sm">
              <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-cyan/10 border border-cyan/20 flex items-center justify-center">
                <NoShiftsIcon />
              </div>
              <p className="text-fog-hi font-semibold text-base mb-1">No Netchex shifts found</p>
              <p className="text-fog text-sm mb-4">
                No imported shifts for <span className="text-fog-hi">{activeDept}</span> on{' '}
                <span className="text-fog-hi">{formattedDate}</span>.
              </p>
              <a href="/scheduler/import" className="btn-primary text-xs px-4 py-2 rounded-lg inline-block">
                Import a schedule →
              </a>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex gap-4">

            {/* ── Positions board ── */}
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3">
              {positions.length === 0 ? (
                <div className="panel flex flex-col items-center justify-center h-40 gap-2">
                  <p className="text-fog text-sm">No positions configured for {activeDept}.</p>
                  <p className="text-fog/60 text-xs">Add positions under T&A → Roles.</p>
                </div>
              ) : (
                positions.map(pos => {
                  const posShifts = getPositionShifts(pos.id.toString());
                  const isUnder   = posShifts.length < pos.minCount;
                  const isFull    = posShifts.length >= pos.maxCount;
                  const canAssign = !isFull && !!selectedShift;

                  return (
                    <div key={pos.id} className="panel rounded-xl overflow-hidden">
                      {/* Position header */}
                      <div className={`flex items-center justify-between px-4 py-2.5 border-b border-rim/20
                        ${isUnder ? 'bg-amber-500/5' : 'bg-shell/10'}`}>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-ink text-sm">{pos.name}</span>
                          <span className={`text-10 font-bold px-2 py-0.5 rounded-full border ${
                            isUnder
                              ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                              : 'text-green-400 bg-green-500/10 border-green-500/30'
                          }`}>
                            {posShifts.length}/{pos.minCount === pos.maxCount ? pos.minCount : `${pos.minCount}–${pos.maxCount}`}
                          </span>
                          {pos.description && (
                            <span className="text-fog/50 text-xs hidden lg:block">{pos.description}</span>
                          )}
                        </div>
                        {canAssign && (
                          <button
                            onClick={() => assignToPosition(pos.id.toString())}
                            className="text-xs font-semibold text-cyan border border-cyan/40 bg-cyan/10 hover:bg-cyan/20 px-2.5 py-1 rounded-lg transition-colors"
                          >
                            + Assign selected
                          </button>
                        )}
                      </div>

                      {/* Assigned shifts */}
                      <div className="px-4 py-2.5 flex flex-wrap gap-2 min-h-[52px] items-start">
                        {posShifts.length === 0 ? (
                          <span className="text-fog/30 text-xs italic self-center">
                            {selectedShift ? 'Click "Assign selected" to place shift here' : 'Empty — select a shift from the pool'}
                          </span>
                        ) : (
                          posShifts.map(shift => (
                            <ShiftChip
                              key={shift.id}
                              shift={shift}
                              onRemove={() => unassign(shift.id)}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* ── Unassigned pool ── */}
            <div className="w-64 shrink-0 flex flex-col gap-2 min-h-0 no-print">
              <div className="flex items-center justify-between shrink-0">
                <span className="label-xs">Shift Pool</span>
                <span className="text-10 text-fog">
                  {unassignedShifts.length} of {shifts.length}
                </span>
              </div>

              {selectedShift && (
                <div className="text-10 font-semibold text-cyan bg-cyan/10 border border-cyan/30 rounded-lg px-3 py-2 shrink-0">
                  Shift selected — click a position to assign
                </div>
              )}

              <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5 pr-0.5">
                {unassignedShifts.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-green-400 text-xs font-semibold">All shifts assigned</p>
                  </div>
                ) : (
                  unassignedShifts.map(shift => {
                    const isSelected = selectedShift === shift.id;
                    return (
                      <button
                        key={shift.id}
                        onClick={() => toggleSelectShift(shift.id)}
                        className={`w-full text-left rounded-lg border px-3 py-2.5 transition-all
                          ${isSelected
                            ? 'border-cyan/60 bg-cyan/10 text-ink'
                            : 'border-rim/30 bg-shell/20 text-fog-hi hover:border-rim/60 hover:bg-shell/40'
                          }`}
                      >
                        <div className="text-xs font-semibold leading-tight mb-0.5">{shift.employeeName}</div>
                        <div className="text-10 text-fog">
                          {fmt12(shift.startTime)} – {fmt12(shift.endTime)}
                        </div>
                        {shift.departmentLabel && (
                          <div className="text-10 text-fog/50 truncate mt-0.5">{shift.departmentLabel}</div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Already assigned */}
              {assignedShiftIds.size > 0 && (
                <div className="shrink-0 border-t border-rim/20 pt-2">
                  <p className="text-10 text-fog mb-1.5">Assigned</p>
                  <div className="flex flex-col gap-1">
                    {shifts.filter(s => assignedShiftIds.has(s.id)).map(shift => (
                      <div key={shift.id} className="flex items-center gap-2 px-2 py-1.5 rounded border border-rim/20 bg-deep/50">
                        <CheckIcon />
                        <span className="text-10 text-fog truncate">{shift.employeeName}</span>
                        <button
                          onClick={() => unassign(shift.id)}
                          className="ml-auto text-fog/30 hover:text-red-400 text-xs leading-none shrink-0 transition-colors"
                          title="Remove assignment"
                        >×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Print zone ── */}
      <div className="print-zone hidden print:block">
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 20, textTransform: 'uppercase', letterSpacing: 2 }}>
            Blue Bayou Waterpark — Daily Assignment Sheet
          </div>
          <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>
            {activeDept} · {formattedDate}
          </div>
        </div>
        <table className="print-table">
          <thead>
            <tr>
              <th>Position</th>
              <th>Assigned Employee(s)</th>
              <th>Shift Time</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {positions.map(pos => {
              const posShifts = getPositionShifts(pos.id.toString());
              return (
                <tr key={pos.id}>
                  <td style={{ fontWeight: 600 }}>{pos.name}</td>
                  <td>
                    {posShifts.length === 0
                      ? <span style={{ color: '#aaa', fontStyle: 'italic' }}>Unassigned</span>
                      : posShifts.map(s => s.employeeName).join(', ')}
                  </td>
                  <td>
                    {posShifts.length > 0
                      ? posShifts.map(s => `${fmt12(s.startTime)}–${fmt12(s.endTime)}`).join(', ')
                      : ''}
                  </td>
                  <td />
                </tr>
              );
            })}
            {/* Unassigned shifts row */}
            {unassignedShifts.length > 0 && (
              <tr>
                <td colSpan={4} style={{ background: '#f9f9f9', fontWeight: 600, paddingTop: 12 }}>
                  Unassigned Shifts
                </td>
              </tr>
            )}
            {unassignedShifts.map(s => (
              <tr key={s.id}>
                <td style={{ color: '#888' }}>—</td>
                <td>{s.employeeName}</td>
                <td>{fmt12(s.startTime)}–{fmt12(s.endTime)}</td>
                <td />
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 24, fontSize: 10, color: '#aaa' }}>
          Printed {new Date().toLocaleString()}
        </div>
      </div>
    </>
  );
}

// ── Shift chip (assigned) ─────────────────────────────────────────────────────
function ShiftChip({ shift, onRemove }) {
  return (
    <div className="flex items-center gap-1.5 bg-shell/50 border border-rim/30 rounded-lg px-2.5 py-1.5 group">
      <div className="flex flex-col min-w-0">
        <span className="text-xs font-semibold text-ink leading-tight">{shift.employeeName}</span>
        <span className="text-10 text-fog">{fmt12(shift.startTime)}–{fmt12(shift.endTime)}</span>
      </div>
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-fog/50 hover:text-red-400 text-base leading-none ml-1 shrink-0"
        title="Remove assignment"
      >
        ×
      </button>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function PrintIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-3.5 h-3.5">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-2.5 h-2.5 text-green-400 shrink-0">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function NoShiftsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7 text-cyan">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="14" x2="16" y2="14" />
    </svg>
  );
}
