import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/auth';

export function ProtectedRoute({ children, requireRole }: { children: React.ReactNode; requireRole?: string }) {
  const { user, token, initialized, initialize } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!initialized) initialize();
  }, [initialized, initialize]);

  if (!initialized) {
    return (
      <div className="min-h-screen grid place-items-center text-ink-500">
        <div className="animate-pulse">Loading…</div>
      </div>
    );
  }
  if (!token || !user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (requireRole && !user.roles?.includes(requireRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
