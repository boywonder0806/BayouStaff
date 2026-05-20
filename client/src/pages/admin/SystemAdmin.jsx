import { useState, useEffect, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

export const ROLES = [
  { value: 'crew_member', label: 'Crew Member',         style: 'bg-rim/40 border-rim text-fog-hi',        active: 'bg-shell border-fog-hi/40 text-ink' },
  { value: 'manager',     label: 'Manager',              style: 'bg-cyan/10 border-cyan/20 text-cyan',      active: 'bg-cyan/15 border-cyan/40 text-cyan' },
  { value: 'sysadmin',    label: 'System Administrator', style: 'bg-gold/10 border-gold/25 text-gold',      active: 'bg-gold/15 border-gold/40 text-gold' },
];

const AUDIT_LOG = [
  { id: 1, event: 'User login',          actor: 'manager@bluebayou.com',  time: '2026-05-18T10:42:00Z', level: 'info'  },
  { id: 2, event: 'Announcement posted', actor: 'manager@bluebayou.com',  time: '2026-05-17T16:05:00Z', level: 'info'  },
  { id: 3, event: 'Role updated',        actor: 'sysadmin@bluebayou.com', time: '2026-05-16T09:30:00Z', level: 'warn'  },
  { id: 4, event: 'Failed login attempt',actor: 'unknown',                time: '2026-05-15T22:11:00Z', level: 'error' },
  { id: 5, event: 'Schedule exported',   actor: 'manager@bluebayou.com',  time: '2026-05-15T14:00:00Z', level: 'info'  },
  { id: 6, event: 'User login',          actor: 'sarah@bluebayou.com',    time: '2026-05-15T08:55:00Z', level: 'info'  },
];

const LEVEL_STYLE = {
  info:  { dot: 'bg-cyan',    badge: 'bg-cyan/10 border-cyan/20 text-cyan'           },
  warn:  { dot: 'bg-gold',    badge: 'bg-gold/10 border-gold/20 text-gold'           },
  error: { dot: 'bg-red-400', badge: 'bg-red-500/10 border-red-500/20 text-red-400' },
};

export default function SystemAdmin() {
  const { user: me } = useAuth();
  const [staff, setStaff]             = useState([]);
  const [selected, setSelected]       = useState(null);
  const [netchexKey, setNetchexKey]   = useState('');
  const [maintenance, setMaintenance] = useState(false);
  const [keyVisible, setKeyVisible]   = useState(false);

  useEffect(() => {
    api.get('/admin/employees')
      .then(r => setStaff(r.data.employees))
      .catch(console.error);
  }, []);

  function handleRoleUpdate(userId, newRole) {
    setStaff(prev => prev.map(s => s.id === userId ? { ...s, role: newRole } : s));
    if (selected?.id === userId) setSelected(s => ({ ...s, role: newRole }));
  }

  return (
    <div className="flex flex-col gap-5" style={{ height: 'calc(100vh - 3rem)' }}>

      {/* Header */}
      <div className="flex items-end justify-between shrink-0">
        <div>
          <p className="label-xs mb-1">Master Settings</p>
          <h1 className="font-heading font-black text-ink text-4xl leading-none uppercase tracking-tight">
            System Admin
          </h1>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-10 font-bold tracking-widest uppercase bg-gold/10 border border-gold/25 text-gold">
          <span className="w-1.5 h-1.5 rounded-full bg-gold inline-block" />
          Restricted Access
        </span>
      </div>

      {/* Main grid */}
      <div className="flex-1 grid grid-cols-3 gap-5 min-h-0">

        {/* Left column */}
        <div className="flex flex-col gap-5 min-h-0">

          {/* Netchex Integration */}
          <div className="panel p-5 flex flex-col gap-4">
            <div>
              <p className="label-xs mb-2">Netchex HRM</p>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-xs text-fog-hi font-semibold">Not connected</span>
              </div>
            </div>
            <div>
              <label className="label-xs block mb-2">API Key</label>
              <div className="flex gap-2">
                <input
                  type={keyVisible ? 'text' : 'password'}
                  className="field flex-1 text-xs font-mono"
                  placeholder="x-api-key value…"
                  value={netchexKey}
                  onChange={e => setNetchexKey(e.target.value)}
                />
                <button
                  onClick={() => setKeyVisible(v => !v)}
                  className="btn-ghost border border-rim/60 rounded-md px-3 text-xs shrink-0"
                >
                  {keyVisible ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <div>
              <label className="label-xs block mb-2">API Version</label>
              <input className="field text-xs font-mono" defaultValue="v3" readOnly />
            </div>
            <button className="btn-primary w-full text-xs mt-1" disabled={!netchexKey}>
              Connect &amp; Verify
            </button>
          </div>

          {/* System Info */}
          <div className="panel p-5 flex flex-col gap-4">
            <p className="label-xs">System</p>
            <div className="space-y-3 text-xs">
              <InfoRow label="Environment" value="Production" />
              <InfoRow label="App Version"  value="1.0.0" />
              <InfoRow label="Node"         value="v20.x" />
              <InfoRow label="Database"     value="PostgreSQL (pending)" accent="text-fog" />
              <InfoRow label="Netchex API"  value="v3 (stubbed)"        accent="text-fog" />
            </div>
            <div className="border-t border-rim/40 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-ink">Maintenance Mode</p>
                  <p className="text-10 text-fog mt-0.5">Blocks all non-admin logins</p>
                </div>
                <button
                  onClick={() => setMaintenance(m => !m)}
                  className={`relative w-10 h-5 rounded-full transition-colors duration-200 shrink-0
                    ${maintenance ? 'bg-gold' : 'bg-rim'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200
                    ${maintenance ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
              {maintenance && (
                <p className="text-10 text-gold mt-2 font-bold tracking-wide">Maintenance mode is active</p>
              )}
            </div>
          </div>
        </div>

        {/* Middle column — Access Control */}
        <div className="panel p-5 flex flex-col min-h-0">
          <div className="mb-4 shrink-0">
            <p className="label-xs mb-1">Access Control</p>
            <p className="text-10 text-fog">Click a user to manage their account.</p>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {staff.map(s => {
              const role = ROLES.find(r => r.value === s.role) ?? ROLES[0];
              return (
                <button
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className="w-full flex items-center gap-3 bg-shell/40 hover:bg-shell border border-rim/40 hover:border-rim/80 rounded-lg px-3 py-2.5 text-left transition-all group"
                >
                  <div className="w-9 h-9 rounded-full bg-shell border border-rim flex items-center justify-center text-xs font-heading font-bold text-fog-hi shrink-0 group-hover:border-rim/80">
                    {s.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{s.name}</p>
                    <p className="text-10 text-fog truncate">{s.position} · {s.department}</p>
                  </div>
                  <span className={`text-10 font-bold tracking-widest uppercase px-2 py-0.5 rounded-full border shrink-0 ${role.style}`}>
                    {role.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right column — Audit Log */}
        <div className="panel p-5 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <p className="label-xs">Audit Log</p>
            <button className="btn-ghost border border-rim/60 rounded-md px-3 py-1 text-10 font-bold tracking-widest uppercase">
              Export
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {AUDIT_LOG.map(entry => {
              const s = LEVEL_STYLE[entry.level];
              return (
                <div key={entry.id} className="bg-shell/40 border border-rim/40 rounded-lg px-3 py-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
                    <span className="text-xs font-semibold text-ink flex-1">{entry.event}</span>
                    <span className={`text-10 font-bold tracking-widest uppercase px-1.5 py-0.5 rounded border ${s.badge}`}>
                      {entry.level}
                    </span>
                  </div>
                  <p className="text-10 text-fog truncate pl-3.5">{entry.actor}</p>
                  <p className="text-10 text-fog/60 pl-3.5 mt-0.5">
                    {format(new Date(entry.time), 'MMM d, h:mm a')}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* User modal */}
      {selected && (
        <UserModal
          user={selected}
          isSelf={selected.id === me?.id}
          onClose={() => setSelected(null)}
          onRoleUpdate={handleRoleUpdate}
          onStaffUpdate={(updated) => {
            setStaff(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } : s));
            setSelected(s => ({ ...s, ...updated }));
          }}
        />
      )}
    </div>
  );
}

const ALL_DEPARTMENTS = ['Aquatics', 'Guest Services', 'Food & Beverage', 'Cleaning Crew', 'Management'];

const DEPT_STYLES = {
  'Aquatics':        { active: 'bg-aq/15 border-aq/40 text-aq',   base: 'text-aq'   },
  'Guest Services':  { active: 'bg-gs/15 border-gs/40 text-gs',   base: 'text-gs'   },
  'Food & Beverage': { active: 'bg-fb/15 border-fb/40 text-fb',   base: 'text-fb'   },
  'Cleaning Crew':   { active: 'bg-cc/15 border-cc/40 text-cc',   base: 'text-cc'   },
  'Management':      { active: 'bg-mgmt/15 border-mgmt/40 text-mgmt', base: 'text-mgmt' },
};

// ── User Management Modal ─────────────────────────────────────────────────────
function UserModal({ user, isSelf, onClose, onRoleUpdate, onStaffUpdate }) {
  const navigate = useNavigate();
  const backdropRef = useRef(null);

  const [saving, setSaving]               = useState(false);
  const [pwMode, setPwMode]               = useState(false);
  const [newPassword, setNewPassword]     = useState('');
  const [pwError, setPwError]             = useState('');
  const [pwSuccess, setPwSuccess]         = useState(false);
  const [deactivateStep, setDeactivateStep] = useState(false);
  const [deptAccess, setDeptAccess]       = useState(user.departments ?? []);
  const [deptSaving, setDeptSaving]       = useState(false);
  const [deptSuccess, setDeptSuccess]     = useState(false);
  const [allCerts, setAllCerts]           = useState([]);
  const [empCertIds, setEmpCertIds]       = useState(new Set());
  const [certLoading, setCertLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/admin/certifications'),
      api.get(`/admin/employees/${user.id}/certifications`),
    ]).then(([allRes, empRes]) => {
      setAllCerts(allRes.data.certifications);
      setEmpCertIds(new Set(empRes.data.certifications.map(c => c.id)));
    }).catch(console.error).finally(() => setCertLoading(false));
  }, [user.id]);

  async function toggleCert(cert) {
    const has = empCertIds.has(cert.id);
    if (has) {
      try {
        await api.delete(`/admin/employees/${user.id}/certifications/${cert.id}`);
        setEmpCertIds(prev => { const n = new Set(prev); n.delete(cert.id); return n; });
      } catch (err) { console.error(err); }
    } else {
      try {
        await api.post(`/admin/employees/${user.id}/certifications`, { certificationId: cert.id });
        setEmpCertIds(prev => new Set([...prev, cert.id]));
      } catch (err) { console.error(err); }
    }
  }

  const role = ROLES.find(r => r.value === user.role) ?? ROLES[0];

  function handleBackdrop(e) {
    if (e.target === backdropRef.current) onClose();
  }

  async function handleRoleChange(newRole) {
    if (newRole === user.role || isSelf) return;
    setSaving(true);
    try {
      await api.patch(`/admin/employees/${user.id}/role`, { role: newRole });
      onRoleUpdate(user.id, newRole);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordReset() {
    setPwError('');
    if (newPassword.length < 6) { setPwError('Minimum 6 characters.'); return; }
    setSaving(true);
    try {
      await api.patch(`/admin/employees/${user.id}/password`, { password: newPassword });
      setPwSuccess(true);
      setNewPassword('');
      setTimeout(() => { setPwSuccess(false); setPwMode(false); }, 2000);
    } catch (err) {
      setPwError(err.response?.data?.error || 'Failed to reset password.');
    } finally {
      setSaving(false);
    }
  }

  function toggleDept(dept) {
    setDeptAccess(prev =>
      prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]
    );
    setDeptSuccess(false);
  }

  async function handleDeptSave() {
    setDeptSaving(true);
    try {
      const { data } = await api.patch(`/admin/employees/${user.id}/departments`, { departments: deptAccess });
      onStaffUpdate(data.user);
      setDeptSuccess(true);
      setTimeout(() => setDeptSuccess(false), 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setDeptSaving(false);
    }
  }

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdrop}
      className="fixed inset-0 z-50 flex items-center justify-center bg-void/70 backdrop-blur-sm"
    >
      <div className="w-full max-w-2xl mx-4 bg-deep border border-rim/60 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

        {/* Modal header */}
        <div className="relative bg-shell/60 border-b border-rim/40 px-7 py-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-deep border-2 border-rim flex items-center justify-center font-heading font-black text-lg text-fog-hi shrink-0">
              {user.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="font-heading font-black text-ink text-xl leading-none">{user.name}</h2>
                {isSelf && <span className="text-10 text-fog font-bold tracking-widest uppercase">(you)</span>}
                <span className={`text-10 font-bold tracking-widest uppercase px-2.5 py-1 rounded-full border ${role.style}`}>
                  {role.label}
                </span>
              </div>
              <p className="text-sm text-fog mt-1">{user.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-shell hover:bg-rim/60 border border-rim/60 flex items-center justify-center text-fog hover:text-ink transition-colors"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Modal body */}
        <div className="p-7 space-y-6 overflow-y-auto flex-1">

          {/* Account info grid */}
          <div>
            <p className="label-xs mb-3">Account Information</p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <Field label="Email"      value={user.email} />
              <Field label="Phone"      value={user.phone ?? '—'} />
              <Field label="Department" value={user.department} />
              <Field label="Position"   value={user.position} />
              <Field label="Employee ID" value={`#${String(user.id).padStart(4, '0')}`} />
              <Field label="Hire Date"  value={user.hireDate ? format(parseISO(user.hireDate), 'MMMM d, yyyy') : '—'} />
            </div>
          </div>

          {/* Role assignment */}
          <div>
            <p className="label-xs mb-3">Role Assignment {isSelf && <span className="normal-case font-normal tracking-normal text-fog ml-1">— cannot edit your own role</span>}</p>
            <div className="flex gap-2 flex-wrap">
              {ROLES.map(r => (
                <button
                  key={r.value}
                  disabled={isSelf || saving}
                  onClick={() => handleRoleChange(r.value)}
                  className={`flex-1 py-2.5 px-3 rounded-lg border text-xs font-bold tracking-wide transition-all
                    ${user.role === r.value
                      ? r.active + ' ring-1 ring-inset ring-current/30'
                      : 'bg-shell/40 border-rim/50 text-fog hover:border-rim hover:text-fog-hi'
                    }
                    ${isSelf ? 'opacity-40 cursor-not-allowed' : saving ? 'opacity-60 cursor-wait' : 'cursor-pointer'}
                  `}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Department Access — managers only */}
          {user.role === 'manager' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="label-xs">Department Access</p>
                {deptSuccess && <span className="text-10 text-green-400 font-semibold">Saved.</span>}
              </div>
              <p className="text-10 text-fog mb-3">This manager can only view and edit shifts in the selected departments.</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {ALL_DEPARTMENTS.map(d => {
                  const isOn = deptAccess.includes(d);
                  const style = DEPT_STYLES[d];
                  return (
                    <button
                      key={d}
                      onClick={() => !isSelf && toggleDept(d)}
                      disabled={isSelf}
                      className={`px-3 py-2 rounded-lg border text-xs font-bold tracking-wide transition-all
                        ${isOn
                          ? style.active + ' ring-1 ring-inset ring-current/20'
                          : 'bg-shell/40 border-rim/50 text-fog hover:border-rim hover:text-fog-hi'
                        }
                        ${isSelf ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={handleDeptSave}
                disabled={deptSaving || isSelf}
                className="btn-primary text-xs px-4 py-2"
              >
                {deptSaving ? 'Saving…' : 'Save Department Access'}
              </button>
            </div>
          )}

          {/* Certifications */}
          <div>
            <p className="label-xs mb-1">Certifications</p>
            <p className="text-10 text-fog mb-3">Toggle certifications this employee has completed. These qualify them for specific scheduled positions.</p>
            {certLoading ? (
              <p className="text-10 text-fog">Loading…</p>
            ) : allCerts.length === 0 ? (
              <p className="text-10 text-fog">No certifications defined yet. Add them in <span className="text-fog-hi">SysAdmin → Certifications</span>.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {allCerts.map(cert => {
                  const has = empCertIds.has(cert.id);
                  return (
                    <button
                      key={cert.id}
                      onClick={() => toggleCert(cert)}
                      title={cert.description || cert.name}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all
                        ${has
                          ? 'bg-cyan/15 border-cyan/40 text-cyan ring-1 ring-inset ring-cyan/20'
                          : 'bg-shell/40 border-rim/50 text-fog hover:border-rim hover:text-fog-hi'
                        }`}
                    >
                      {cert.name}
                      {cert.department && <span className="ml-1.5 opacity-60 font-normal">· {cert.department}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Account actions */}
          <div>
            <p className="label-xs mb-3">Account Actions</p>
            <div className="grid grid-cols-2 gap-3">

              {/* Reset password */}
              <div className="bg-shell/40 border border-rim/40 rounded-xl p-4">
                <p className="text-xs font-semibold text-ink mb-1">Reset Password</p>
                <p className="text-10 text-fog mb-3">Set a new password for this account.</p>
                {!pwMode ? (
                  <button
                    onClick={() => { setPwMode(true); setPwSuccess(false); setPwError(''); }}
                    className="btn-ghost border border-rim/60 rounded-md w-full text-xs"
                  >
                    Reset Password
                  </button>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="password"
                      className="field text-xs"
                      placeholder="New password (min 6 chars)"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      autoFocus
                    />
                    {pwError && <p className="text-10 text-red-400 font-semibold">{pwError}</p>}
                    {pwSuccess && <p className="text-10 text-green-400 font-semibold">Password updated.</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={handlePasswordReset}
                        disabled={saving}
                        className="btn-primary flex-1 text-xs py-2"
                      >
                        {saving ? 'Saving…' : 'Confirm'}
                      </button>
                      <button
                        onClick={() => { setPwMode(false); setNewPassword(''); setPwError(''); }}
                        className="btn-ghost border border-rim/60 rounded-md flex-1 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick actions */}
              <div className="bg-shell/40 border border-rim/40 rounded-xl p-4 flex flex-col gap-2">
                <p className="text-xs font-semibold text-ink mb-1">Quick Actions</p>
                <button
                  onClick={() => navigate('/messages')}
                  className="btn-ghost border border-rim/60 rounded-md w-full text-xs text-left px-3"
                >
                  Send Message
                </button>
                <button
                  onClick={() => navigate('/schedule')}
                  className="btn-ghost border border-rim/60 rounded-md w-full text-xs text-left px-3"
                >
                  View Schedule
                </button>
              </div>
            </div>

            {/* Deactivate — full width, danger zone */}
            {!isSelf && (
              <div className="mt-3 bg-red-950/20 border border-red-500/20 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-red-300">Deactivate Account</p>
                    <p className="text-10 text-fog mt-0.5">Revokes access immediately. This can be reversed.</p>
                  </div>
                  {!deactivateStep ? (
                    <button
                      onClick={() => setDeactivateStep(true)}
                      className="shrink-0 ml-4 px-4 py-2 rounded-md text-xs font-bold text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-colors"
                    >
                      Deactivate
                    </button>
                  ) : (
                    <div className="flex gap-2 ml-4 shrink-0">
                      <button
                        onClick={() => setDeactivateStep(false)}
                        className="px-3 py-2 rounded-md text-xs font-bold text-fog border border-rim/60 hover:text-ink transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        className="px-3 py-2 rounded-md text-xs font-bold bg-red-500 text-white hover:bg-red-600 transition-colors"
                      >
                        Confirm Deactivate
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function InfoRow({ label, value, accent = 'text-fog-hi' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-fog">{label}</span>
      <span className={`font-semibold ${accent}`}>{value}</span>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="label-xs mb-1">{label}</p>
      <p className="text-sm text-ink font-semibold">{value}</p>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
