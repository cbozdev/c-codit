import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/auth';
import { Logo } from '@/components/Logo';
import { SocialAuthButtons } from '@/components/SocialAuthButtons';
import toast from 'react-hot-toast';
import { Eye, EyeOff, XCircle } from 'lucide-react';

export default function LoginPage() {
  const navigate          = useNavigate();
  const [params]          = useSearchParams();
  const next              = params.get('next') ?? '/dashboard';
  const { login, loading }= useAuth();

  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow]       = useState(false);
  const [errors, setErrors]   = useState<{ email?: string; password?: string; general?: string }>({});

  function clearErr(field: string) {
    setErrors((e) => { const n = { ...e }; delete n[field as keyof typeof n]; return n; });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    // Basic client-side validation for instant feedback
    const localErrors: typeof errors = {};
    if (!email.trim())         localErrors.email    = 'Please enter your email address.';
    else if (!email.includes('@')) localErrors.email = 'Please enter a valid email address.';
    if (!password)             localErrors.password = 'Please enter your password.';

    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }

    try {
      await login(email.trim().toLowerCase(), password);
      toast.success('Welcome back!');
      navigate(next, { replace: true });
    } catch (err) {
      const msg = (err as Error).message ?? '';

      // Map common API error messages to friendly field-level errors
      if (msg.toLowerCase().includes('invalid credentials') || msg.toLowerCase().includes('credential')) {
        setErrors({
          general: 'Incorrect email or password. Please try again.',
        });
      } else if (msg.toLowerCase().includes('suspended')) {
        setErrors({ general: 'Your account has been suspended. Please contact support.' });
      } else if (msg.toLowerCase().includes('inactive')) {
        setErrors({ general: 'Your account is inactive. Please contact support.' });
      } else if (msg.toLowerCase().includes('too many')) {
        setErrors({ general: 'Too many login attempts. Please wait a moment and try again.' });
      } else {
        setErrors({ general: msg || 'Login failed. Please try again.' });
      }
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-ink-50">
      {/* Left decorative panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-aurora">
        <Logo />
        <div className="max-w-md">
          <h1 className="text-4xl font-semibold tracking-tight text-ink-950 leading-tight">
            Welcome back to your wallet.
          </h1>
          <p className="mt-3 text-ink-600">
            Pick up where you left off — services, balance, and full transaction history.
          </p>
        </div>
        <div className="text-sm text-ink-500">© {new Date().getFullYear()} C-codit</div>
      </div>

      {/* Right form panel */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8"><Logo /></div>

          <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-ink-600">Enter your email and password to continue.</p>

          {/* General error banner */}
          {errors.general && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{errors.general}</span>
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>

            {/* Email */}
            <div>
              <label htmlFor="email" className="label">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
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

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="label mb-0">Password</label>
                <Link to="/forgot-password" className="text-xs text-brand-700 dark:text-brand-400 hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearErr('password'); clearErr('general'); }}
                  className={`input pr-10 ${errors.password ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/20' : ''}`}
                  placeholder="Your password"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-ink-400 hover:text-ink-700"
                  aria-label="Toggle password visibility"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                  <XCircle className="h-3.5 w-3.5 shrink-0" /> {errors.password}
                </p>
              )}
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
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

          <p className="mt-6 text-sm text-ink-600 text-center">
            Don't have an account?{' '}
            <Link to="/register" className="text-brand-700 hover:underline font-medium">Create account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
