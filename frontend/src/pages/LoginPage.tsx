import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/auth';
import { Logo } from '@/components/Logo';
import { SocialAuthButtons } from '@/components/SocialAuthButtons';
import toast from 'react-hot-toast';
import { Eye, EyeOff, XCircle, ShieldCheck, Zap, Globe } from 'lucide-react';

const FEATURES = [
  { icon: Zap,          title: 'Instant top-up',   desc: 'Card, bank transfer, or 100+ crypto coins.' },
  { icon: Globe,        title: 'Global coverage',  desc: 'Virtual numbers, proxies & gift cards worldwide.' },
  { icon: ShieldCheck,  title: 'Auto-refund',       desc: 'Failed delivery? Money is back in seconds.' },
];

export default function LoginPage() {
  const navigate            = useNavigate();
  const [params]            = useSearchParams();
  const next                = params.get('next') ?? '/dashboard';
  const { login, loading }  = useAuth();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow]         = useState(false);
  const [errors, setErrors]     = useState<{ email?: string; password?: string; general?: string }>({});

  function clearErr(field: string) {
    setErrors((e) => { const n = { ...e }; delete n[field as keyof typeof n]; return n; });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const localErrors: typeof errors = {};
    if (!email.trim())              localErrors.email    = 'Please enter your email address.';
    else if (!email.includes('@'))  localErrors.email    = 'Please enter a valid email address.';
    if (!password)                  localErrors.password = 'Please enter your password.';

    if (Object.keys(localErrors).length > 0) { setErrors(localErrors); return; }

    try {
      const result = await login(email.trim().toLowerCase(), password);
      if (result?.requires_2fa) {
        navigate('/2fa', { state: { challenge: result.challenge }, replace: true });
        return;
      }
      toast.success('Welcome back!');
      navigate(next, { replace: true });
    } catch (err) {
      const msg = (err as Error).message ?? '';
      if (msg.toLowerCase().includes('invalid credentials') || msg.toLowerCase().includes('credential')) {
        setErrors({ general: 'Incorrect email or password. Please try again.' });
      } else if (msg.toLowerCase().includes('suspended')) {
        setErrors({ general: 'Your account has been suspended. Please contact support.' });
      } else if (msg.toLowerCase().includes('too many')) {
        setErrors({ general: 'Too many login attempts. Please wait a moment and try again.' });
      } else {
        setErrors({ general: msg || 'Login failed. Please try again.' });
      }
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-ink-50 dark:bg-ink-950">

      {/* ── Left panel ── */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-ink-950 via-ink-900 to-brand-950 relative overflow-hidden">
        {/* Ambient orbs */}
        <div className="absolute -top-20 -left-20 h-64 w-64 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-0 h-48 w-48 rounded-full bg-violet-500/10 blur-2xl pointer-events-none" />

        <div className="relative">
          <Logo />
        </div>

        <div className="relative space-y-8">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-white leading-tight">
              Welcome back to<br />your wallet.
            </h1>
            <p className="mt-3 text-ink-400 text-lg">
              Pick up where you left off — services, balance, and full transaction history.
            </p>
          </div>

          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-brand-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="h-4 w-4 text-brand-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="text-xs text-ink-400 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-ink-600">© {new Date().getFullYear()} C-codit · All rights reserved.</p>
      </div>

      {/* ── Right panel ── */}
      <div className="flex items-center justify-center p-6 sm:p-12 bg-white dark:bg-ink-900">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8"><Logo /></div>

          <h2 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-white">Sign in</h2>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Enter your email and password to continue.</p>

          {errors.general && (
            <div className="mt-5 flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-700 dark:text-rose-400">
              <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{errors.general}</span>
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="label">Email address</label>
              <input
                id="email" type="email" autoComplete="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearErr('email'); clearErr('general'); }}
                className={`input ${errors.email ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/20' : ''}`}
                placeholder="you@example.com"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                  <XCircle className="h-3.5 w-3.5 shrink-0" /> {errors.email}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="label mb-0">Password</label>
                <Link to="/forgot-password" className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password" type={show ? 'text' : 'password'}
                  autoComplete="current-password" value={password}
                  onChange={(e) => { setPassword(e.target.value); clearErr('password'); clearErr('general'); }}
                  className={`input pr-10 ${errors.password ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/20' : ''}`}
                  placeholder="Your password"
                />
                <button type="button" onClick={() => setShow((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-ink-400 hover:text-ink-700 dark:hover:text-ink-200"
                  aria-label="Toggle password visibility">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                  <XCircle className="h-3.5 w-3.5 shrink-0" /> {errors.password}
                </p>
              )}
            </div>

            <button type="submit" disabled={loading} className="btn-brand w-full py-3 text-base font-semibold">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Signing in…
                </span>
              ) : 'Sign in'}
            </button>
          </form>

          <div className="mt-6">
            <SocialAuthButtons redirectTo={next} />
          </div>

          <p className="mt-8 text-sm text-ink-500 dark:text-ink-400 text-center">
            Don't have an account?{' '}
            <Link to="/register" className="text-brand-600 dark:text-brand-400 hover:underline font-semibold">Create account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
