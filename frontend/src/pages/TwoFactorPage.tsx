import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Shield, ArrowLeft } from 'lucide-react';
import { apiCall } from '@/lib/api';
import { useAuth } from '@/context/auth';
import toast from 'react-hot-toast';
import type { User } from '@/types/api';

export default function TwoFactorPage() {
  const location = useLocation();
  const navigate  = useNavigate();
  const { setUser, setToken } = useAuth() as any;
  const challenge = (location.state as any)?.challenge as string | undefined;

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
    <div className="min-h-screen flex items-center justify-center bg-ink-50 dark:bg-ink-950 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white dark:bg-ink-900 rounded-2xl shadow-sm border border-ink-100 dark:border-ink-800 p-8 space-y-6">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="h-14 w-14 rounded-2xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center">
              <Shield className="h-7 w-7 text-brand-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold dark:text-white">Two-factor authentication</h1>
              <p className="text-sm text-ink-500 mt-1">Enter the 6-digit code from your authenticator app</p>
            </div>
          </div>

          <div className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={e => e.key === 'Enter' && code.length === 6 && verify.mutate()}
              placeholder="000000"
              className="input text-center text-2xl font-mono tracking-widest py-3"
              autoFocus
            />
            <button
              onClick={() => verify.mutate()}
              disabled={code.length !== 6 || verify.isPending}
              className="btn-primary w-full py-3"
            >
              {verify.isPending ? 'Verifying…' : 'Verify'}
            </button>
          </div>

          <button
            onClick={() => navigate('/login')}
            className="flex items-center gap-2 text-sm text-ink-500 hover:text-ink-700 dark:hover:text-ink-300 transition mx-auto"
          >
            <ArrowLeft className="h-4 w-4" /> Back to login
          </button>
        </div>
      </div>
    </div>
  );
}
