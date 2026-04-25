import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/context/theme';
import { Logo } from './Logo';
import {
  LayoutDashboard, Wallet, ListOrdered, Layers,
  User as UserIcon, LogOut, Shield, Sun, Moon, Menu, X,
} from 'lucide-react';
import { clsx } from 'clsx';

const NAV = [
  { to: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/wallet',       label: 'Wallet',       icon: Wallet },
  { to: '/transactions', label: 'Transactions', icon: ListOrdered },
  { to: '/services',     label: 'Services',     icon: Layers },
  { to: '/profile',      label: 'Profile',      icon: UserIcon },
];

function NavItem({ to, label, icon: Icon, onClick }: { to: string; label: string; icon: React.ComponentType<{ className?: string }>; onClick?: () => void }) {
  return (
    <NavLink to={to} onClick={onClick}
      className={({ isActive }) => clsx(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition',
        isActive
          ? 'bg-ink-900 text-white dark:bg-ink-100 dark:text-ink-900'
          : 'text-ink-700 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800',
      )}>
      <Icon className="h-4 w-4" /> {label}
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
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map((item) => <NavItem key={item.to} {...item} onClick={onNav} />)}
        {isAdmin && (
          <NavLink to="/admin" onClick={onNav}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition',
              isActive ? 'bg-brand-500 text-ink-950' : 'text-ink-700 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800',
            )}>
            <Shield className="h-4 w-4" /> Admin
          </NavLink>
        )}
      </nav>
      <div className="border-t border-ink-100 dark:border-ink-800 p-3 space-y-1">
        <button onClick={toggle}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-ink-700 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 transition">
          {dark ? <><Sun className="h-4 w-4" /> Light mode</> : <><Moon className="h-4 w-4" /> Dark mode</>}
        </button>
        <button onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-ink-700 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 transition">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-ink-50 dark:bg-ink-950">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900">
        <div className="px-6 py-5 border-b border-ink-100 dark:border-ink-800">
          <Logo />
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
            {isAdmin && (
              <NavLink to="/admin"
                className={({ isActive }) => clsx(
                  'p-2 rounded-lg transition',
                  isActive ? 'text-brand-600' : 'text-ink-500',
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
          {NAV.slice(0, isAdmin ? 4 : 5).map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) => clsx(
                'flex flex-col items-center gap-0.5 px-2 py-1.5 text-[10px] font-medium rounded-lg',
                isActive ? 'text-ink-900 dark:text-white' : 'text-ink-500 dark:text-ink-500',
              )}>
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink to="/admin"
              className={({ isActive }) => clsx(
                'flex flex-col items-center gap-0.5 px-2 py-1.5 text-[10px] font-medium rounded-lg',
                isActive ? 'text-brand-600' : 'text-ink-500 dark:text-ink-500',
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
