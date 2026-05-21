import { NavLink, Outlet } from 'react-router-dom';

const SUB_NAV = [
  { to: '/staff/manage', label: 'Staff', icon: TeamIcon },
];

export default function StaffLayout() {
  return (
    <div className="flex -mx-6 -mt-6 -mb-6" style={{ height: '100vh' }}>

      {/* Sub-sidebar */}
      <aside className="group/subnav w-[60px] hover:w-[88px] transition-[width] duration-200 ease-out shrink-0 flex flex-col bg-[#030A12] border-r border-rim/30 overflow-hidden">
        <div className="flex items-center justify-center h-12 shrink-0 border-b border-rim/20">
          <span className="text-10 font-black tracking-widest uppercase text-cyan whitespace-nowrap opacity-0 group-hover/subnav:opacity-100 transition-opacity duration-150 delay-75">
            Staff
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

function TeamIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-full h-full">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
