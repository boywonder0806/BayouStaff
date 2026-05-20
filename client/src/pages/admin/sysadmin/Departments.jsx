import { useState, useRef, useEffect } from 'react';
import api from '../../../lib/api.js';

const DEPT_META = [
  {
    id: 'aquatics',
    name: 'Aquatics',
    colorClass: 'text-aq',
    barClass: 'bg-aq',
    borderClass: 'border-aq/40',
    bgClass: 'bg-aq/10',
    description: 'Pool and water attraction safety and operations. Staff are responsible for guest safety across all aquatic areas.',
  },
  {
    id: 'guest_services',
    name: 'Guest Services',
    colorClass: 'text-gs',
    barClass: 'bg-gs',
    borderClass: 'border-gs/40',
    bgClass: 'bg-gs/10',
    description: 'Guest experience, ticketing, and park entry operations. First point of contact for all park visitors.',
  },
  {
    id: 'food_beverage',
    name: 'Food & Beverage',
    colorClass: 'text-fb',
    barClass: 'bg-fb',
    borderClass: 'border-fb/40',
    bgClass: 'bg-fb/10',
    description: 'Food stands, concessions, and beverage service throughout the park.',
  },
  {
    id: 'cleaning_crew',
    name: 'Cleaning Crew',
    colorClass: 'text-cc',
    barClass: 'bg-cc',
    borderClass: 'border-cc/40',
    bgClass: 'bg-cc/10',
    description: 'Park-wide cleanliness, sanitation, and waste management to ensure a safe and welcoming environment.',
  },
  {
    id: 'management',
    name: 'Management',
    colorClass: 'text-mgmt',
    barClass: 'bg-mgmt',
    borderClass: 'border-mgmt/40',
    bgClass: 'bg-mgmt/10',
    description: 'Park leadership, operations oversight, and cross-departmental coordination.',
  },
];

export default function SysAdminDepartments() {
  const [rolesByDept, setRolesByDept]   = useState({});
  const [descriptions, setDescriptions] = useState(
    Object.fromEntries(DEPT_META.map(d => [d.id, d.description]))
  );
  const [selectedId, setSelectedId] = useState('aquatics');
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    api.get('/admin/departments/roles')
      .then(r => {
        const grouped = {};
        for (const role of r.data.roles) {
          if (!grouped[role.department]) grouped[role.department] = [];
          grouped[role.department].push(role);
        }
        setRolesByDept(grouped);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const departments = DEPT_META.map(meta => ({
    ...meta,
    description: descriptions[meta.id],
    subRoles: rolesByDept[meta.name] || [],
  }));

  const dept = departments.find(d => d.id === selectedId);

  async function addSubRole(deptName, name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const { data } = await api.post(`/admin/departments/${encodeURIComponent(deptName)}/roles`, { name: trimmed });
      setRolesByDept(prev => ({
        ...prev,
        [deptName]: [...(prev[deptName] || []), data.role],
      }));
    } catch (err) {
      console.error(err);
    }
  }

  async function renameSubRole(deptName, roleId, name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const { data } = await api.patch(`/admin/departments/roles/${roleId}`, { name: trimmed });
      setRolesByDept(prev => ({
        ...prev,
        [deptName]: prev[deptName].map(r => r.id === roleId ? data.role : r),
      }));
    } catch (err) {
      console.error(err);
    }
  }

  async function deleteSubRole(deptName, roleId) {
    try {
      await api.delete(`/admin/departments/roles/${roleId}`);
      setRolesByDept(prev => ({
        ...prev,
        [deptName]: prev[deptName].filter(r => r.id !== roleId),
      }));
    } catch (err) {
      console.error(err);
    }
  }

  const totalPositions = Object.values(rolesByDept).reduce((n, arr) => n + arr.length, 0);

  return (
    <div className="flex flex-col gap-5" style={{ height: 'calc(100vh - 3rem)' }}>

      {/* Header */}
      <div className="flex items-end justify-between shrink-0">
        <div>
          <p className="label-xs mb-1">System Admin / Departments</p>
          <h1 className="font-heading font-black text-ink text-3xl leading-none uppercase tracking-tight">
            Departments
          </h1>
        </div>
        <div className="flex items-center gap-2 pb-1">
          {loading
            ? <span className="text-10 text-fog">Loading…</span>
            : <span className="text-10 text-fog">{DEPT_META.length} departments · {totalPositions} positions</span>
          }
        </div>
      </div>

      <div className="flex-1 grid grid-cols-3 gap-5 min-h-0">

        {/* Left — department list */}
        <div className="flex flex-col gap-2 min-h-0 overflow-y-auto pr-1">
          {departments.map(d => {
            const isActive = d.id === selectedId;
            return (
              <button
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className={`w-full text-left rounded-xl border px-4 py-3.5 transition-all relative overflow-hidden
                  ${isActive
                    ? `${d.bgClass} ${d.borderClass} ring-1 ring-inset ring-current/10`
                    : 'bg-shell/30 border-rim/40 hover:bg-shell/60 hover:border-rim/60'
                  }`}
              >
                {isActive && <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${d.barClass}`} />}
                <div className="flex items-center justify-between mb-1 pl-1">
                  <span className={`text-sm font-bold ${isActive ? d.colorClass : 'text-ink'}`}>{d.name}</span>
                  <span className="text-10 text-fog">{d.subRoles.length} positions</span>
                </div>
                <div className="flex flex-wrap gap-1 pl-1 mt-2">
                  {d.subRoles.slice(0, 3).map(r => (
                    <span key={r.id} className="text-10 text-fog bg-shell/60 border border-rim/40 rounded px-1.5 py-0.5">
                      {r.name}
                    </span>
                  ))}
                  {d.subRoles.length > 3 && (
                    <span className="text-10 text-fog">+{d.subRoles.length - 3} more</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Right — department config (spans 2 cols) */}
        {dept && (
          <div className="col-span-2 panel p-6 flex flex-col gap-6 min-h-0 overflow-y-auto">

            {/* Dept header */}
            <div className="flex items-start gap-4">
              <div className={`w-1 self-stretch rounded-full ${dept.barClass} shrink-0`} />
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h2 className={`font-heading font-black text-2xl leading-none ${dept.colorClass}`}>{dept.name}</h2>
                  <span className={`text-10 font-bold tracking-widest uppercase px-2 py-0.5 rounded-full border ${dept.bgClass} ${dept.borderClass} ${dept.colorClass}`}>
                    {dept.subRoles.length} positions
                  </span>
                </div>
                <DescriptionEditor
                  value={dept.description}
                  onChange={val => setDescriptions(prev => ({ ...prev, [dept.id]: val }))}
                />
              </div>
            </div>

            {/* Sub-roles */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-3">
                <p className="label-xs">Positions / Sub-Roles</p>
                <p className="text-10 text-fog">Click any position to rename</p>
              </div>

              {loading ? (
                <p className="text-fog text-sm py-4 text-center">Loading positions…</p>
              ) : (
                <>
                  <div className="space-y-2 mb-4">
                    {dept.subRoles.map((role, idx) => (
                      <SubRoleRow
                        key={role.id}
                        role={role}
                        index={idx + 1}
                        dept={dept}
                        onRename={name => renameSubRole(dept.name, role.id, name)}
                        onDelete={() => deleteSubRole(dept.name, role.id)}
                      />
                    ))}
                    {dept.subRoles.length === 0 && (
                      <p className="text-fog text-sm py-4 text-center">No positions yet — add one below.</p>
                    )}
                  </div>
                  <AddRoleInput dept={dept} onAdd={name => addSubRole(dept.name, name)} />
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Inline description editor ────────────────────────────────────────────────
function DescriptionEditor({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value);
  const ref = useRef(null);

  useEffect(() => { setDraft(value); }, [value]);

  function commit() {
    onChange(draft.trim() || value);
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-sm text-fog-hi text-left leading-relaxed hover:text-ink transition-colors group w-full"
      >
        {value}
        <span className="ml-2 text-10 text-fog opacity-0 group-hover:opacity-100 tracking-widest uppercase">edit</span>
      </button>
    );
  }

  return (
    <textarea
      ref={ref}
      className="field text-sm w-full resize-none leading-relaxed"
      rows={2}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { setDraft(value); setEditing(false); }
      }}
      autoFocus
    />
  );
}

// ── Sub-role row ─────────────────────────────────────────────────────────────
function SubRoleRow({ role, index, dept, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(role.name);
  const inputRef = useRef(null);

  useEffect(() => { setDraft(role.name); }, [role.name]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  function commit() {
    if (draft.trim() && draft.trim() !== role.name) onRename(draft.trim());
    else setDraft(role.name);
    setEditing(false);
  }

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all group
      ${editing ? `${dept.bgClass} ${dept.borderClass}` : 'bg-shell/40 border-rim/40 hover:border-rim/70 hover:bg-shell/60'}`}
    >
      <span className="text-10 text-fog font-mono w-5 text-center shrink-0">{String(index).padStart(2, '0')}</span>

      {editing ? (
        <input
          ref={inputRef}
          className="flex-1 bg-transparent text-sm font-semibold text-ink outline-none border-b border-current pb-0.5"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') { setDraft(role.name); setEditing(false); }
          }}
        />
      ) : (
        <button
          className="flex-1 text-sm font-semibold text-ink text-left hover:text-fog-hi transition-colors"
          onClick={() => setEditing(true)}
        >
          {role.name}
        </button>
      )}

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="p-1.5 rounded-md text-fog hover:text-fog-hi hover:bg-shell transition-colors"
            title="Rename"
          >
            <PencilIcon />
          </button>
        )}
        <button
          onClick={onDelete}
          className="p-1.5 rounded-md text-fog hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title="Remove position"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

// ── Add role input ────────────────────────────────────────────────────────────
function AddRoleInput({ dept, onAdd }) {
  const [value, setValue] = useState('');

  function submit() {
    if (!value.trim()) return;
    onAdd(value);
    setValue('');
  }

  return (
    <div className={`flex gap-2 p-3 rounded-xl border border-dashed ${dept.borderClass} ${dept.bgClass}/30`}>
      <input
        className="flex-1 bg-transparent text-sm text-ink placeholder-fog outline-none"
        placeholder={`Add a position to ${dept.name}…`}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); }}
      />
      <button
        onClick={submit}
        disabled={!value.trim()}
        className={`px-4 py-1.5 rounded-lg text-xs font-bold tracking-wide border transition-all
          ${value.trim()
            ? `${dept.bgClass} ${dept.borderClass} ${dept.colorClass} hover:opacity-80`
            : 'border-rim/40 text-fog cursor-not-allowed opacity-50'
          }`}
      >
        Add
      </button>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}
