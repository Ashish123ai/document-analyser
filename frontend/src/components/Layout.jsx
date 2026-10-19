import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { FileText, History, LayoutDashboard, LogOut, Menu, MessageSquare, Moon, Sun, UserCircle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/chat', label: 'Ask a question', icon: MessageSquare },
  { to: '/history', label: 'History', icon: History },
  { to: '/profile', label: 'Profile', icon: UserCircle },
];

export const Logo = ({ light = false }) => (
  <span className="flex items-center gap-2.5">
    <span className={`grid h-8 w-8 place-items-center rounded-md font-serif text-lg leading-none ${light ? 'bg-mark text-ink' : 'bg-ink text-mark'}`} aria-hidden>§</span>
    <span className={`text-[15px] font-semibold tracking-tight ${light ? 'text-white' : 'text-ink'}`}>Legal Analyzer</span>
  </span>
);

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState(() => window.localStorage.getItem('legal-analyzer-theme') || 'dark');
  const location = useLocation();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('legal-analyzer-theme', theme);
  }, [theme]);

  const themeButton = (
    <button
      type="button"
      onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
      className="theme-toggle btn-ghost btn-sm !px-2.5"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      aria-pressed={theme === 'dark'}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
      <span className="hidden sm:inline lg:hidden">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
    </button>
  );

  const sidebar = (
    <nav className="flex h-full flex-col" aria-label="Main">
      <div className="flex items-center justify-between gap-2 px-5 py-5"><Logo />{themeButton}</div>
      <ul className="flex-1 space-y-0.5 px-3">
        {NAV.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `nav-option flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-seal-tint text-seal' : 'text-muted hover:bg-paper hover:text-ink'}`
              }
            >
              <Icon className="h-4 w-4" aria-hidden /> {label}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="border-t border-rule p-4">
        <p className="truncate text-sm font-medium">{user?.name}</p>
        <p className="truncate text-[13px] text-muted">{user?.email}</p>
        <button onClick={logout} className="btn-ghost btn-sm -ml-3 mt-2"><LogOut className="h-4 w-4" aria-hidden /> Sign out</button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">Skip to content</a>

      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-rule bg-white lg:block">{sidebar}</aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-rule bg-white px-4 py-3 lg:hidden">
        <Logo />
        <div className="flex items-center gap-2">{themeButton}<button onClick={() => setOpen(true)} className="btn-ghost p-2" aria-label="Open menu"><Menu className="h-5 w-5" /></button></div>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-64 bg-white">
            <button onClick={() => setOpen(false)} className="btn-ghost absolute right-2 top-3 p-2" aria-label="Close menu"><X className="h-5 w-5" /></button>
            {sidebar}
          </div>
        </div>
      )}

      <main id="main" key={location.pathname.split('/')[1]} className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-9">
        <div className="mx-auto max-w-5xl"><Outlet /></div>
      </main>
    </div>
  );
}
