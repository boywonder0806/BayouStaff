import { useState, useEffect, useCallback } from 'react';
import { format, startOfWeek, addWeeks, subWeeks, parseISO } from 'date-fns';
import api from '../../lib/api.js';
import { fmt12 } from '../../lib/time.js';
import { Avatar, DEPT_COLOR } from '../../components/Layout/Sidebar.jsx';

const DEPTS = ['Aquatics', 'Food & Beverage', 'Guest Services', 'Management', 'Cleaning Crew'];
const LOCS  = ['Wave Pool', 'Slide Area', 'Lazy River', 'Main Pool', 'Park-Wide',
               'Snack Shack', 'Main Concessions', 'Main Entrance', 'Cabana Rentals'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const BLANK = { employeeId: '', date: '', start: '09:00', end: '17:00', department: '', position: '', location: '', notes: '' };

export default function Scheduler() {
  const [weekStart, setWeekStart] = useState(() =>
    format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  );
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [deptFilter, setDept] = useState('All');
  const [modal, setModal]     = useState(null);
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/scheduler?weekStart=${weekStart}`);
      setData(res.data);
    } catch { /* errors surfaced via empty state */ } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);

  const nav = dir => setWeekStart(w =>
    format(dir === 'prev' ? subWeeks(parseISO(w), 1) : addWeeks(parseISO(w), 1), 'yyyy-MM-dd')
  );
  const goToday = () => setWeekStart(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));

  function openCreate(empId, date) {
    const emp = data.employees.find(e => e.id === empId);
    setModal({
      mode: 'create',
      form: { ...BLANK, employeeId: String(empId), date, department: emp?.department ?? '', position: emp?.position ?? '' },
    });
    setErr('');
  }

  function openEdit(shift) {
    setModal({ mode: 'edit', shiftId: shift.id, form: { ...shift, employeeId: String(shift.employeeId) } });
    setErr('');
  }

  function closeModal() { setModal(null); setErr(''); }

  function patch(field) {
    return e => setModal(m => ({ ...m, form: { ...m.form, [field]: e.target.value } }));
  }

  async function handleSave() {
    if (!modal.form.employeeId || !modal.form.date) { setErr('Employee and date are required.'); return; }
    if (!modal.form.start || !modal.form.end)       { setErr('Start and end times are required.'); return; }
    setSaving(true);
    try {
      if (modal.mode === 'create') {
        await api.post('/admin/scheduler/shifts', modal.form);
      } else {
        await api.patch(`/admin/scheduler/shifts/${modal.shiftId}`, modal.form);
      }
      closeModal();
      load();
    } catch (e) {
      setErr(e.response?.data?.error ?? 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this shift?')) return;
    setSaving(true);
    try {
      await api.delete(`/admin/scheduler/shifts/${modal.shiftId}`);
      closeModal();
      load();
    } finally {
      setSaving(false);
    }
  }

  const todayStr  = new Date().toISOString().slice(0, 10);
  const days      = data?.days ?? [];
  const shifts    = data?.shifts ?? [];
  const employees = (data?.employees ?? []).filter(e =>
    deptFilter === 'All' || e.departments?.includes(deptFilter) || e.department === deptFilter
  );

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 3rem)' }}>

      {/* ── Page header ── */}
      <div className="flex items-end justify-between mb-5 shrink-0">
        <div>
          <p className="label-xs mb-1">
            {days.length ? `${format(parseISO(days[0]), 'MMM d')} – ${format(parseISO(days[6]), 'MMM d, yyyy')}` : '—'}
          </p>
          <h1 className="font-heading font-black text-ink text-4xl leading-none uppercase tracking-tight">
            Scheduler
          </h1>
        </div>
        <div className="flex items-center gap-2 pb-1">
          <select
            value={deptFilter}
            onChange={e => setDept(e.target.value)}
            className="field text-sm py-2 w-48"
          >
            <option value="All">All Departments</option>
            {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <button onClick={() => nav('prev')} className="btn-ghost border border-rim/60 px-3 py-2 text-sm">‹</button>
          <button onClick={goToday}           className="btn-ghost border border-rim/60 px-3 py-2 text-sm">Today</button>
          <button onClick={() => nav('next')} className="btn-ghost border border-rim/60 px-3 py-2 text-sm">›</button>
        </div>
      </div>

      {/* ── Schedule grid ── */}
      <div className="flex-1 min-h-0 overflow-auto panel">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-fog text-sm">Loading schedule…</div>
        ) : (
          <table className="w-full border-collapse min-w-[860px]">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-20 bg-deep w-44 border-b border-r border-rim/40 px-4 py-3 text-left label-xs">
                  Staff
                </th>
                {days.map((day, i) => {
                  const isToday = day === todayStr;
                  return (
                    <th
                      key={day}
                      className={`sticky top-0 z-10 border-b border-r border-rim/40 px-3 py-3 text-center min-w-[130px]
                        ${isToday ? 'bg-cyan/10' : 'bg-deep'}`}
                    >
                      <p className={`label-xs ${isToday ? 'text-cyan' : ''}`}>{DAY_LABELS[i]}</p>
                      <p className={`font-heading font-bold text-xl leading-none mt-0.5 ${isToday ? 'text-cyan' : 'text-ink'}`}>
                        {format(parseISO(day), 'd')}
                      </p>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-fog text-sm py-16">
                    No staff match this filter.
                  </td>
                </tr>
              ) : employees.map((emp, ri) => (
                <tr key={emp.id} className={ri % 2 === 0 ? '' : 'bg-shell/20'}>
                  {/* Sticky employee name cell */}
                  <td className={`sticky left-0 z-10 border-b border-r border-rim/40 px-4 py-3
                    ${ri % 2 === 0 ? 'bg-deep' : 'bg-[#0f2540]'}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar initials={emp.avatar} dept={emp.department} />
                      <div className="min-w-0">
                        <p className="text-ink text-sm font-semibold truncate leading-tight">{emp.name}</p>
                        <p className="text-fog text-10 tracking-wide truncate">{emp.position}</p>
                      </div>
                    </div>
                  </td>
                  {/* Day cells */}
                  {days.map(day => {
                    const dayShifts = shifts.filter(s => s.employeeId === emp.id && s.date === day);
                    const isToday   = day === todayStr;
                    return (
                      <td
                        key={day}
                        onClick={() => openCreate(emp.id, day)}
                        className={`border-b border-r border-rim/40 px-2 py-2 align-top cursor-pointer
                          transition-colors hover:bg-cyan/5 group
                          ${isToday ? 'bg-cyan/[0.03]' : ''}`}
                        style={{ height: 76 }}
                      >
                        <div className="flex flex-col gap-1">
                          {dayShifts.map(shift => (
                            <ShiftPill
                              key={shift.id}
                              shift={shift}
                              onClick={e => { e.stopPropagation(); openEdit(shift); }}
                            />
                          ))}
                          {dayShifts.length === 0 && (
                            <span className="opacity-0 group-hover:opacity-40 transition-opacity text-cyan text-xs font-bold pl-1">
                              + add
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Shift modal ── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative panel-raised w-full max-w-md shadow-2xl">

            <div className="flex items-center justify-between px-6 py-4 border-b border-rim/40">
              <h2 className="font-heading font-bold text-ink text-lg">
                {modal.mode === 'create' ? 'Add Shift' : 'Edit Shift'}
              </h2>
              <button onClick={closeModal} className="text-fog hover:text-ink transition-colors text-2xl leading-none">×</button>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Employee */}
              <div>
                <p className="label-xs mb-1.5">Employee</p>
                <select value={modal.form.employeeId} onChange={patch('employeeId')} className="field">
                  <option value="">— Select —</option>
                  {(data?.employees ?? []).map(e => (
                    <option key={e.id} value={String(e.id)}>{e.name}</option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <p className="label-xs mb-1.5">Date</p>
                <input type="date" value={modal.form.date} onChange={patch('date')} className="field" />
              </div>

              {/* Start / End */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="label-xs mb-1.5">Start</p>
                  <input type="time" value={modal.form.start} onChange={patch('start')} className="field" />
                </div>
                <div>
                  <p className="label-xs mb-1.5">End</p>
                  <input type="time" value={modal.form.end} onChange={patch('end')} className="field" />
                </div>
              </div>

              {/* Department */}
              <div>
                <p className="label-xs mb-1.5">Department</p>
                <select value={modal.form.department} onChange={patch('department')} className="field">
                  <option value="">— Select —</option>
                  {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              {/* Position */}
              <div>
                <p className="label-xs mb-1.5">Position</p>
                <input
                  type="text"
                  value={modal.form.position}
                  onChange={patch('position')}
                  placeholder="e.g. Lifeguard"
                  className="field"
                />
              </div>

              {/* Location */}
              <div>
                <p className="label-xs mb-1.5">Location</p>
                <select value={modal.form.location} onChange={patch('location')} className="field">
                  <option value="">— Select —</option>
                  {LOCS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              {/* Notes */}
              <div>
                <p className="label-xs mb-1.5">Notes <span className="text-fog normal-case font-normal">(optional)</span></p>
                <input
                  type="text"
                  value={modal.form.notes}
                  onChange={patch('notes')}
                  placeholder="Any extra info…"
                  className="field"
                />
              </div>

              {err && <p className="text-red-400 text-sm">{err}</p>}
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-rim/40">
              {modal.mode === 'edit' ? (
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="text-red-400 hover:text-red-300 text-sm transition-colors disabled:opacity-40"
                >
                  Delete shift
                </button>
              ) : <span />}
              <div className="flex gap-2">
                <button onClick={closeModal} className="btn-ghost border border-rim/60">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary">
                  {saving ? 'Saving…' : modal.mode === 'create' ? 'Add Shift' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShiftPill({ shift, onClick }) {
  const dc = DEPT_COLOR[shift.department];
  const bg     = dc ? dc.glow : 'rgba(0,200,255,0.12)';
  const border = dc ? dc.glow.replace('0.18', '0.40') : 'rgba(0,200,255,0.30)';
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-md px-2 py-1.5 transition-all hover:brightness-125 active:scale-[0.98]"
      style={{ backgroundColor: bg, border: `1px solid ${border}` }}
    >
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dc?.bar ?? 'bg-cyan'}`} />
        <span className={`font-mono tabular-nums text-xs font-semibold ${dc?.text ?? 'text-cyan'}`}>
          {fmt12(shift.start)}–{fmt12(shift.end)}
        </span>
      </div>
      {shift.location && (
        <p className="text-fog-hi text-10 mt-0.5 truncate pl-3">{shift.location}</p>
      )}
    </button>
  );
}
