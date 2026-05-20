import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

const PAGE_TITLES = {
  '/home':     'Home',
  '/schedule': 'My Schedule',
  '/messages': 'Messages',
  '/admin':    'Dashboard',
};

export default function Header() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const title = PAGE_TITLES[pathname] ?? 'Blue Bayou Staff';

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <header className="h-16 bg-white border-b border-bb-border flex items-center justify-between px-6 shrink-0">
      <div>
        <h1 className="font-heading font-bold text-navy text-lg leading-tight">{title}</h1>
        <p className="text-bb-muted text-xs">{dateStr}</p>
      </div>
      <div className="flex items-center gap-4">
        <NotificationBell />
        <div className="text-right hidden sm:block">
          <p className="text-sm font-semibold text-navy leading-tight">{user?.name}</p>
          <p className="text-xs text-bb-muted">{user?.department}</p>
        </div>
      </div>
    </header>
  );
}

function NotificationBell() {
  return (
    <button className="relative p-2 rounded-lg hover:bg-bb-bg text-bb-muted hover:text-navy transition-colors">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-bb-cyan rounded-full" />
    </button>
  );
}
