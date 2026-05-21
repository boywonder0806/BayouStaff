import { useState, useRef, useEffect } from 'react';
import api from '../../../lib/api.js';
import { useAuth } from '../../../context/AuthContext.jsx';

const ALL_DEPTS = ['Aquatics', 'Food & Beverage', 'Guest Services', 'Cleaning Crew'];

const DEPT_STYLE = {
  'Aquatics':        { color: 'text-aq',   bar: 'bg-aq',   border: 'border-aq/40',   bg: 'bg-aq/10'   },
  'Food & Beverage': { color: 'text-fb',   bar: 'bg-fb',   border: 'border-fb/40',   bg: 'bg-fb/10'   },
  'Guest Services':  { color: 'text-gs',   bar: 'bg-gs',   border: 'border-gs/40',   bg: 'bg-gs/10'   },
  'Cleaning Crew':   { color: 'text-cc',   bar: 'bg-cc',   border: 'border-cc/40',   bg: 'bg-cc/10'   },
};

export default function Positions() {
  const { user } = useAuth();

  const accessibleDepts = (!user || user.role === 'sysadmin')
    ? ALL_DEPTS
    : ALL_DEPTS.filter(d => user.departments?.includes(d));

  const [positions, setPositions] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null);

  useEffect(() => {
    if (accessibleDepts.length > 0 && !selected) setSelected(accessibleDepts[0]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.get('/admin/departments/roles')
      .then(r => setPositions(r.data.roles.filter(e => e.type === 'position')))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const deptPositions = positions.filter(p => p.department === selected);
  const style = DEPT_STYLE[selected] ?? {};

  async function addPosition(name) {
    const trimmed = name.trim();
    if (!trimmed || !selected) return;
    const { data } = await api.post(
      `/admin/departments/${encodeURIComponent(selected)}/roles`,
      { name: trimmed, type: 'position', minCount: 1, maxCount: 1 }
    );
    setPositions(prev => [...prev, data.role]);
  }

  async function updatePosition(id, fields) {
    const { data } = await api.patch(`/admin/departments/roles/${id}`, fields);
    setPositions(prev => prev.map(p => p.id === id ? data.role : p));
  }

  async function deletePosition(id) {
    await api.delete(`/admin/departments/roles/${id}`);
    setPositions(prev => prev.filter(p => p.id !== id));
  }

  if (accessibleDepts.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-fog text-sm">
        No departments assigned to your account.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5" style={{ height: 'calc(100vh - 3rem)' }}>

      {/* Header */}
      <div className="flex items-end justify-between shrink-0">
        <div>
          <p className="label-xs mb-1">T&A / Positions</p>
          <h1 className="font-heading font-black text-ink text-3xl leading-none uppercase tracking-tight">Positions</h1>
        </div>
        <span className="text-10 text-fog pb-1">{positions.length} total</span>
      </div>

      <div className="flex-1 grid grid-cols-3 gap-5 min-h-0">

        {/* Dept list */}
        <div className="flex flex-col gap-2 min-h-0 overflow-y-auto pr-1">
          {accessibleDepts.map(dept => {
            const s = DEPT_STYLE[dept] ?? {};
            const count = positions.filter(p => p.department === dept).length;
            const isActive = dept === selected;
            return (
              <button
                key={dept}
                onClick={() => setSelected(dept)}
                className={`w-full text-left rounded-xl border px-4 py-3.5 transition-all relative overflow-hidden
                  ${isActive ? `${s.bg} ${s.border} ring-1 ring-inset ring-current/10` : 'bg-shell/30 border-rim/40 hover:bg-shell/60 hover:border-rim/60'}`}
              >
                {isActive && <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${s.bar}`} />}
                <div className="flex items-center justify-between pl-1">
                  <span className={`text-sm font-bold ${isActive ? s.color : 'text-ink'}`}>{dept}</span>
                  <span className="text-10 text-fog">{count}P</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Position editor */}
        <div className="col-span-2 panel p-6 flex flex-col gap-4 min-h-0 overflow-y-auto">
          {selected && (
            <>
              <div className="flex items-center gap-3 shrink-0">
                <div className={`w-1 h-6 rounded-full ${style.bar}`} />
                <h2 className={`font-heading font-black text-2xl leading-none ${style.color}`}>{selected}</h2>
                <span className="text-fog text-sm">{deptPositions.length} position{deptPositions.length !== 1 ? 's' : ''}</span>
              </div>

              {loading ? (
                <p className="text-fog text-sm text-center py-8">Loading…</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {deptPositions.length > 0 && (
                    <div className="grid grid-cols-[2rem_1fr_5rem_5rem_2.5rem] gap-2 px-4 items-center">
                      <span />
                      <span className="text-10 text-fog uppercase tracking-widest">Position</span>
                      <span className="text-10 text-fog uppercase tracking-widest text-center">Min</span>
                      <span className="text-10 text-fog uppercase tracking-widest text-center">Max</span>
                      <span />
                    </div>
                  )}

                  {deptPositions.map((pos, idx) => (
                    <PositionRow
                      key={pos.id}
                      pos={pos}
                      index={idx + 1}
                      style={style}
                      onUpdate={fields => updatePosition(pos.id, fields)}
                      onDelete={() => deletePosition(pos.id)}
                    />
                  ))}

                  {deptPositions.length === 0 && (
                    <p className="text-fog text-sm text-center py-6">No positions yet — add one below.</p>
                  )}

                  <AddInput dept={selected} style={style} onAdd={addPosition} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PositionRow({ pos, index, style, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [name, setName]       = useState(pos.name);
  const [desc, setDesc]       = useState(pos.description ?? '');
  const [min, setMin]         = useState(pos.minCount ?? 1);
  const [max, setMax]         = useState(pos.maxCount ?? 1);
  const nameRef = useRef(null);

  useEffect(() => {
    setName(pos.name); setDesc(pos.description ?? '');
    setMin(pos.minCount ?? 1); setMax(pos.maxCount ?? 1);
  }, [pos]);

  useEffect(() => { if (editing) nameRef.current?.focus(); }, [editing]);

  function commit() {
    const trimmed = name.trim();
    if (!trimmed) { cancel(); return; }
    const safeMin = Math.max(1, parseInt(min) || 1);
    const safeMax = Math.max(safeMin, parseInt(max) || 1);
    onUpdate({ name: trimmed, description: desc.trim() || null, minCount: safeMin, maxCount: safeMax });
    setEditing(false);
  }

  function cancel() {
    setName(pos.name); setDesc(pos.description ?? '');
    setMin(pos.minCount ?? 1); setMax(pos.maxCount ?? 1);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className={`rounded-xl border px-4 py-4 flex flex-col gap-3 ${style.bg} ${style.border}`}>
        <div className="flex items-center gap-2">
          <span className="text-10 text-fog font-mono w-5 text-center shrink-0">{String(index).padStart(2, '0')}</span>
          <input ref={nameRef} value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') cancel(); }}
            className="flex-1 bg-transparent text-sm font-semibold text-ink outline-none border-b border-current/40 pb-0.5"
            placeholder="Position name"
          />
        </div>
        <div className="pl-7 flex flex-col gap-2">
          <textarea rows={2} value={desc} onChange={e => setDesc(e.target.value)}
            className="field text-xs resize-none w-full"
            placeholder="Description — what does this position do?"
          />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-10 text-fog uppercase tracking-widest whitespace-nowrap">Min per shift</label>
              <input type="number" min={1} max={99} value={min} className="field text-sm w-16 text-center"
                onChange={e => { const v = Math.max(1, parseInt(e.target.value) || 1); setMin(v); if (max < v) setMax(v); }} />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-10 text-fog uppercase tracking-widest whitespace-nowrap">Max per shift</label>
              <input type="number" min={min} max={99} value={max} className="field text-sm w-16 text-center"
                onChange={e => setMax(Math.max(min, parseInt(e.target.value) || min))} />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button onClick={cancel} className="btn-ghost text-xs px-3 py-1.5">Cancel</button>
            <button onClick={commit} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${style.bg} ${style.border} ${style.color} hover:opacity-80`}>Save</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[2rem_1fr_5rem_5rem_2.5rem] gap-2 px-4 py-3 rounded-xl border items-start transition-all group bg-shell/40 border-rim/40 hover:border-rim/70 hover:bg-shell/60">
      <span className="text-10 text-fog font-mono text-center pt-0.5">{String(index).padStart(2, '0')}</span>
      <button className="text-left" onClick={() => setEditing(true)}>
        <p className="text-sm font-semibold text-ink leading-snug">{pos.name}</p>
        {pos.description
          ? <p className="text-10 text-fog mt-0.5">{pos.description}</p>
          : <p className="text-10 text-fog/40 italic opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">Add description…</p>
        }
      </button>
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-sm font-bold text-ink">{pos.minCount ?? 1}</span>
        <span className="text-10 text-fog/50">min</span>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-sm font-bold text-ink">{pos.maxCount ?? 1}</span>
        <span className="text-10 text-fog/50">max</span>
      </div>
      <div className="flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pt-0.5">
        <button onClick={() => setEditing(true)} className="p-1 rounded-md text-fog hover:text-fog-hi hover:bg-shell transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        <button onClick={onDelete} className="p-1 rounded-md text-fog hover:text-red-400 hover:bg-red-500/10 transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function AddInput({ dept, style, onAdd }) {
  const [value, setValue] = useState('');

  function submit() {
    if (!value.trim()) return;
    onAdd(value);
    setValue('');
  }

  return (
    <div className={`flex gap-2 p-3 rounded-xl border border-dashed ${style.border} mt-1`}>
      <input
        className="flex-1 bg-transparent text-sm text-ink placeholder-fog outline-none"
        placeholder={`Add a position to ${dept}…`}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); }}
      />
      <button onClick={submit} disabled={!value.trim()}
        className={`px-4 py-1.5 rounded-lg text-xs font-bold tracking-wide border transition-all
          ${value.trim() ? `${style.bg} ${style.border} ${style.color} hover:opacity-80` : 'border-rim/40 text-fog cursor-not-allowed opacity-50'}`}>
        Add
      </button>
    </div>
  );
}
