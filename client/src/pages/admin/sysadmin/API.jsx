import { useState } from 'react';
import { format } from 'date-fns';

const INTEGRATIONS = [
  {
    id: 'netchex',
    name: 'Netchex HRM',
    description: 'Employee data, schedules, and payroll',
    status: 'disconnected',
    version: 'v3',
    baseUrl: 'https://api.netchex.com',
    docsUrl: 'https://developers.netchex.com/docs',
    authType: 'API Key (x-api-key header)',
  },
  {
    id: 'digitalocean',
    name: 'DigitalOcean',
    description: 'Hosting and managed PostgreSQL database',
    status: 'connected',
    version: 'v2',
    baseUrl: 'https://api.digitalocean.com',
    authType: 'Bearer Token',
  },
  {
    id: 'smtp',
    name: 'Email / SMTP',
    description: 'Transactional email for notifications',
    status: 'not_configured',
    version: null,
    baseUrl: null,
    authType: 'SMTP Credentials',
  },
];

const RECENT_CALLS = [
  { id: 1, method: 'GET',   path: '/api/announcements/home', status: 200, ms: 42,  time: '2026-05-18T10:42:11Z' },
  { id: 2, method: 'GET',   path: '/api/admin/employees',    status: 200, ms: 38,  time: '2026-05-18T10:42:09Z' },
  { id: 3, method: 'GET',   path: '/api/admin/stats',        status: 200, ms: 31,  time: '2026-05-18T10:42:08Z' },
  { id: 4, method: 'PATCH', path: '/api/admin/employees/3/role', status: 200, ms: 55, time: '2026-05-18T10:38:01Z' },
  { id: 5, method: 'POST',  path: '/api/auth/login',         status: 401, ms: 12,  time: '2026-05-16T22:11:05Z' },
  { id: 6, method: 'POST',  path: '/api/auth/login',         status: 401, ms: 10,  time: '2026-05-16T22:10:58Z' },
  { id: 7, method: 'GET',   path: '/api/schedule',           status: 200, ms: 67,  time: '2026-05-16T09:15:00Z' },
];

const STATUS_STYLE = {
  connected:      { dot: 'bg-green-400', text: 'text-green-400',  badge: 'bg-green-400/10 border-green-400/25 text-green-400',  label: 'Connected'     },
  disconnected:   { dot: 'bg-red-400',   text: 'text-red-400',    badge: 'bg-red-400/10 border-red-400/25 text-red-400',        label: 'Disconnected'  },
  not_configured: { dot: 'bg-fog',       text: 'text-fog',        badge: 'bg-shell border-rim/60 text-fog',                     label: 'Not Configured'},
};

const METHOD_COLOR = {
  GET:    'text-cyan   bg-cyan/10   border-cyan/20',
  POST:   'text-green-400 bg-green-400/10 border-green-400/20',
  PATCH:  'text-gold   bg-gold/10   border-gold/20',
  DELETE: 'text-red-400 bg-red-400/10 border-red-400/20',
};

export default function SysAdminAPI() {
  const [selected, setSelected]   = useState(INTEGRATIONS[0]);
  const [apiKey, setApiKey]       = useState('');
  const [keyVisible, setKeyVisible] = useState(false);
  const [bearerToken, setBearerToken] = useState('');
  const [smtpHost, setSmtpHost]   = useState('');
  const [smtpUser, setSmtpUser]   = useState('');
  const [smtpPass, setSmtpPass]   = useState('');
  const [testing, setTesting]     = useState(false);
  const [testResult, setTestResult] = useState(null);

  function handleTest() {
    setTesting(true);
    setTestResult(null);
    setTimeout(() => {
      setTesting(false);
      setTestResult(selected.id === 'netchex' && !apiKey
        ? { ok: false, msg: 'No API key provided.' }
        : { ok: false, msg: 'Connection refused — service may be unreachable in dev mode.' });
    }, 1400);
  }

  const ss = STATUS_STYLE[selected.status];

  return (
    <div className="flex flex-col gap-5" style={{ height: 'calc(100vh - 3rem)' }}>

      {/* Header */}
      <div className="flex items-end justify-between shrink-0">
        <div>
          <p className="label-xs mb-1">System Admin / API</p>
          <h1 className="font-heading font-black text-ink text-3xl leading-none uppercase tracking-tight">
            API Management
          </h1>
        </div>
        <div className="flex items-center gap-2 pb-1">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-400/10 border border-green-400/20">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span className="text-10 font-bold tracking-widest uppercase text-green-400">Internal API Online</span>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-3 gap-5 min-h-0">

        {/* Left — integration list */}
        <div className="flex flex-col gap-3 min-h-0">
          <p className="label-xs shrink-0">Integrations</p>
          <div className="space-y-2">
            {INTEGRATIONS.map(intg => {
              const s = STATUS_STYLE[intg.status];
              const isActive = selected.id === intg.id;
              return (
                <button
                  key={intg.id}
                  onClick={() => { setSelected(intg); setTestResult(null); }}
                  className={`w-full text-left rounded-xl border px-4 py-3.5 transition-all
                    ${isActive
                      ? 'bg-shell border-rim/80 ring-1 ring-inset ring-rim/40'
                      : 'bg-shell/30 border-rim/40 hover:bg-shell/60 hover:border-rim/60'
                    }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-ink">{intg.name}</span>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                  </div>
                  <p className="text-10 text-fog">{intg.description}</p>
                  <p className={`text-10 font-bold tracking-widest uppercase mt-2 ${s.text}`}>{s.label}</p>
                </button>
              );
            })}
          </div>

          {/* System info */}
          <div className="panel p-4 mt-auto shrink-0">
            <p className="label-xs mb-3">Internal API</p>
            <div className="space-y-2 text-xs">
              <InfoRow label="Base URL"    value="/api" />
              <InfoRow label="Auth"        value="JWT Bearer" />
              <InfoRow label="Port"        value="3001" />
              <InfoRow label="Expiry"      value="8 hours" />
            </div>
          </div>
        </div>

        {/* Center — config */}
        <div className="panel p-5 flex flex-col gap-5 min-h-0 overflow-y-auto">
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="label-xs">{selected.name}</p>
              <span className={`text-10 font-bold tracking-widest uppercase px-2 py-0.5 rounded-full border ${ss.badge}`}>
                {ss.label}
              </span>
            </div>
            <p className="text-10 text-fog">{selected.description}</p>
          </div>

          {selected.baseUrl && (
            <div>
              <label className="label-xs block mb-2">Base URL</label>
              <input className="field text-xs font-mono" value={selected.baseUrl} readOnly />
            </div>
          )}

          {selected.version && (
            <div>
              <label className="label-xs block mb-2">API Version</label>
              <input className="field text-xs font-mono" value={selected.version} readOnly />
            </div>
          )}

          <div>
            <label className="label-xs block mb-2">Auth Type</label>
            <input className="field text-xs" value={selected.authType} readOnly />
          </div>

          {/* Netchex fields */}
          {selected.id === 'netchex' && (
            <div>
              <label className="label-xs block mb-2">API Key</label>
              <div className="flex gap-2">
                <input
                  type={keyVisible ? 'text' : 'password'}
                  className="field flex-1 text-xs font-mono"
                  placeholder="Paste your x-api-key…"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                />
                <button
                  onClick={() => setKeyVisible(v => !v)}
                  className="btn-ghost border border-rim/60 rounded-md px-3 text-xs shrink-0"
                >
                  {keyVisible ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          )}

          {/* DigitalOcean fields */}
          {selected.id === 'digitalocean' && (
            <div>
              <label className="label-xs block mb-2">Personal Access Token</label>
              <div className="flex gap-2">
                <input
                  type={keyVisible ? 'text' : 'password'}
                  className="field flex-1 text-xs font-mono"
                  placeholder="dop_v1_…"
                  value={bearerToken}
                  onChange={e => setBearerToken(e.target.value)}
                />
                <button
                  onClick={() => setKeyVisible(v => !v)}
                  className="btn-ghost border border-rim/60 rounded-md px-3 text-xs shrink-0"
                >
                  {keyVisible ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          )}

          {/* SMTP fields */}
          {selected.id === 'smtp' && (
            <div className="space-y-3">
              <div>
                <label className="label-xs block mb-2">SMTP Host</label>
                <input className="field text-xs font-mono" placeholder="smtp.example.com" value={smtpHost} onChange={e => setSmtpHost(e.target.value)} />
              </div>
              <div>
                <label className="label-xs block mb-2">Username</label>
                <input className="field text-xs" placeholder="noreply@bluebayou.com" value={smtpUser} onChange={e => setSmtpUser(e.target.value)} />
              </div>
              <div>
                <label className="label-xs block mb-2">Password</label>
                <input className="field text-xs font-mono" type="password" placeholder="••••••••" value={smtpPass} onChange={e => setSmtpPass(e.target.value)} />
              </div>
            </div>
          )}

          {/* Docs link */}
          {selected.docsUrl && (
            <p className="text-10 text-fog">
              Docs: <span className="text-cyan font-mono">{selected.docsUrl}</span>
            </p>
          )}

          {/* Test + Save */}
          <div className="flex gap-2 mt-auto pt-2 border-t border-rim/40">
            <button
              onClick={handleTest}
              disabled={testing}
              className="btn-ghost border border-rim/60 rounded-md flex-1 text-xs"
            >
              {testing ? 'Testing…' : 'Test Connection'}
            </button>
            <button className="btn-primary flex-1 text-xs">Save</button>
          </div>
          {testResult && (
            <p className={`text-10 font-semibold ${testResult.ok ? 'text-green-400' : 'text-red-400'}`}>
              {testResult.ok ? '✓' : '✗'} {testResult.msg}
            </p>
          )}
        </div>

        {/* Right — recent API calls */}
        <div className="panel p-5 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <p className="label-xs">Recent Calls</p>
            <span className="text-10 text-fog">{RECENT_CALLS.length} requests</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {RECENT_CALLS.map(call => {
              const mc = METHOD_COLOR[call.method] ?? 'text-fog bg-shell border-rim';
              const statusOk = call.status < 400;
              return (
                <div key={call.id} className="bg-shell/40 border border-rim/40 rounded-lg px-3 py-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-10 font-black tracking-widest px-1.5 py-0.5 rounded border shrink-0 ${mc}`}>
                      {call.method}
                    </span>
                    <span className={`text-10 font-bold shrink-0 ${statusOk ? 'text-green-400' : 'text-red-400'}`}>
                      {call.status}
                    </span>
                    <span className="text-10 text-fog shrink-0">{call.ms}ms</span>
                  </div>
                  <p className="text-xs text-fog-hi font-mono truncate">{call.path}</p>
                  <p className="text-10 text-fog/60 mt-0.5">{format(new Date(call.time), 'MMM d, h:mm:ss a')}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-fog">{label}</span>
      <span className="font-semibold text-fog-hi font-mono">{value}</span>
    </div>
  );
}
