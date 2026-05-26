import { NavLink, Outlet } from 'react-router-dom';

const SUB_NAV = [
  { to: '/scheduler/schedule',    label: 'Sched',   icon: ScheduleIcon  },
  { to: '/scheduler/assignments', label: 'Assign',  icon: AssignIcon    },
  { to: '/scheduler/positions',   label: 'Roles',   icon: PositionsIcon },
  { to: '/scheduler/import',      label: 'Import',  icon: ImportIcon    },
  { to: '/scheduler/board',       label: 'Board',   icon: BoardIcon     },
];

export default function SchedulerLayout() {
  return (
    <div className="flex -mx-6 -mt-6 -mb-6" style={{ height: '100vh' }}>

      {/* Sub-sidebar */}
      <aside className="group/subnav w-[60px] hover:w-[88px] transition-[width] duration-200 ease-out shrink-0 flex flex-col bg-[#030A12] border-r border-rim/30 overflow-hidden">
        <div className="flex items-center justify-center h-12 shrink-0 border-b border-rim/20 overflow-hidden">
          <span className="text-10 font-black tracking-widest uppercase text-cyan whitespace-nowrap opacity-0 group-hover/subnav:opacity-100 transition-opacity duration-150 delay-75">
            Scheduler
          </span>
        </div>

        <nav className="flex-1 flex flex-col items-center py-3 gap-0.5">
          {SUB_NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center w-full h-14 transition-all duration-150 group/link
                 ${isActive ? 'text-cyan' : 'text-fog hover:text-fog-hi'}`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full transition-all duration-200
                    ${isActive ? 'bg-cyan opacity-100' : 'opacity-0'}`}
                  />
                  <span className={`w-5 h-5 transition-all duration-150
                    ${isActive ? 'drop-shadow-[0_0_8px_rgba(0,200,255,0.70)]' : 'group-hover/link:opacity-80'}`}>
                    <Icon />
                  </span>
                  <span className="max-h-0 opacity-0 group-hover/subnav:max-h-4 group-hover/subnav:opacity-100 group-hover/subnav:mt-1
                    transition-all duration-150 delay-75 overflow-hidden whitespace-nowrap
                    text-10 font-bold tracking-widest uppercase leading-none">
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Page content */}
      <div className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </div>
    </div>
  );
}

function ScheduleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-full h-full">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="15" x2="16" y2="15" />
    </svg>
  );
}

function PositionsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-full h-full">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      <line x1="19" y1="8" x2="23" y2="8" />
      <line x1="21" y1="6" x2="21" y2="10" />
    </svg>
  );
}

function AssignIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-full h-full">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ImportIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-full h-full">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  );
}

function BoardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-full h-full">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}
