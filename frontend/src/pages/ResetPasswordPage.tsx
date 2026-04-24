import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { apiCall } from '@/lib/api';
import toast from 'react-hot-toast';
import { Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';

function StrengthCheck({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-1.5 text-xs ${ok ? 'text-brand-700' : 'text-ink-500'}`}>
      {ok ? <CheckCircle2 className="h-3.5 w-3.5 text-brand-500" /> : <XCircle className="h-3.5 w-3.5 text-ink-300" />}
      {label}
    </li>
  );
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const email = params.get('email') ?? '';

  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);

  const checks = [
    { ok: password.length >= 10,         label: 'At least 10 characters' },
    { ok: /[A-Z]/.test(password),        label: 'Uppercase letter' },
    { ok: /[0-9]/.test(password),        label: 'Number' },
    { ok: /[^A-Za-z0-9]/.test(password), label: 'Symbol (! # $ @)' },
    { ok: password === confirm && !!confirm, label: 'Passwords match' },
  ];
  const valid = checks.every((c) => c.ok);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) { toast.error('Please meet all password requirements.'); return; }
    setLoading(true);
    try {
      await apiCall({
        method: 'POST',
        url: '/auth/reset-password',
        data: { email, token, password, password_confirmation: confirm },
      });
      toast.success('Password reset! Please sign in.');
      navigate('/login', { replace: true });
    } catch (err) {
      toast.error((err as Error).message ?? 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  }

  if (!token || !email) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card-pad text-center max-w-sm">
          <XCircle className="h-12 w-12 text-rose-400 mx-auto mb-3" />
          <h2 className="font-semibold dark:text-white">Invalid reset link</h2>
          <p className="text-sm text-ink-500 mt-1">This link is invalid or has expired.</p>
          <Link to="/forgot-password" className="btn-primary mt-4 w-full inline-flex justify-center">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-50 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8"><Logo /></div>
        <div className="card-pad">
          <h2 className="text-xl font-semibold dark:text-white">Set new password</h2>
          <p className="text-sm text-ink-500 mt-1">For <strong>{email}</strong></p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label className="label">New password</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-10" placeholder="Create a strong password" autoFocus />
                <button type="button" onClick={() => setShowPass((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-ink-400">
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {password && <ul className="mt-2 space-y-1">{checks.map((c) => <StrengthCheck key={c.label} {...c} />)}</ul>}
            </div>
            <div>
              <label className="label">Confirm password</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                className="input" placeholder="Repeat your password" />
            </div>
            <button type="submit" disabled={loading || !valid} className="btn-primary w-full">
              {loading ? 'Resetting…' : 'Reset password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
