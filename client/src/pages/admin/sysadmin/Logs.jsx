import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import api from '../../../../lib/api.js';

const FILTERS = ['all', 'info', 'warn', 'error'];

const LEVEL_MAP = {
  info:  { dot: 'bg-cyan',    row: '',             badge: 'bg-cyan/10 border-cyan/20 text-cyan',          label: 'Info'  },
  warn:  { dot: 'bg-gold',    row: 'bg-gold/5',    badge: 'bg-gold/10 border-gold/20 text-gold',          label: 'Warn'  },
  error: { dot: 'bg-red-400', row: 'bg-red-500/5', badge: 'bg-red-500/10 border-red-500/20 text-red-400', label: 'Error' },
};

function getLevel(event = '') {
  const e = event.toLowerCase();
  if (e.includes('fail') || e.includes('error') || e.includes('lock') || e.includes('invalid')) return 'error';
  if (e.includes('password') || e.includes('reset') || e.includes('role') || e.includes('delete') ||
      e.includes('removed') || e.includes('deactivat') || e.includes('override')) return 'warn';
  return 'info';
}

export default function SysAdminLogs() {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('all');
  const [search, setSearch]   = useState('');

  useEffect(() => {
    api.get('/admin/logs')
      .then(r => setLogs(r.data.logs.map(l => ({ ...l, level: getLevel(l.event) }))))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const visible = logs.filter(l => {
    if (filter !== 'all' && l.level !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return l.event?.toLowerCase().includes(q) ||
             l.employeeName?.toLowerCase().includes(q) ||
             l.employeeEmail?.toLowerCase().includes(q) ||
             l.ipAddress?.includes(q);
    }
    return true;
  });

  const errorCount = logs.filter(l => l.level === 'error').length;

  return (
    <div className="flex flex-col gap-5" style={{ height: 'calc(100vh - 3rem)' }}>

      {/* Header */}
      <div className="flex items-end justify-between shrink-0">
        <div>
          <p className="label-xs mb-1">System Admin / Logs</p>
          <h1 className="font-heading font-black text-ink text-3xl leading-none uppercase tracking-tight">
            Activity Logs
          </h1>
        </div>
        <div className="flex items-center gap-3 pb-1">
          {errorCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              <span className="text-10 font-bold tracking-widest uppercase text-red-400">
                {errorCount} Alert{errorCount > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex gap-1 p-1 bg-shell/60 border border-rim/40 rounded-lg">
          {FILTERS.map(f => {
            const count = f === 'all' ? logs.length : logs.filter(l => l.level === f).length;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-md text-10 font-bold tracking-widest uppercase transition-all
                  ${filter === f
                    ? f === 'error' ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                    : f === 'warn'  ? 'bg-gold/15 text-gold border border-gold/30'
                    :                 'bg-deep text-ink shadow-sm border border-rim/60'
                    : 'text-fog hover:text-fog-hi'
                  }`}
              >
                {f === 'all' ? `All (${count})` : `${f} (${count})`}
              </button>
            );
          })}
        </div>
        <input
          type="text"
          className="field flex-1 text-xs"
          placeholder="Search events, names, or IP…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="flex-1 panel min-h-0 flex flex-col overflow-hidden">
        <div className="grid grid-cols-[80px_2fr_1.5fr_1fr_120px] gap-4 px-5 py-3 border-b border-rim/40 shrink-0">
          {['Level', 'Event', 'User', 'IP Address', 'Time'].map(h => (
            <span key={h} className="label-xs">{h}</span>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-rim/30">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[80px_2fr_1.5fr_1fr_120px] gap-4 items-center px-5 py-3 animate-pulse">
                <div className="h-3 w-12 bg-shell rounded" />
                <div className="h-3 w-3/4 bg-shell rounded" />
                <div className="h-3 w-1/2 bg-shell rounded" />
                <div className="h-3 w-1/3 bg-shell rounded" />
                <div className="h-3 w-16 bg-shell rounded" />
              </div>
            ))
          ) : visible.length === 0 ? (
            <p className="text-fog text-sm p-5">No events match the current filter.</p>
          ) : (
            visible.map(entry => {
              const s = LEVEL_MAP[entry.level];
              const actor = entry.employeeName || entry.actorName || '—';
              const email = entry.employeeEmail ? `(${entry.employeeEmail})` : '';
              return (
                <div
                  key={entry.id}
                  className={`grid grid-cols-[80px_2fr_1.5fr_1fr_120px] gap-4 items-center px-5 py-3 hover:bg-shell/40 transition-colors ${s.row}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
                    <span className={`text-10 font-bold tracking-widest uppercase px-2 py-0.5 rounded border ${s.badge}`}>
                      {s.label}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-ink">{entry.event}</span>
                  <div className="min-w-0">
                    <p className="text-xs text-fog-hi font-medium truncate">{actor}</p>
                    {email && <p className="text-10 text-fog font-mono truncate">{email}</p>}
                  </div>
                  <span className="text-xs text-fog font-mono">{entry.ipAddress || '—'}</span>
                  <span className="text-10 text-fog whitespace-nowrap">
                    {format(new Date(entry.createdAt), 'MMM d, h:mm a')}
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-rim/40 px-5 py-2.5 shrink-0">
          <span className="text-10 text-fog">
            Showing {visible.length} of {logs.length} events
          </span>
        </div>
      </div>
    </div>
  );
}
