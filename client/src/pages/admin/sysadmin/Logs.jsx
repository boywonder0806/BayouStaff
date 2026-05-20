import { useState } from 'react';
import { format } from 'date-fns';

const ALL_LOGS = [
  { id:  1, event: 'User login',           actor: 'sysadmin@bluebayou.com',  ip: '192.168.1.42',  time: '2026-05-18T10:42:00Z', level: 'info'  },
  { id:  2, event: 'Role updated',         actor: 'sysadmin@bluebayou.com',  ip: '192.168.1.42',  time: '2026-05-18T10:38:00Z', level: 'warn'  },
  { id:  3, event: 'User login',           actor: 'manager@bluebayou.com',   ip: '192.168.1.55',  time: '2026-05-18T08:01:00Z', level: 'info'  },
  { id:  4, event: 'Announcement posted',  actor: 'manager@bluebayou.com',   ip: '192.168.1.55',  time: '2026-05-17T16:05:00Z', level: 'info'  },
  { id:  5, event: 'Password reset',       actor: 'sysadmin@bluebayou.com',  ip: '192.168.1.42',  time: '2026-05-17T11:20:00Z', level: 'warn'  },
  { id:  6, event: 'User login',           actor: 'sarah@bluebayou.com',     ip: '10.0.0.18',     time: '2026-05-17T08:55:00Z', level: 'info'  },
  { id:  7, event: 'Failed login attempt', actor: 'unknown',                 ip: '203.0.113.99',  time: '2026-05-16T22:11:00Z', level: 'error' },
  { id:  8, event: 'Failed login attempt', actor: 'unknown',                 ip: '203.0.113.99',  time: '2026-05-16T22:10:00Z', level: 'error' },
  { id:  9, event: 'Failed login attempt', actor: 'unknown',                 ip: '203.0.113.99',  time: '2026-05-16T22:09:00Z', level: 'error' },
  { id: 10, event: 'Role updated',         actor: 'sysadmin@bluebayou.com',  ip: '192.168.1.42',  time: '2026-05-16T09:30:00Z', level: 'warn'  },
  { id: 11, event: 'Schedule exported',    actor: 'manager@bluebayou.com',   ip: '192.168.1.55',  time: '2026-05-15T14:00:00Z', level: 'info'  },
  { id: 12, event: 'User login',           actor: 'mike@bluebayou.com',      ip: '10.0.0.22',     time: '2026-05-15T09:00:00Z', level: 'info'  },
  { id: 13, event: 'User login',           actor: 'emily@bluebayou.com',     ip: '10.0.0.31',     time: '2026-05-14T08:50:00Z', level: 'info'  },
  { id: 14, event: 'Maintenance mode on',  actor: 'sysadmin@bluebayou.com',  ip: '192.168.1.42',  time: '2026-05-13T18:00:00Z', level: 'warn'  },
  { id: 15, event: 'Maintenance mode off', actor: 'sysadmin@bluebayou.com',  ip: '192.168.1.42',  time: '2026-05-13T19:30:00Z', level: 'warn'  },
];

const FILTERS = ['all', 'info', 'warn', 'error'];

const LEVEL = {
  info:  { dot: 'bg-cyan',    row: '',                          badge: 'bg-cyan/10 border-cyan/20 text-cyan',           label: 'Info'  },
  warn:  { dot: 'bg-gold',    row: 'bg-gold/5',                 badge: 'bg-gold/10 border-gold/20 text-gold',           label: 'Warn'  },
  error: { dot: 'bg-red-400', row: 'bg-red-500/5',              badge: 'bg-red-500/10 border-red-500/20 text-red-400',  label: 'Error' },
};

export default function SysAdminLogs() {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const visible = ALL_LOGS.filter(l => {
    if (filter !== 'all' && l.level !== filter) return false;
    if (search && !l.event.toLowerCase().includes(search.toLowerCase()) &&
        !l.actor.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const errorCount = ALL_LOGS.filter(l => l.level === 'error').length;

  return (
    <div className="flex flex-col gap-5" style={{ height: 'calc(100vh - 3rem)' }}>

      {/* Header */}
      <div className="flex items-end justify-between shrink-0">
        <div>
          <p className="label-xs mb-1">System Admin / Logs</p>
          <h1 className="font-heading font-black text-ink text-3xl leading-none uppercase tracking-tight">
            Security Logs
          </h1>
        </div>
        <div className="flex items-center gap-3 pb-1">
          {errorCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              <span className="text-10 font-bold tracking-widest uppercase text-red-400">
                {errorCount} Security Alert{errorCount > 1 ? 's' : ''}
              </span>
            </div>
          )}
          <button className="btn-ghost border border-rim/60 rounded-md px-4 py-2 text-xs">
            Export CSV
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex gap-1 p-1 bg-shell/60 border border-rim/40 rounded-lg">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-md text-10 font-bold tracking-widest uppercase transition-all
                ${filter === f
                  ? f === 'all'   ? 'bg-deep text-ink shadow-sm border border-rim/60'
                  : f === 'error' ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                  : f === 'warn'  ? 'bg-gold/15 text-gold border border-gold/30'
                  :                 'bg-cyan/15 text-cyan border border-cyan/30'
                  : 'text-fog hover:text-fog-hi'
                }`}
            >
              {f === 'all' ? `All (${ALL_LOGS.length})` : `${f} (${ALL_LOGS.filter(l => l.level === f).length})`}
            </button>
          ))}
        </div>
        <input
          type="text"
          className="field flex-1 text-xs"
          placeholder="Search events or actors…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Log table */}
      <div className="flex-1 panel min-h-0 flex flex-col overflow-hidden">
        {/* Table head */}
        <div className="grid grid-cols-[1fr_2fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-rim/40 shrink-0">
          {['Level', 'Event', 'Actor', 'IP Address', 'Time'].map(h => (
            <span key={h} className="label-xs">{h}</span>
          ))}
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-y-auto divide-y divide-rim/30">
          {visible.length === 0 ? (
            <p className="text-fog text-sm p-5">No events match the current filter.</p>
          ) : (
            visible.map(entry => {
              const s = LEVEL[entry.level];
              return (
                <div key={entry.id} className={`grid grid-cols-[1fr_2fr_1fr_1fr_auto] gap-4 items-center px-5 py-3 hover:bg-shell/40 transition-colors ${s.row}`}>
                  {/* Level */}
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
                    <span className={`text-10 font-bold tracking-widest uppercase px-2 py-0.5 rounded border ${s.badge}`}>
                      {s.label}
                    </span>
                  </div>
                  {/* Event */}
                  <span className="text-sm font-semibold text-ink">{entry.event}</span>
                  {/* Actor */}
                  <span className="text-xs text-fog-hi font-mono truncate">{entry.actor}</span>
                  {/* IP */}
                  <span className="text-xs text-fog font-mono">{entry.ip}</span>
                  {/* Time */}
                  <span className="text-10 text-fog whitespace-nowrap">
                    {format(new Date(entry.time), 'MMM d, h:mm a')}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer count */}
        <div className="border-t border-rim/40 px-5 py-2.5 shrink-0">
          <span className="text-10 text-fog">
            Showing {visible.length} of {ALL_LOGS.length} events
          </span>
        </div>
      </div>
    </div>
  );
}
