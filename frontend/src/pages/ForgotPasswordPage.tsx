import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { apiCall } from '@/lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Mail, CheckCircle2, Lock } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('');
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes('@')) { toast.error('Enter a valid email.'); return; }
    setLoading(true);
    try {
      await apiCall({ method: 'POST', url: '/auth/forgot-password', data: { email } });
      setSent(true);
    } catch {
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-ink-50 dark:bg-ink-950">

      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-ink-950 via-ink-900 to-brand-950 relative overflow-hidden">
        <div className="absolute -top-20 -right-10 h-64 w-64 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-0 h-48 w-48 rounded-full bg-violet-500/10 blur-2xl pointer-events-none" />

        <div className="relative"><Logo /></div>

        <div className="relative space-y-6">
          <div className="h-16 w-16 rounded-2xl bg-brand-500/20 flex items-center justify-center">
            <Lock className="h-8 w-8 text-brand-400" />
          </div>
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-white leading-tight">
              Forgot your<br />password?
            </h1>
            <p className="mt-3 text-ink-400 text-lg">No problem. Enter your email and we'll send a secure reset link.</p>
          </div>
          <p className="text-sm text-ink-500">The link expires in 60 minutes and can only be used once.</p>
        </div>

        <p className="relative text-xs text-ink-600">© {new Date().getFullYear()} C-codit · All rights reserved.</p>
      </div>

      {/* Right panel */}
      <div className="flex items-center justify-center p-6 sm:p-12 bg-white dark:bg-ink-900">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8"><Logo /></div>

          {sent ? (
            <div className="text-center space-y-5">
              <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-white">Check your inbox</h2>
                <p className="text-sm text-ink-500 dark:text-ink-400 mt-2">
                  If an account exists for <strong className="text-ink-700 dark:text-ink-300">{email}</strong>, we've sent a password reset link. Check your spam folder too.
                </p>
              </div>
              <Link to="/login"
                className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-ink-900 dark:bg-white text-white dark:text-ink-900 font-semibold text-sm hover:opacity-90 transition">
                Back to sign in
              </Link>
              <button onClick={() => setSent(false)}
                className="text-sm text-ink-400 hover:text-ink-600 dark:hover:text-ink-200 transition">
                Try a different email
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-white">Reset your password</h2>
                <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">Enter your email and we'll send you a reset link.</p>
              </div>

              <form onSubmit={onSubmit} className="space-y-4" noValidate>
                <div>
                  <label className="label">Email address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      className="input pl-9" placeholder="you@example.com" autoFocus />
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="btn-brand w-full py-3 text-base font-semibold">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Sending…
                    </span>
                  ) : 'Send reset link'}
                </button>
              </form>

              <Link to="/login"
                className="flex items-center justify-center gap-1.5 text-sm text-ink-500 dark:text-ink-400 hover:text-ink-800 dark:hover:text-ink-200 transition">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
