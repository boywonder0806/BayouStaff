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
  const [allEntries, setAllEntries]     = useState([]);
  const [descriptions, setDescriptions] = useState(
    Object.fromEntries(DEPT_META.map(d => [d.id, d.description]))
  );
  const [selectedId, setSelectedId] = useState('aquatics');
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    api.get('/admin/departments/roles')
      .then(r => setAllEntries(r.data.roles))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Build departments with roles and positions split
  const departments = DEPT_META.map(meta => {
    const entries = allEntries.filter(e => e.department === meta.name);
    return {
      ...meta,
      description: descriptions[meta.id],
      roles:     entries.filter(e => e.type === 'role'),
      positions: entries.filter(e => e.type === 'position'),
    };
  });

  const dept = departments.find(d => d.id === selectedId);

  async function addEntry(deptName, name, type) {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const { data } = await api.post(`/admin/departments/${encodeURIComponent(deptName)}/roles`, { name: trimmed, type });
      setAllEntries(prev => [...prev, data.role]);
    } catch (err) {
      console.error(err);
    }
  }

  async function renameEntry(id, name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const { data } = await api.patch(`/admin/departments/roles/${id}`, { name: trimmed });
      setAllEntries(prev => prev.map(e => e.id === id ? data.role : e));
    } catch (err) {
      console.error(err);
    }
  }

  async function deleteEntry(id) {
    try {
      await api.delete(`/admin/departments/roles/${id}`);
      setAllEntries(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

  const totalRoles     = allEntries.filter(e => e.type === 'role').length;
  const totalPositions = allEntries.filter(e => e.type === 'position').length;

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
        <div className="flex items-center gap-3 pb-1">
          {loading ? (
            <span className="text-10 text-fog">Loading…</span>
          ) : (
            <>
              <span className="text-10 text-fog">{totalRoles} roles</span>
              <span className="text-rim/60">·</span>
              <span className="text-10 text-fog">{totalPositions} positions</span>
            </>
          )}
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
                <div className="flex items-center justify-between pl-1 mb-1.5">
                  <span className={`text-sm font-bold ${isActive ? d.colorClass : 'text-ink'}`}>{d.name}</span>
                  <div className="flex items-center gap-1.5 text-10 text-fog">
                    <span>{d.roles.length}R</span>
                    <span className="opacity-40">·</span>
                    <span>{d.positions.length}P</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 pl-1">
                  {d.roles.slice(0, 3).map(r => (
                    <span key={r.id} className="text-10 text-fog bg-shell/60 border border-rim/40 rounded px-1.5 py-0.5">
                      {r.name}
                    </span>
                  ))}
                  {d.roles.length > 3 && (
                    <span className="text-10 text-fog">+{d.roles.length - 3}</span>
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
                </div>
                <DescriptionEditor
                  value={dept.description}
                  onChange={val => setDescriptions(prev => ({ ...prev, [dept.id]: val }))}
                />
              </div>
            </div>

            {loading ? (
              <p className="text-fog text-sm py-4 text-center">Loading…</p>
            ) : (
              <div className="flex flex-col gap-6">

                {/* ── Roles ── */}
                <EntrySection
                  label="Roles"
                  sublabel="Job titles — what a person is in this department"
                  entries={dept.roles}
                  dept={dept}
                  type="role"
                  onAdd={name => addEntry(dept.name, name, 'role')}
                  onRename={(id, name) => renameEntry(id, name)}
                  onDelete={id => deleteEntry(id)}
                />

                {/* Divider */}
                <div className="border-t border-rim/30" />

                {/* ── Positions ── */}
                <EntrySection
                  label="Positions"
                  sublabel="Specific spots assigned on a shift (Tower 1, Grill Station, Main Gate…)"
                  entries={dept.positions}
                  dept={dept}
                  type="position"
                  onAdd={name => addEntry(dept.name, name, 'position')}
                  onRename={(id, name) => renameEntry(id, name)}
                  onDelete={id => deleteEntry(id)}
                />

              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Entry section (shared by Roles and Positions) ────────────────────────────
function EntrySection({ label, sublabel, entries, dept, type, onAdd, onRename, onDelete }) {
  return (
    <div>
      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="label-xs">{label}</p>
          <p className="text-10 text-fog mt-0.5">{sublabel}</p>
        </div>
        <span className={`text-10 font-bold px-2 py-0.5 rounded-full border ${dept.bgClass} ${dept.borderClass} ${dept.colorClass}`}>
          {entries.length}
        </span>
      </div>

      <div className="space-y-2 mb-3">
        {entries.map((entry, idx) => (
          <EntryRow
            key={entry.id}
            entry={entry}
            index={idx + 1}
            dept={dept}
            onRename={name => onRename(entry.id, name)}
            onDelete={() => onDelete(entry.id)}
          />
        ))}
        {entries.length === 0 && (
          <p className="text-fog text-sm py-3 text-center">No {label.toLowerCase()} yet — add one below.</p>
        )}
      </div>

      <AddEntryInput
        dept={dept}
        type={type}
        onAdd={onAdd}
      />
    </div>
  );
}

// ── Entry row ─────────────────────────────────────────────────────────────────
function EntryRow({ entry, index, dept, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(entry.name);
  const inputRef = useRef(null);

  useEffect(() => { setDraft(entry.name); }, [entry.name]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  function commit() {
    if (draft.trim() && draft.trim() !== entry.name) onRename(draft.trim());
    else setDraft(entry.name);
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
            if (e.key === 'Escape') { setDraft(entry.name); setEditing(false); }
          }}
        />
      ) : (
        <button
          className="flex-1 text-sm font-semibold text-ink text-left hover:text-fog-hi transition-colors"
          onClick={() => setEditing(true)}
        >
          {entry.name}
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
          title="Delete"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

// ── Add entry input ───────────────────────────────────────────────────────────
function AddEntryInput({ dept, type, onAdd }) {
  const [value, setValue] = useState('');

  const placeholder = type === 'role'
    ? `Add a role to ${dept.name}…`
    : `Add a position to ${dept.name}…`;

  function submit() {
    if (!value.trim()) return;
    onAdd(value);
    setValue('');
  }

  return (
    <div className={`flex gap-2 p-3 rounded-xl border border-dashed ${dept.borderClass} ${dept.bgClass}/30`}>
      <input
        className="flex-1 bg-transparent text-sm text-ink placeholder-fog outline-none"
        placeholder={placeholder}
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

// ── Inline description editor ────────────────────────────────────────────────
function DescriptionEditor({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value);

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
