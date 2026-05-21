import { useState, useEffect } from 'react';
import { Avatar, DEPT_COLOR } from '../../../components/Layout/Sidebar.jsx';

export default function ManageStaff() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [selected, setSelected]   = useState(null);

  useEffect(() => {
    fetch('/api/admin/employees', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setEmployees((d.employees ?? []).filter(e => e.role === 'crew_member'));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const depts = ['All', ...Array.from(new Set(employees.map(e => e.department).filter(Boolean))).sort()];

  const filtered = employees.filter(e => {
    const matchSearch = !search ||
      e.name?.toLowerCase().includes(search.toLowerCase()) ||
      e.email?.toLowerCase().includes(search.toLowerCase()) ||
      e.position?.toLowerCase().includes(search.toLowerCase());
    const matchDept = deptFilter === 'All' || e.department === deptFilter;
    return matchSearch && matchDept;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading font-bold text-xl text-fog-hi">Manage Staff</h1>
          <p className="text-sm text-fog mt-0.5">{employees.length} employee{employees.length !== 1 ? 's' : ''} synced</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search name, email, position…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-surface border border-rim/40 rounded-lg px-3 py-2 text-sm text-fog-hi placeholder:text-fog/50 focus:outline-none focus:border-cyan/50 w-64"
        />
        <div className="flex gap-1 flex-wrap">
          {depts.map(d => (
            <button
              key={d}
              onClick={() => setDeptFilter(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                deptFilter === d
                  ? 'bg-cyan/20 text-cyan border border-cyan/40'
                  : 'bg-surface border border-rim/30 text-fog hover:text-fog-hi'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-fog text-sm py-8 text-center">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-fog text-sm py-8 text-center">No employees found.</div>
      ) : (
        <div className="bg-surface border border-rim/30 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rim/20 text-fog text-xs font-semibold tracking-wider uppercase">
                <th className="text-left px-4 py-3">Employee</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Department</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Position</th>
                <th className="text-left px-4 py-3 hidden xl:table-cell">Phone</th>
                <th className="text-left px-4 py-3 hidden xl:table-cell">Hired</th>
                <th className="text-center px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp, i) => {
                const color = DEPT_COLOR[emp.department];
                return (
                  <tr
                    key={emp.id}
                    onClick={() => setSelected(emp)}
                    className={`border-b border-rim/10 cursor-pointer transition-colors hover:bg-white/[0.03]
                      ${i === filtered.length - 1 ? 'border-0' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar initials={emp.avatar} dept={emp.department} />
                        <div>
                          <div className="font-semibold text-fog-hi">{emp.name}</div>
                          <div className="text-fog text-xs">{emp.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`text-xs font-semibold ${color?.text ?? 'text-fog'}`}>
                        {emp.department ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-fog">{emp.position ?? '—'}</td>
                    <td className="px-4 py-3 hidden xl:table-cell text-fog">{emp.phone ?? '—'}</td>
                    <td className="px-4 py-3 hidden xl:table-cell text-fog">
                      {emp.hireDate ? new Date(emp.hireDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                        emp.isActive
                          ? 'bg-green-500/15 text-green-400 border border-green-500/25'
                          : 'bg-red-500/15 text-red-400 border border-red-500/25'
                      }`}>
                        {emp.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Profile modal */}
      {selected && <ProfileModal emp={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function ProfileModal({ emp, onClose }) {
  const color = DEPT_COLOR[emp.department];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#0A1628] border border-rim/40 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Color bar */}
        <div className={`h-1 w-full ${color?.bar ?? 'bg-cyan'}`} />

        {/* Profile header */}
        <div className="p-6 border-b border-rim/20 flex items-center gap-4">
          <Avatar initials={emp.avatar} dept={emp.department} />
          <div className="flex-1 min-w-0">
            <h2 className="font-heading font-bold text-fog-hi text-lg leading-tight">{emp.name}</h2>
            <p className="text-fog text-sm">{emp.position ?? 'No position'}</p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
            emp.isActive
              ? 'bg-green-500/15 text-green-400 border border-green-500/25'
              : 'bg-red-500/15 text-red-400 border border-red-500/25'
          }`}>
            {emp.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>

        {/* Details grid */}
        <div className="p-6 grid grid-cols-2 gap-4">
          <Field label="Employee ID" value={emp.id ?? '—'} />
          <Field label="Department" value={
            <span className={color?.text ?? 'text-fog'}>{emp.department ?? '—'}</span>
          } />
          <Field label="Email" value={emp.email ?? '—'} />
          <Field label="Phone" value={emp.phone ?? '—'} />
          <Field label="Hire Date" value={
            emp.hireDate
              ? new Date(emp.hireDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
              : '—'
          } />
          {emp.departments?.length > 1 && (
            <Field label="All Departments" value={emp.departments.join(', ')} />
          )}
        </div>

        <div className="px-6 pb-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-surface border border-rim/40 text-fog hover:text-fog-hi text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-fog mb-1">{label}</div>
      <div className="text-fog-hi text-sm">{value}</div>
    </div>
  );
}
