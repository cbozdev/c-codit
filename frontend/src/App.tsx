import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/auth';
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import VerifyEmailPage from '@/pages/VerifyEmailPage';
import DashboardPage from '@/pages/DashboardPage';
import WalletPage from '@/pages/WalletPage';
import WalletConfirmPage from '@/pages/WalletConfirmPage';
import TransactionsPage from '@/pages/TransactionsPage';
import ServicesPage from '@/pages/ServicesPage';
import OrderDetailPage from '@/pages/OrderDetailPage';
import ProfilePage from '@/pages/ProfilePage';
import AdminPage from '@/pages/AdminPage';
import LegalPage from '@/pages/LegalPage';
import NotFoundPage from '@/pages/NotFoundPage';
import AppShell from '@/components/AppShell';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, initialized } = useAuth();
  const loc = useLocation();
  if (!initialized) return <Spinner />;
  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  }
  return <>{children}</>;
}

function RequireRole({ role, children }: { role: string; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user?.roles?.includes(role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function Spinner() {
  return (
    <div className="grid h-screen place-items-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-200 border-t-brand-500" />
    </div>
  );
}

export default function App() {
  const initialize = useAuth((s) => s.initialize);
  useEffect(() => { initialize(); }, [initialize]);

  return (
    <Routes>
      {/* Public */}
      <Route path="/"             element={<LandingPage />} />
      <Route path="/login"        element={<LoginPage />} />
      <Route path="/register"     element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/legal/:doc"   element={<LegalPage />} />

      {/* Authenticated shell */}
      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route path="/dashboard"      element={<DashboardPage />} />
        <Route path="/wallet"         element={<WalletPage />} />
        <Route path="/wallet/confirm" element={<WalletConfirmPage />} />
        <Route path="/transactions"   element={<TransactionsPage />} />
        <Route path="/services"       element={<ServicesPage />} />
        <Route path="/orders/:id"     element={<OrderDetailPage />} />
        <Route path="/profile"        element={<ProfilePage />} />
        <Route path="/admin"
          element={
            <RequireRole role="admin">
              <AdminPage />
            </RequireRole>
          }
        />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
