import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { apiCall } from '@/lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Mail, CheckCircle2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail]   = useState('');
  const [sent, setSent]     = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes('@')) { toast.error('Enter a valid email.'); return; }
    setLoading(true);
    try {
      await apiCall({ method: 'POST', url: '/auth/forgot-password', data: { email } });
      setSent(true);
    } catch {
      // Always show success to prevent user enumeration
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-50 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8"><Logo /></div>
        {sent ? (
          <div className="card-pad text-center">
            <CheckCircle2 className="h-12 w-12 text-brand-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold dark:text-white">Check your email</h2>
            <p className="text-sm text-ink-600 dark:text-ink-400 mt-2">
              If an account exists for <strong>{email}</strong>, we've sent a password reset link. Check your spam folder too.
            </p>
            <Link to="/login" className="btn-primary mt-6 w-full inline-flex justify-center">
              Back to sign in
            </Link>
          </div>
        ) : (
          <div className="card-pad">
            <h2 className="text-xl font-semibold dark:text-white">Reset your password</h2>
            <p className="text-sm text-ink-600 dark:text-ink-400 mt-1">
              Enter your email and we'll send you a reset link.
            </p>
            <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
              <div>
                <label className="label">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    className="input pl-9" placeholder="you@example.com" autoFocus />
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Sending…
                </span> : 'Send reset link'}
              </button>
            </form>
            <Link to="/login" className="mt-4 flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900 dark:text-ink-400">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
