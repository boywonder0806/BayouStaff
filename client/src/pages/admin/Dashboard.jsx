import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import api from '../../lib/api.js';
import { fmt12 } from '../../lib/time.js';
import { DEPT_COLOR } from '../../components/Layout/Sidebar.jsx';

export default function AdminDashboard() {
  const [stats, setStats]         = useState(null);
  const [employees, setEmployees] = useState([]);
  const [todayShifts, setToday]   = useState([]);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    Promise.all([
      api.get('/admin/stats'),
      api.get('/admin/employees'),
      api.get('/admin/schedule', { params: { date: today } }),
    ]).then(([s, e, sc]) => {
      setStats(s.data);
      setEmployees(e.data.employees);
      setToday(sc.data.shifts);
    }).catch(console.error);
  }, [today]);

  const STATS = [
    { label: 'Total Staff',      value: stats?.totalStaff      ?? '—', accent: 'text-cyan'        },
    { label: 'On Duty Today',    value: stats?.onDutyToday     ?? '—', accent: 'text-green-400'   },
    { label: 'Shifts This Week', value: stats?.shiftsThisWeek  ?? '—', accent: 'text-ink'         },
    { label: 'Open Requests',    value: stats?.openRequests    ?? '—', accent: 'text-gold'        },
  ];

  return (
    <div className="flex flex-col gap-5" style={{ height: 'calc(100vh - 3rem)' }}>

      {/* Header + quick actions */}
      <div className="flex items-end justify-between shrink-0">
        <div>
          <p className="label-xs mb-1">{format(new Date(), 'EEEE, MMMM d')}</p>
          <h1 className="font-heading font-black text-ink text-4xl leading-none uppercase tracking-tight">
            Dashboard
          </h1>
        </div>
        <div className="flex gap-2 pb-1">
          {['Add Shift', 'Announcement', 'Export'].map(label => (
            <button key={label} className="btn-ghost text-xs border border-rim/60 rounded-md px-4 py-2">
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3 shrink-0">
        {STATS.map(k => (
          <div key={k.label} className="panel p-5">
            <p className="label-xs mb-3">{k.label}</p>
            <p className={`num-display text-5xl leading-none ${k.accent}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Main content — fills remaining height */}
      <div className="flex-1 grid grid-cols-3 gap-5 min-h-0">

        {/* Today's shifts — 2 cols wide, scrollable */}
        <div className="col-span-2 panel p-5 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-5 shrink-0">
            <p className="label-xs">Today's shifts</p>
            <span className="label-xs text-cyan">{format(new Date(), 'MMMM d, yyyy')}</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {todayShifts.length === 0 ? (
              <p className="text-fog text-sm">No shifts scheduled today.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-deep">
                  <tr className="border-b border-rim/40">
                    {['Employee', 'Time', 'Location', 'Department'].map(h => (
                      <th key={h} className="label-xs text-left pb-3 pr-6 last:pr-0">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-rim/30">
                  {todayShifts.map(s => {
                    const dc = DEPT_COLOR[s.department];
                    return (
                      <tr key={s.id} className="hover:bg-shell/40 transition-colors group">
                        <td className="py-3 pr-6">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-1 h-7 rounded-full shrink-0 ${dc?.bar ?? 'bg-cyan'}`} />
                            <span className="font-semibold text-ink text-sm">{s.employeeName}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-6 text-fog text-xs font-mono tabular-nums">
                          {fmt12(s.start)} – {fmt12(s.end)}
                        </td>
                        <td className="py-3 pr-6 text-fog-hi text-xs">{s.location}</td>
                        <td className="py-3">
                          <span className={`text-10 font-bold tracking-widest uppercase ${dc?.text ?? 'text-cyan'}`}>
                            {s.department}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Staff list — scrollable */}
        <div className="panel p-5 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-5 shrink-0">
            <p className="label-xs">Staff</p>
            <span className="label-xs text-fog">{employees.length} total</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3">
            {employees.map(emp => {
              const onShift = todayShifts.some(s => s.employeeId === emp.id);
              return (
                <div key={emp.id} className="flex items-center gap-3 py-1">
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-full bg-shell border border-rim flex items-center justify-center text-xs font-heading font-bold text-fog-hi">
                      {emp.avatar}
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-deep
                      ${onShift ? 'bg-green-400' : 'bg-fog/30'}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{emp.name}</p>
                    <p className="text-10 text-fog tracking-wide truncate">{emp.position} · {emp.department}</p>
                  </div>
                  {onShift && (
                    <span className="label-xs text-green-400 shrink-0">on shift</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
