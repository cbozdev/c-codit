import { useEffect, lazy, Suspense, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/auth';
import AppShell from '@/components/AppShell';
import CookieConsent from '@/components/CookieConsent';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App render error:', error, info);
  }
  render() {
    if (this.state.error) {
      const msg = (this.state.error as Error).message;
      return (
        <div style={{ padding: 32, fontFamily: 'monospace', background: '#fff', minHeight: '100vh' }}>
          <h2 style={{ color: '#c00', marginBottom: 12 }}>Something went wrong</h2>
          <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, overflow: 'auto', fontSize: 13 }}>{msg}</pre>
          <p style={{ marginTop: 16, fontSize: 14 }}>Please screenshot this and send it.</p>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 12, padding: '8px 16px', cursor: 'pointer' }}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Lazy load all pages for better performance
const LandingPage        = lazy(() => import('@/pages/LandingPage'));
const LoginPage          = lazy(() => import('@/pages/LoginPage'));
const RegisterPage       = lazy(() => import('@/pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'));
const ResetPasswordPage  = lazy(() => import('@/pages/ResetPasswordPage'));
const VerifyEmailPage    = lazy(() => import('@/pages/VerifyEmailPage'));
const DashboardPage      = lazy(() => import('@/pages/DashboardPage'));
const WalletPage         = lazy(() => import('@/pages/WalletPage'));
const WalletConfirmPage  = lazy(() => import('@/pages/WalletConfirmPage'));
const TransactionsPage   = lazy(() => import('@/pages/TransactionsPage'));
const ServicesPage       = lazy(() => import('@/pages/ServicesPage'));
const OrderDetailPage    = lazy(() => import('@/pages/OrderDetailPage'));
const ProfilePage        = lazy(() => import('@/pages/ProfilePage'));
const ReferralPage       = lazy(() => import('@/pages/ReferralPage'));
const AdminPage          = lazy(() => import('@/pages/AdminPage'));
const LegalPage          = lazy(() => import('@/pages/LegalPage'));
const NotFoundPage       = lazy(() => import('@/pages/NotFoundPage'));
const MyProxiesPage      = lazy(() => import('@/pages/MyProxiesPage'));
const LtrNumbersPage     = lazy(() => import('@/pages/LtrNumbersPage'));
const TwoFactorPage      = lazy(() => import('@/pages/TwoFactorPage'));

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, initialized } = useAuth();
  const loc = useLocation();
  if (!initialized) return <PageSpinner />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return <>{children}</>;
}

function RequireRole({ role, children }: { role: string; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user?.roles?.includes(role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function PageSpinner() {
  return (
    <div className="grid h-screen place-items-center bg-ink-50 dark:bg-ink-950">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-200 border-t-brand-500" />
        <p className="text-sm text-ink-500">Loading…</p>
      </div>
    </div>
  );
}

export default function App() {
  const initialize = useAuth((s) => s.initialize);
  useEffect(() => { initialize(); }, [initialize]);

  return (
    <ErrorBoundary>
    <Suspense fallback={<PageSpinner />}>
      <CookieConsent />
      <Routes>
        {/* Public */}
        <Route path="/"                   element={<LandingPage />} />
        <Route path="/login"              element={<LoginPage />} />
        <Route path="/register"           element={<RegisterPage />} />
        <Route path="/forgot-password"    element={<ForgotPasswordPage />} />
        <Route path="/reset-password"     element={<ResetPasswordPage />} />
        <Route path="/verify-email"       element={<VerifyEmailPage />} />
        <Route path="/2fa"                element={<TwoFactorPage />} />
        <Route path="/legal/:doc"         element={<LegalPage />} />
        <Route path="/legal"              element={<Navigate to="/legal/terms" replace />} />

        {/* Authenticated shell */}
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route path="/dashboard"        element={<DashboardPage />} />
          <Route path="/wallet"           element={<WalletPage />} />
          <Route path="/wallet/confirm"   element={<WalletConfirmPage />} />
          <Route path="/transactions"     element={<TransactionsPage />} />
          <Route path="/services"           element={<ServicesPage />} />
          <Route path="/services/:category" element={<ServicesPage />} />
          <Route path="/orders/:id"       element={<OrderDetailPage />} />
          <Route path="/proxy"            element={<MyProxiesPage />} />
          <Route path="/ltr-numbers"      element={<LtrNumbersPage />} />
          <Route path="/referral"         element={<ReferralPage />} />
          <Route path="/profile"          element={<ProfilePage />} />
          <Route path="/admin"
            element={<RequireRole role="admin"><AdminPage /></RequireRole>}
          />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
    </ErrorBoundary>
  );
}
