import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/context/theme';
import { Logo } from './Logo';
import NotificationBell from './NotificationBell';
import {
  LayoutDashboard, Wallet, ListOrdered, Layers,
  User as UserIcon, LogOut, Shield, Sun, Moon, Menu, X, Globe, Phone,
} from 'lucide-react';
import { clsx } from 'clsx';

const NAV = [
  { to: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard, tourId: 'nav-dashboard' },
  { to: '/wallet',       label: 'Wallet',       icon: Wallet,          tourId: 'nav-wallet' },
  { to: '/transactions', label: 'Transactions', icon: ListOrdered,     tourId: 'nav-transactions' },
  { to: '/services',     label: 'Services',     icon: Layers,          tourId: 'nav-services' },
  { to: '/ltr-numbers',  label: 'LTR Numbers',  icon: Phone,           tourId: 'nav-ltr' },
  { to: '/proxy',        label: 'Proxies',      icon: Globe,           tourId: 'nav-proxy' },
  { to: '/profile',      label: 'Profile',      icon: UserIcon,        tourId: undefined },
];

function Avatar({ name }: { name?: string }) {
  const initials = (name ?? 'U')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center text-white text-xs font-semibold shrink-0">
      {initials}
    </div>
  );
}

function NavItem({ to, label, icon: Icon, onClick, tourId }: {
  to: string; label: string;
  icon: React.ComponentType<{ className?: string }>; onClick?: () => void; tourId?: string;
}) {
  return (
    <NavLink to={to} onClick={onClick} data-tour={tourId}
      className={({ isActive }) => clsx(
        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
        isActive
          ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400'
          : 'text-ink-600 hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-ink-800 hover:text-ink-900 dark:hover:text-ink-100',
      )}>
      {({ isActive }) => (
        <>
          <Icon className={clsx('h-4 w-4 shrink-0', isActive ? 'text-brand-600' : '')} />
          {label}
        </>
      )}
    </NavLink>
  );
}

export default function AppShell() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const isAdmin = user?.roles?.includes('admin');
  const [mobileOpen, setMobileOpen] = useState(false);

  async function onLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  const closeMobile = () => setMobileOpen(false);

  const SidebarContent = ({ onNav }: { onNav?: () => void }) => (
    <>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map((item) => <NavItem key={item.to} {...item} onClick={onNav} tourId={item.tourId} />)}
        {isAdmin && (
          <NavLink to="/admin" onClick={onNav}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
              isActive
                ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                : 'text-ink-600 hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-ink-800',
            )}>
            <Shield className="h-4 w-4 shrink-0" /> Admin
          </NavLink>
        )}
      </nav>

      {/* User footer */}
      <div className="border-t border-ink-100 dark:border-ink-800 p-3 space-y-0.5">
        {/* User info */}
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl mb-1">
          <Avatar name={user?.name} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-ink-800 dark:text-ink-100 truncate">{user?.name}</p>
            <p className="text-[10px] text-ink-400 dark:text-ink-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button onClick={toggle}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-ink-600 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800 transition">
          {dark ? <><Sun className="h-4 w-4" /> Light mode</> : <><Moon className="h-4 w-4" /> Dark mode</>}
        </button>
        <button onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-ink-50 dark:bg-ink-950">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-ink-100 dark:border-ink-800 flex items-center justify-between">
          <Logo />
          <NotificationBell />
        </div>
        <SidebarContent />
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" onClick={closeMobile} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 flex flex-col bg-white dark:bg-ink-900 shadow-xl z-50">
            <div className="px-5 py-4 border-b border-ink-100 dark:border-ink-800 flex items-center justify-between">
              <Logo />
              <button onClick={closeMobile} className="btn-ghost p-1.5">
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarContent onNav={closeMobile} />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="btn-ghost p-2">
              <Menu className="h-5 w-5" />
            </button>
            <Logo />
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            {isAdmin && (
              <NavLink to="/admin"
                className={({ isActive }) => clsx(
                  'p-2 rounded-lg transition',
                  isActive ? 'text-amber-600' : 'text-ink-400 hover:text-ink-700',
                )}>
                <Shield className="h-5 w-5" />
              </NavLink>
            )}
            <button onClick={toggle} className="btn-ghost p-2">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-10 py-6 sm:py-8">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden flex items-center justify-around border-t border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 py-1 sticky bottom-0 z-30">
          {NAV.slice(0, isAdmin ? 4 : 5).map(({ to, label, icon: Icon, tourId }) => (
            <NavLink key={to} to={to} data-tour-mobile={tourId}
              className={({ isActive }) => clsx(
                'flex flex-col items-center gap-0.5 px-2 py-1.5 text-[10px] font-medium rounded-lg transition',
                isActive ? 'text-brand-600 dark:text-brand-400' : 'text-ink-400 dark:text-ink-500',
              )}>
              {({ isActive }) => (
                <>
                  <Icon className={clsx('h-5 w-5', isActive && 'scale-110 transition-transform')} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink to="/admin"
              className={({ isActive }) => clsx(
                'flex flex-col items-center gap-0.5 px-2 py-1.5 text-[10px] font-medium rounded-lg',
                isActive ? 'text-amber-600' : 'text-ink-400 dark:text-ink-500',
              )}>
              <Shield className="h-5 w-5" />
              Admin
            </NavLink>
          )}
        </nav>
      </div>
    </div>
  );
}
