import { useState, useRef } from 'react';
import api from '../../../lib/api.js';

const CONFIDENCE_STYLE = {
  high:   'bg-green-500/15 text-green-400 border-green-500/25',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  low:    'bg-red-500/15   text-red-400   border-red-500/25',
};

export default function NetchexImport() {
  const [step, setStep]         = useState('upload');   // upload | review | done
  const [draft, setDraft]       = useState(null);
  const [edited, setEdited]     = useState(null);
  const [parsing, setParsing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [importId, setImportId] = useState(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  async function handleFile(file) {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a PDF file.');
      return;
    }
    setError('');
    setParsing(true);
    try {
      const bytes = await file.arrayBuffer();
      const res   = await fetch('/api/netchex/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/pdf', 'x-file-name': file.name },
        body: bytes,
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Parse failed.'); return; }
      setDraft(data);
      setEdited({ ...data, shifts: data.shifts.map(s => ({ ...s })) });
      setStep('review');
    } catch (e) {
      setError('Failed to upload PDF.');
    } finally {
      setParsing(false);
    }
  }

  function updateShift(id, field, value) {
    setEdited(prev => ({
      ...prev,
      shifts: prev.shifts.map(s => s.temporaryId === id ? { ...s, [field]: value } : s),
    }));
  }

  function removeShift(id) {
    setEdited(prev => ({ ...prev, shifts: prev.shifts.filter(s => s.temporaryId !== id) }));
  }

  async function handleConfirm() {
    setSaving(true);
    setError('');
    try {
      const { data } = await api.post('/netchex/import/confirm', edited);
      setImportId(data.importId);
      setStep('done');
    } catch (e) {
      setError(e.response?.data?.error ?? 'Failed to save import.');
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setStep('upload'); setDraft(null); setEdited(null);
    setError(''); setImportId(null);
  }

  return (
    <div className="flex flex-col gap-5" style={{ height: 'calc(100vh - 3rem)' }}>

      {/* Header */}
      <div className="flex items-end justify-between shrink-0">
        <div>
          <p className="label-xs mb-1">T&A / Netchex Import</p>
          <h1 className="font-heading font-black text-ink text-3xl leading-none uppercase tracking-tight">
            Import Schedule
          </h1>
        </div>
        {step !== 'upload' && (
          <div className="flex items-center gap-3 pb-1">
            {['upload','review','done'].map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border transition-colors
                  ${step === s ? 'bg-cyan border-cyan text-deep' :
                    ['upload','review','done'].indexOf(step) > i ? 'bg-cyan/20 border-cyan/40 text-cyan' :
                    'border-rim/40 text-fog'}`}>
                  {i + 1}
                </div>
                <span className={`text-xs font-semibold uppercase tracking-widest
                  ${step === s ? 'text-cyan' : 'text-fog'}`}>
                  {s === 'upload' ? 'Upload' : s === 'review' ? 'Review' : 'Done'}
                </span>
                {i < 2 && <span className="text-fog/30 text-xs">›</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Step 1: Upload ── */}
      {step === 'upload' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-lg">
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all
                ${dragging ? 'border-cyan bg-cyan/5' : 'border-rim/40 hover:border-rim/70 hover:bg-shell/20'}`}
            >
              <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-cyan/10 border border-cyan/20 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7 text-cyan">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              </div>
              <p className="text-fog-hi font-semibold text-base mb-1">
                {parsing ? 'Parsing PDF…' : 'Drop your Netchex schedule PDF here'}
              </p>
              <p className="text-fog text-sm">or click to browse · max 8 MB</p>
              {parsing && (
                <div className="mt-4 flex justify-center">
                  <div className="w-5 h-5 border-2 border-cyan border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".pdf" className="hidden"
              onChange={e => handleFile(e.target.files[0])} />
            {error && <p className="text-red-400 text-sm mt-3 text-center">{error}</p>}
          </div>
        </div>
      )}

      {/* ── Step 2: Review ── */}
      {step === 'review' && edited && (
        <div className="flex-1 flex flex-col min-h-0 gap-4">

          {/* Summary bar */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="panel px-4 py-2.5 flex items-center gap-3">
              <span className="text-fog text-sm">File:</span>
              <span className="text-fog-hi text-sm font-semibold">{edited.sourceFileName}</span>
            </div>
            <div className="panel px-4 py-2.5 flex items-center gap-3">
              <span className="text-fog text-sm">Week:</span>
              <span className="text-cyan text-sm font-semibold">
                {edited.dateRangeStart} – {edited.dateRangeEnd}
              </span>
            </div>
            <div className="panel px-4 py-2.5 flex items-center gap-3">
              <span className="text-fog text-sm">Shifts:</span>
              <span className="text-fog-hi text-sm font-semibold">{edited.shifts.length}</span>
            </div>
            {edited.warnings?.length > 0 && (
              <div className="panel px-4 py-2.5 flex items-center gap-2 border-amber-500/30">
                <span className="text-amber-400 text-xs">⚠</span>
                <span className="text-amber-400 text-xs font-semibold">{edited.warnings.length} warning{edited.warnings.length !== 1 ? 's' : ''}</span>
              </div>
            )}
            <div className="ml-auto flex gap-2">
              <button onClick={reset} className="btn-ghost border border-rim/60 text-sm">Back</button>
              <button onClick={handleConfirm} disabled={saving || edited.shifts.length === 0}
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed text-sm">
                {saving ? 'Saving…' : `Confirm ${edited.shifts.length} shift${edited.shifts.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>

          {error && <p className="text-red-400 text-sm shrink-0">{error}</p>}

          {/* Shift table */}
          <div className="flex-1 min-h-0 panel rounded-xl overflow-hidden">
            <div className="overflow-auto h-full">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-deep z-10">
                  <tr className="border-b border-rim/30">
                    <th className="text-left px-4 py-3 label-xs w-8">#</th>
                    <th className="text-left px-4 py-3 label-xs">Employee</th>
                    <th className="text-left px-4 py-3 label-xs">Date</th>
                    <th className="text-left px-4 py-3 label-xs">Start</th>
                    <th className="text-left px-4 py-3 label-xs">End</th>
                    <th className="text-left px-4 py-3 label-xs">Department</th>
                    <th className="text-center px-4 py-3 label-xs">Conf.</th>
                    <th className="px-4 py-3 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {edited.shifts.map((s, i) => (
                    <tr key={s.temporaryId} className={`border-b border-rim/10 ${i % 2 === 0 ? '' : 'bg-shell/10'}`}>
                      <td className="px-4 py-2 text-fog/50 text-xs font-mono">{i + 1}</td>
                      <td className="px-4 py-2">
                        <input value={s.employeeName} onChange={e => updateShift(s.temporaryId, 'employeeName', e.target.value)}
                          className="bg-transparent text-fog-hi text-sm w-full outline-none border-b border-transparent hover:border-rim/40 focus:border-cyan/50 transition-colors" />
                      </td>
                      <td className="px-4 py-2">
                        <input type="date" value={s.shiftDate} onChange={e => updateShift(s.temporaryId, 'shiftDate', e.target.value)}
                          className="bg-transparent text-fog text-sm outline-none border-b border-transparent hover:border-rim/40 focus:border-cyan/50 transition-colors" />
                      </td>
                      <td className="px-4 py-2">
                        <input type="time" value={s.startTime} onChange={e => updateShift(s.temporaryId, 'startTime', e.target.value)}
                          className="bg-transparent text-fog text-sm outline-none border-b border-transparent hover:border-rim/40 focus:border-cyan/50 transition-colors" />
                      </td>
                      <td className="px-4 py-2">
                        <input type="time" value={s.endTime} onChange={e => updateShift(s.temporaryId, 'endTime', e.target.value)}
                          className="bg-transparent text-fog text-sm outline-none border-b border-transparent hover:border-rim/40 focus:border-cyan/50 transition-colors" />
                      </td>
                      <td className="px-4 py-2">
                        <input value={s.departmentLabel} onChange={e => updateShift(s.temporaryId, 'departmentLabel', e.target.value)}
                          className="bg-transparent text-fog text-sm w-full outline-none border-b border-transparent hover:border-rim/40 focus:border-cyan/50 transition-colors" />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-10 font-bold border uppercase tracking-wider ${CONFIDENCE_STYLE[s.sourceConfidence] ?? ''}`}>
                          {s.sourceConfidence}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <button onClick={() => removeShift(s.temporaryId)}
                          className="text-fog/40 hover:text-red-400 transition-colors text-lg leading-none">×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Done ── */}
      {step === 'done' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-green-500/15 border border-green-500/25 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-8 h-8 text-green-400">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="font-heading font-bold text-fog-hi text-2xl mb-2">Import Confirmed</h2>
            <p className="text-fog text-sm mb-6">
              {edited?.shifts.length} shifts have been saved and are ready for assignment.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={reset} className="btn-ghost border border-rim/60 text-sm">Import Another</button>
              <a href="/scheduler/board" className="btn-primary text-sm px-5 py-2 rounded-lg inline-block">
                Go to Assignment Board →
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
