import { useState, useEffect, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import api from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const POLL_MS = 3 * 60 * 1000; // match server poll rate

const EVENT_LABELS = {
  alert_triggered: 'Alert Triggered',
  all_clear:       'All Clear',
  manual_alert:    'Manual Alert',
  manual_clear:    'Manual Clear',
};

const EVENT_COLOR = {
  alert_triggered: 'text-red-400 bg-red-950/40 border-red-500/30',
  all_clear:       'text-green-400 bg-green-950/40 border-green-500/30',
  manual_alert:    'text-amber-400 bg-amber-950/40 border-amber-500/30',
  manual_clear:    'text-green-400 bg-green-950/40 border-green-500/30',
};

export default function Weather() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'manager' || user?.role === 'sysadmin';

  const [status, setStatus]       = useState(null);
  const [events, setEvents]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [overriding, setOverriding] = useState(false);
  const [overrideNote, setOverrideNote] = useState('');
  const [showOverride, setShowOverride] = useState(false);
  const [countdown, setCountdown] = useState(null);

  const timerRef = useRef(null);

  async function fetchStatus() {
    try {
      const r = await api.get('/lightning/status');
      setStatus(r.data);
    } catch {}
  }

  async function fetchLog() {
    try {
      const r = await api.get('/lightning/log');
      setEvents(r.data.events ?? []);
    } catch {}
  }

  useEffect(() => {
    Promise.all([fetchStatus(), fetchLog()]).finally(() => setLoading(false));
    const id = setInterval(() => { fetchStatus(); fetchLog(); }, POLL_MS);
    return () => clearInterval(id);
  }, []);

  // Live countdown ticker (re-ticks every 30s for minute precision)
  useEffect(() => {
    clearInterval(timerRef.current);
    if (status?.minutesUntilClear != null) {
      setCountdown(status.minutesUntilClear);
      timerRef.current = setInterval(() => {
        setCountdown(prev => (prev > 0 ? prev - 1 : 0));
      }, 60000);
    } else {
      setCountdown(null);
    }
    return () => clearInterval(timerRef.current);
  }, [status?.minutesUntilClear]);

  async function handleOverride(active) {
    setOverriding(true);
    try {
      await api.post('/lightning/override', { active, note: overrideNote || undefined });
      setOverrideNote('');
      setShowOverride(false);
      await Promise.all([fetchStatus(), fetchLog()]);
    } catch {}
    finally { setOverriding(false); }
  }

  async function handlePollNow() {
    try {
      await api.post('/lightning/poll-now');
      await fetchStatus();
      await fetchLog();
    } catch {}
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-fog">
        <span className="w-5 h-5 border-2 border-fog/30 border-t-fog rounded-full animate-spin mr-3" />
        Loading weather…
      </div>
    );
  }

  const alert    = status?.alertActive;
  const override = status?.overrideActive;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading font-black text-ink text-2xl">Weather Monitor</h1>
          <p className="text-sm text-fog mt-0.5">Lightning safety tracking for Aquatics — 8-mile / 30-min rule</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={handlePollNow}
              className="text-10 font-bold tracking-widests uppercase px-3 py-1.5 rounded-lg border border-rim/50 text-fog hover:text-fog-hi hover:border-rim transition-colors"
            >
              Refresh Now
            </button>
            <button
              onClick={() => setShowOverride(v => !v)}
              className="text-10 font-bold tracking-widests uppercase px-3 py-1.5 rounded-lg border border-rim/50 text-fog hover:text-fog-hi hover:border-rim transition-colors"
            >
              Manual Override
            </button>
          </div>
        )}
      </div>

      {/* Manual override panel */}
      {showOverride && isAdmin && (
        <div className="panel p-4 border-amber-500/30 space-y-3">
          <p className="label-xs">Manual Alert Override</p>
          <input
            type="text"
            className="field text-sm"
            placeholder="Optional note (e.g. 'Visible lightning, precautionary')"
            value={overrideNote}
            onChange={e => setOverrideNote(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleOverride(true)}
              disabled={overriding || (alert && override)}
              className="flex-1 rounded-lg px-3 py-2 text-xs font-semibold border bg-red-950/30 border-red-500/40 text-red-400 hover:bg-red-950/50 disabled:opacity-40 transition-colors"
            >
              {overriding ? 'Saving…' : 'Force Alert'}
            </button>
            <button
              onClick={() => handleOverride(false)}
              disabled={overriding || (!alert && !override)}
              className="flex-1 rounded-lg px-3 py-2 text-xs font-semibold border bg-green-950/30 border-green-500/40 text-green-400 hover:bg-green-950/50 disabled:opacity-40 transition-colors"
            >
              {overriding ? 'Saving…' : 'Force Clear'}
            </button>
          </div>
        </div>
      )}

      {/* Main status card */}
      <div className={`panel p-8 text-center transition-colors ${
        alert
          ? 'border-red-500/50 bg-red-950/10'
          : 'border-green-500/30 bg-green-950/5'
      }`}>
        <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full mb-5 ${
          alert ? 'bg-red-500/15 border-2 border-red-500/40' : 'bg-green-500/10 border-2 border-green-500/25'
        }`}>
          {alert ? <AlertLightningIcon /> : <ClearIcon />}
        </div>

        <h2 className={`font-heading font-black text-4xl ${alert ? 'text-red-400' : 'text-green-400'}`}>
          {alert ? 'LIGHTNING ALERT' : 'ALL CLEAR'}
        </h2>

        {alert && override && (
          <p className="mt-1 text-amber-400 text-xs font-semibold uppercase tracking-widest">Manual Override Active</p>
        )}

        {alert && !override && status?.distanceMi != null && (
          <p className="mt-2 text-fog text-sm">
            Lightning detected <span className="text-red-300 font-semibold">{status.distanceMi} mi</span> away
          </p>
        )}

        {alert && countdown != null && (
          <div className="mt-4 inline-flex items-center gap-2 bg-void/60 border border-rim/40 rounded-xl px-5 py-2.5">
            <ClockIcon />
            <span className="text-sm text-fog-hi font-semibold">
              {countdown > 0
                ? `${countdown} min remaining until all-clear window`
                : 'Waiting for confirmation…'}
            </span>
          </div>
        )}

        {!alert && status?.allClearAt && (
          <p className="mt-2 text-fog text-sm">
            All clear since{' '}
            <span className="text-green-300 font-semibold">
              {format(parseISO(status.allClearAt), 'h:mm a')}
            </span>
          </p>
        )}

        {!alert && !status?.allClearAt && (
          <p className="mt-2 text-fog text-sm">No lightning activity detected within 8 miles</p>
        )}

        {status?.distanceMi != null && !alert && (
          <p className="mt-1 text-fog/60 text-xs">
            Nearest activity: {status.distanceMi} mi
          </p>
        )}
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="panel p-4">
          <p className="label-xs mb-1">Last Checked</p>
          <p className="text-sm text-ink font-semibold">
            {status?.lastPollAt
              ? format(parseISO(status.lastPollAt), 'h:mm:ss a')
              : '—'}
          </p>
          <p className="text-10 text-fog mt-0.5">Updates every 3 min</p>
        </div>
        <div className="panel p-4">
          <p className="label-xs mb-1">Last Strike (within range)</p>
          <p className="text-sm text-ink font-semibold">
            {status?.lastStrikeAt
              ? format(parseISO(status.lastStrikeAt), 'MMM d, h:mm a')
              : 'None recorded today'}
          </p>
        </div>
        <div className="panel p-4">
          <p className="label-xs mb-1">Alert Radius</p>
          <p className="text-sm text-ink font-semibold">8 miles</p>
          <p className="text-10 text-fog mt-0.5">30-min all-clear window</p>
        </div>
      </div>

      {/* Aquatics safety protocol reminder */}
      {alert && (
        <div className="panel p-5 border-red-500/30 bg-red-950/10 space-y-2">
          <p className="text-sm font-semibold text-red-300 flex items-center gap-2">
            <span className="w-4 h-4"><AlertLightningIcon /></span>
            Aquatics Safety Protocol — Immediate Action Required
          </p>
          <ul className="text-xs text-fog space-y-1.5 pl-2">
            <li className="flex items-start gap-2"><Dot /><span>Clear all guests from pools, slides, and water attractions immediately</span></li>
            <li className="flex items-start gap-2"><Dot /><span>Direct guests to covered shelter areas — do not allow guests to remain on deck</span></li>
            <li className="flex items-start gap-2"><Dot /><span>All Aquatics staff remain on duty to monitor and communicate</span></li>
            <li className="flex items-start gap-2"><Dot /><span>Do not reopen until ALL CLEAR is displayed and 30 minutes have elapsed</span></li>
            <li className="flex items-start gap-2"><Dot /><span>Notify management immediately if guests refuse to comply</span></li>
          </ul>
        </div>
      )}

      {/* Event log */}
      <div className="panel overflow-hidden">
        <div className="px-5 py-4 border-b border-rim/40">
          <h3 className="font-heading font-bold text-ink text-sm">Lightning Event Log</h3>
        </div>
        {events.length === 0 ? (
          <p className="px-5 py-8 text-center text-fog text-sm">No events recorded yet</p>
        ) : (
          <div className="divide-y divide-rim/30">
            {events.map(ev => (
              <div key={ev.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className={`text-10 font-bold uppercase px-2 py-0.5 rounded border ${EVENT_COLOR[ev.eventType] ?? 'text-fog border-rim/40'}`}>
                    {EVENT_LABELS[ev.eventType] ?? ev.eventType}
                  </span>
                  {ev.distanceMi && (
                    <span className="text-xs text-fog">{ev.distanceMi} mi</span>
                  )}
                  {ev.note && (
                    <span className="text-xs text-fog italic">"{ev.note}"</span>
                  )}
                  {ev.actorName && (
                    <span className="text-xs text-fog">by {ev.actorName}</span>
                  )}
                </div>
                <span className="text-10 text-fog/70 shrink-0">
                  {format(parseISO(ev.createdAt), 'MMM d, h:mm a')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* API error */}
      {status?.error && (
        <div className="panel p-4 border-amber-500/30 text-amber-400 text-xs flex items-center gap-2">
          <span className="w-4 h-4 shrink-0"><WarnIcon /></span>
          Weather service error: {status.error}
        </div>
      )}
    </div>
  );
}

function Dot() {
  return <span className="w-1 h-1 rounded-full bg-red-400/60 mt-1.5 shrink-0" />;
}

function AlertLightningIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-full h-full text-red-400">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-full h-full text-green-400">
      <circle cx="12" cy="12" r="10" />
      <polyline points="8 12 11 15 16 9" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-fog">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 15" />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-full h-full">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
