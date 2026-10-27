import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Scale,
  Sun,
  UserCircle,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

const APP_LINKS = [
  { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/app/analyze#upload', label: 'Analyze', icon: FileText },
  { to: '/app/compare', label: 'Compare', icon: Scale },
  { to: '/app/documents', label: 'Archive', icon: History },
];

const TOOL_LINKS = [
  { to: '/app/chat', label: 'Ask a contract', icon: MessageSquare },
  { to: '/app/history', label: 'Question history', icon: History },
  { to: '/app/profile', label: 'Account settings', icon: UserCircle },
];

const INSIGHT_LINKS = [
  { to: '/app/dashboard', label: 'Risk overview', icon: LayoutDashboard },
  { to: '/app/history', label: 'Recent questions', icon: MessageSquare },
];

export const Logo = ({ light = false }) => (
  <span className="flex shrink-0 items-center gap-2.5 whitespace-nowrap">
    <span className={`grid h-8 w-8 place-items-center rounded-md font-serif text-lg leading-none ${light ? 'bg-cyan-300 text-slate-950' : 'bg-slate-900 text-cyan-300'}`} aria-hidden>
      §
    </span>
    <span className={`text-[15px] font-semibold tracking-[0.08em] ${light ? 'text-white' : 'text-ink'}`}>
      INSIGHTLENS
    </span>
  </span>
);

function ThemeButton({ darkSurface = false }) {
  const { theme, toggleTheme } = useTheme();
  const Icon = theme === 'dark' ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`btn-ghost btn-sm !px-2.5 ${darkSurface ? 'text-slate-200 hover:text-white' : ''}`}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      aria-pressed={theme === 'dark'}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}

function LinkList({ links, close, currentPath }) {
  return links.map(({ to, label, icon: Icon }) => {
    const [path] = to.split('#');
    const active = currentPath === path
      || currentPath.startsWith(`${path}/`)
      || (path === '/app/documents' && currentPath.startsWith('/app/documents/'))
      || (path === '/app/chat' && currentPath.startsWith('/app/chat/'));
    return (
      <NavLink
        key={to}
        to={to}
        onClick={close}
        aria-current={active ? 'page' : undefined}
        className={`sidebar-link flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors ${
          active ? 'sidebar-link-active' : ''
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        {label}
      </NavLink>
    );
  });
}

export default function Layout() {
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const closeMenus = () => {
    setDrawerOpen(false);
  };

  useEffect(() => {
    closeMenus();
  }, [location.pathname]);

  const sidebar = (
    <nav className="flex h-full flex-col" aria-label="Main navigation">
      <div className="sidebar-divider border-b border-emerald-200 px-5 py-5">
        <Link to="/app/dashboard" aria-label="InsightLens dashboard" onClick={closeMenus}>
          <Logo light />
        </Link>
        <p className="sidebar-muted mt-2 pl-10 font-mono text-[10px] uppercase tracking-[0.16em]">Legal risk workspace</p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-5">
        <p className="sidebar-muted px-3 pb-2 font-mono text-[10px] uppercase tracking-[0.16em]">Workspace</p>
        <div className="space-y-1">
          <LinkList links={APP_LINKS} close={closeMenus} currentPath={location.pathname} />
        </div>
        <p className="sidebar-muted px-3 pb-2 pt-7 font-mono text-[10px] uppercase tracking-[0.16em]">Tools</p>
        <div className="space-y-1">
          <LinkList links={TOOL_LINKS} close={closeMenus} currentPath={location.pathname} />
        </div>
        <p className="sidebar-muted px-3 pb-2 pt-7 font-mono text-[10px] uppercase tracking-[0.16em]">Insights</p>
        <div className="space-y-1">
          <LinkList links={INSIGHT_LINKS} close={closeMenus} currentPath={location.pathname} />
        </div>
      </div>
      <div className="sidebar-divider border-t border-emerald-200 p-4">
        <div className="sidebar-status mb-3 rounded-md border border-emerald-200 bg-emerald-100 px-3 py-2">
          <p className="text-xs font-medium text-emerald-950">Account connected</p>
          <p className="mt-0.5 text-[10px] text-emerald-800">Private document workspace</p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="sidebar-user-name truncate text-sm font-medium">{user?.name}</p>
            <p className="sidebar-muted truncate text-xs">{user?.email}</p>
          </div>
          <ThemeButton darkSurface />
        </div>
        <button type="button" onClick={logout} className="sidebar-signout btn-ghost btn-sm -ml-1 mt-2">
          <LogOut className="h-4 w-4" aria-hidden /> Sign out
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[60] focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>

      <aside className="sidebar-surface sticky top-0 hidden h-screen w-64 shrink-0 border-r border-emerald-200 bg-[#eff8ef] lg:block">
        {sidebar}
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-rule bg-white/95 px-4 backdrop-blur lg:hidden">
          <Link to="/app/dashboard" aria-label="InsightLens dashboard" onClick={closeMenus}><Logo /></Link>
          <div className="flex items-center gap-2">
            <ThemeButton />
            <button
              type="button"
              onClick={() => setDrawerOpen((current) => !current)}
              className="btn-ghost p-2"
              aria-label={drawerOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={drawerOpen}
              aria-controls="mobile-navigation"
            >
              {drawerOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
            </button>
          </div>
        </header>
        {drawerOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button type="button" className="absolute inset-0 bg-slate-950/50" aria-label="Close navigation menu" onClick={closeMenus} />
            <aside id="mobile-navigation" className="sidebar-surface absolute left-0 top-0 h-full w-72 max-w-[85vw] shadow-2xl" aria-label="Mobile navigation">
              <button type="button" onClick={closeMenus} className="btn-ghost absolute right-3 top-3 p-2 text-slate-100" aria-label="Close navigation menu">
                <X className="h-5 w-5" aria-hidden />
              </button>
              {sidebar}
            </aside>
          </div>
        )}

        <main id="main" key={location.pathname.split('/')[2]} className="mx-auto min-w-0 max-w-[1440px] px-4 py-6 sm:px-6 sm:py-9">
          <div className="mx-auto max-w-6xl"><Outlet /></div>
        </main>

        <footer className="border-t border-rule px-4 py-5 text-center text-xs text-muted">
          AI-generated information only. InsightLens is not a law firm and does not provide legal advice.
        </footer>
      </div>
    </div>
  );
}
