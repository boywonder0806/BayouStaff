import { useState, useEffect, useRef } from 'react';
import api from '../../../lib/api.js';

const ALL_DEPARTMENTS = ['Aquatics', 'Guest Services', 'Food & Beverage', 'Cleaning Crew', 'Management'];

export default function SysAdminCertifications() {
  const [certs, setCerts]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showAdd, setShowAdd]   = useState(false);
  const [editId, setEditId]     = useState(null);

  useEffect(() => {
    api.get('/admin/certifications')
      .then(r => setCerts(r.data.certifications))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd(form) {
    try {
      const { data } = await api.post('/admin/certifications', form);
      setCerts(prev => [...prev, data.certification].sort((a, b) => a.name.localeCompare(b.name)));
      setShowAdd(false);
    } catch (err) {
      return err.response?.data?.error || 'Failed to create';
    }
  }

  async function handleEdit(id, form) {
    try {
      const { data } = await api.patch(`/admin/certifications/${id}`, form);
      setCerts(prev => prev.map(c => c.id === id ? data.certification : c).sort((a, b) => a.name.localeCompare(b.name)));
      setEditId(null);
    } catch (err) {
      return err.response?.data?.error || 'Failed to update';
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/admin/certifications/${id}`);
      setCerts(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="flex flex-col gap-5" style={{ height: 'calc(100vh - 3rem)' }}>

      {/* Header */}
      <div className="flex items-end justify-between shrink-0">
        <div>
          <p className="label-xs mb-1">System Admin / Certifications</p>
          <h1 className="font-heading font-black text-ink text-3xl leading-none uppercase tracking-tight">
            Certifications
          </h1>
        </div>
        <button
          onClick={() => { setShowAdd(true); setEditId(null); }}
          className="btn-primary text-xs px-4 py-2"
        >
          + New Certification
        </button>
      </div>

      <p className="text-sm text-fog-hi shrink-0 -mt-2">
        Define certifications that qualify staff to be scheduled for specific positions.
        Assign them to employees in the Users section.
      </p>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <p className="text-fog text-sm py-8 text-center">Loading…</p>
        ) : (
          <div className="flex flex-col gap-2">
            {showAdd && (
              <CertForm
                onSave={handleAdd}
                onCancel={() => setShowAdd(false)}
              />
            )}

            {certs.length === 0 && !showAdd && (
              <div className="panel p-10 text-center">
                <p className="text-fog text-sm mb-1">No certifications defined yet.</p>
                <p className="text-fog text-xs">Click "+ New Certification" to create the first one.</p>
              </div>
            )}

            {certs.map(cert => (
              editId === cert.id ? (
                <CertForm
                  key={cert.id}
                  initial={cert}
                  onSave={form => handleEdit(cert.id, form)}
                  onCancel={() => setEditId(null)}
                />
              ) : (
                <CertCard
                  key={cert.id}
                  cert={cert}
                  onEdit={() => { setEditId(cert.id); setShowAdd(false); }}
                  onDelete={() => handleDelete(cert.id)}
                />
              )
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Cert card ─────────────────────────────────────────────────────────────────
function CertCard({ cert, onEdit, onDelete }) {
  return (
    <div className="panel px-5 py-4 flex items-start gap-4 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-ink text-sm">{cert.name}</span>
          {cert.department && (
            <span className="text-10 px-2 py-0.5 rounded-full bg-shell border border-rim/50 text-fog font-medium">
              {cert.department}
            </span>
          )}
        </div>
        {cert.description && (
          <p className="text-xs text-fog-hi leading-relaxed">{cert.description}</p>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={onEdit}
          className="p-1.5 rounded-md text-fog hover:text-fog-hi hover:bg-shell transition-colors"
          title="Edit"
        >
          <PencilIcon />
        </button>
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

// ── Cert form (add / edit) ────────────────────────────────────────────────────
function CertForm({ initial, onSave, onCancel }) {
  const [name, setName]           = useState(initial?.name || '');
  const [department, setDept]     = useState(initial?.department || '');
  const [description, setDesc]    = useState(initial?.description || '');
  const [error, setError]         = useState('');
  const [saving, setSaving]       = useState(false);
  const nameRef = useRef(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    setError('');
    const err = await onSave({ name: name.trim(), department: department || null, description: description.trim() || null });
    setSaving(false);
    if (err) setError(err);
  }

  return (
    <form
      onSubmit={submit}
      className="panel px-5 py-4 border border-dashed border-rim/60 flex flex-col gap-3"
    >
      <p className="label-xs">{initial ? 'Edit Certification' : 'New Certification'}</p>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-10 text-fog uppercase tracking-widest">Name *</label>
          <input
            ref={nameRef}
            className="field text-sm"
            placeholder="e.g. Cashier Certification"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-10 text-fog uppercase tracking-widest">Department (optional)</label>
          <select
            className="field text-sm"
            value={department}
            onChange={e => setDept(e.target.value)}
          >
            <option value="">All Departments</option>
            {ALL_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-10 text-fog uppercase tracking-widest">Description (optional)</label>
        <textarea
          className="field text-sm resize-none"
          rows={2}
          placeholder="What does this certification allow an employee to do?"
          value={description}
          onChange={e => setDesc(e.target.value)}
        />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex items-center gap-2 justify-end">
        <button type="button" onClick={onCancel} className="btn-ghost text-xs px-4 py-1.5">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn-primary text-xs px-4 py-1.5">
          {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create'}
        </button>
      </div>
    </form>
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
