import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Shield, ArrowLeft } from 'lucide-react';
import { apiCall } from '@/lib/api';
import { useAuth } from '@/context/auth';
import toast from 'react-hot-toast';
import type { User } from '@/types/api';
import { Logo } from '@/components/Logo';

export default function TwoFactorPage() {
  const location   = useLocation();
  const navigate   = useNavigate();
  const { setUser, setToken } = useAuth() as any;
  const challenge  = (location.state as any)?.challenge as string | undefined;

  const [code, setCode] = useState('');

  const verify = useMutation({
    mutationFn: () => apiCall<{ user: User; token: string }>({
      method: 'POST',
      url: '/auth/2fa/verify',
      data: { challenge, code },
    }),
    onSuccess: (data) => {
      setToken(data.token);
      setUser(data.user);
      navigate('/dashboard', { replace: true });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!challenge) {
    navigate('/login', { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-ink-50 dark:bg-ink-950">

      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-ink-950 via-ink-900 to-brand-950 relative overflow-hidden">
        <div className="absolute -top-20 -left-10 h-64 w-64 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-0 h-48 w-48 rounded-full bg-violet-500/10 blur-2xl pointer-events-none" />
        <div className="relative"><Logo /></div>
        <div className="relative space-y-6">
          <div className="h-16 w-16 rounded-2xl bg-brand-500/20 flex items-center justify-center">
            <Shield className="h-8 w-8 text-brand-400" />
          </div>
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-white leading-tight">
              Two-factor<br />authentication.
            </h1>
            <p className="mt-3 text-ink-400 text-lg">
              Your account is protected with an extra layer of security.
            </p>
          </div>
          <p className="text-sm text-ink-500">Open your authenticator app and enter the current 6-digit code.</p>
        </div>
        <p className="relative text-xs text-ink-600">© {new Date().getFullYear()} C-codit · All rights reserved.</p>
      </div>

      {/* Right panel */}
      <div className="flex items-center justify-center p-6 sm:p-12 bg-white dark:bg-ink-900">
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden"><Logo /></div>

          {/* Icon + header */}
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center">
              <Shield className="h-8 w-8 text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-white">Enter your code</h1>
              <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>
          </div>

          {/* Code input */}
          <div className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={e => e.key === 'Enter' && code.length === 6 && verify.mutate()}
              placeholder="000 000"
              className="input text-center text-3xl font-mono tracking-[0.4em] py-4 w-full"
              autoFocus
            />

            {/* Progress dots */}
            <div className="flex justify-center gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={`h-2 w-2 rounded-full transition-all ${
                  i < code.length ? 'bg-brand-500 scale-110' : 'bg-ink-200 dark:bg-ink-700'
                }`} />
              ))}
            </div>

            <button
              onClick={() => verify.mutate()}
              disabled={code.length !== 6 || verify.isPending}
              className="btn-brand w-full py-3 text-base font-semibold">
              {verify.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Verifying…
                </span>
              ) : 'Verify code'}
            </button>
          </div>

          <button onClick={() => navigate('/login')}
            className="flex items-center justify-center gap-2 text-sm text-ink-500 dark:text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 transition w-full">
            <ArrowLeft className="h-4 w-4" /> Back to login
          </button>
        </div>
      </div>
    </div>
  );
}
