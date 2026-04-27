import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/auth';
import { Logo } from '@/components/Logo';
import { SocialAuthButtons } from '@/components/SocialAuthButtons';
import toast from 'react-hot-toast';
import { extractFieldErrors } from '@/lib/api';
import { Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: 'At least 10 characters',          ok: password.length >= 10 },
    { label: 'Uppercase letter (A–Z)',           ok: /[A-Z]/.test(password) },
    { label: 'Lowercase letter (a–z)',           ok: /[a-z]/.test(password) },
    { label: 'Number (0–9)',                     ok: /[0-9]/.test(password) },
    { label: 'Symbol (e.g. ! # $ @ %)',          ok: /[^A-Za-z0-9]/.test(password) },
  ];
  if (!password) return null;
  return (
    <ul className="mt-2 space-y-1">
      {checks.map((c) => (
        <li key={c.label} className={`flex items-center gap-1.5 text-xs ${c.ok ? 'text-brand-700' : 'text-ink-500'}`}>
          {c.ok
            ? <CheckCircle2 className="h-3.5 w-3.5 text-brand-500 shrink-0" />
            : <XCircle     className="h-3.5 w-3.5 text-ink-300   shrink-0" />}
          {c.label}
        </li>
      ))}
    </ul>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, loading } = useAuth();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    password_confirmation: '',
    accept_terms: false,
  });
  const [errors, setErrors]         = useState<Record<string, string[]>>({});
  const [showPass, setShowPass]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((s) => ({ ...s, [k]: v }));
    // Clear field error as user types
    if (errors[k as string]) setErrors((e) => { const n = { ...e }; delete n[k as string]; return n; });
  }

  function fieldErr(name: string) { return errors[name]?.[0]; }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    // Client-side checks for immediate feedback
    const localErrors: Record<string, string[]> = {};
    if (!form.name.trim() || form.name.trim().length < 2)
      localErrors['name'] = ['Name must be at least 2 characters.'];
    if (!form.email.includes('@'))
      localErrors['email'] = ['Please enter a valid email address.'];
    if (form.password.length < 10)
      localErrors['password'] = ['Password must be at least 10 characters.'];
    if (!/[A-Z]/.test(form.password))
      localErrors['password'] = ['Password must contain at least one uppercase letter.'];
    if (!/[0-9]/.test(form.password))
      localErrors['password'] = ['Password must contain at least one number.'];
    if (!/[^A-Za-z0-9]/.test(form.password))
      localErrors['password'] = ['Password must contain at least one symbol (e.g. ! # $ @).'];
    if (form.password !== form.password_confirmation)
      localErrors['password_confirmation'] = ['Passwords do not match.'];
    if (!form.accept_terms)
      localErrors['accept_terms'] = ['You must accept the Terms to continue.'];

    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      toast.error('Please fix the errors below.');
      return;
    }

    try {
      await register(form);
      toast.success('Account created! Welcome to C-codit.');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const fieldErrs = extractFieldErrors(err);
      if (fieldErrs && Object.keys(fieldErrs).length > 0) {
        setErrors(fieldErrs);
        // Show the first specific error as a toast
        const firstMsg = Object.values(fieldErrs)[0]?.[0];
        toast.error(firstMsg ?? 'Please fix the errors below.');
      } else {
        toast.error((err as Error).message ?? 'Registration failed. Please try again.');
      }
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-ink-50">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-aurora">
        <Logo />
        <div className="max-w-md">
          <h1 className="text-4xl font-semibold tracking-tight text-ink-950">
            Open your wallet in 30 seconds.
          </h1>
          <p className="mt-3 text-ink-600">No paperwork, no minimums. Top up by card or crypto.</p>
          <div className="mt-8 space-y-3 text-sm text-ink-700">
            <div className="flex items-center gap-2">✓ Free to create</div>
            <div className="flex items-center gap-2">✓ Auto-refund on failed delivery</div>
            <div className="flex items-center gap-2">✓ Card & crypto top-up</div>
          </div>
        </div>
        <div className="text-sm text-ink-500">© {new Date().getFullYear()} C-codit</div>
      </div>

      {/* Right panel */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8"><Logo /></div>
          <h2 className="text-2xl font-semibold tracking-tight">Create account</h2>
          <p className="mt-1 text-sm text-ink-600">It's free. You only pay for what you use.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>

            {/* Name */}
            <div>
              <label className="label">Full name</label>
              <input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                className={`input ${fieldErr('name') ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/20' : ''}`}
                placeholder="Jane Doe"
                autoComplete="name"
              />
              {fieldErr('name') && (
                <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                  <XCircle className="h-3.5 w-3.5 shrink-0" /> {fieldErr('name')}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                className={`input ${fieldErr('email') ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/20' : ''}`}
                placeholder="you@example.com"
                autoComplete="email"
              />
              {fieldErr('email') && (
                <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                  <XCircle className="h-3.5 w-3.5 shrink-0" /> {fieldErr('email')}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  className={`input pr-10 ${fieldErr('password') ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/20' : ''}`}
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-ink-400 hover:text-ink-700"
                  aria-label="Toggle password"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErr('password') && (
                <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                  <XCircle className="h-3.5 w-3.5 shrink-0" /> {fieldErr('password')}
                </p>
              )}
              <PasswordStrength password={form.password} />
            </div>

            {/* Confirm password */}
            <div>
              <label className="label">Confirm password</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={form.password_confirmation}
                  onChange={(e) => set('password_confirmation', e.target.value)}
                  className={`input pr-10 ${fieldErr('password_confirmation') ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/20' : ''}`}
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-ink-400 hover:text-ink-700"
                  aria-label="Toggle confirm password"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErr('password_confirmation') && (
                <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                  <XCircle className="h-3.5 w-3.5 shrink-0" /> {fieldErr('password_confirmation')}
                </p>
              )}
            </div>

            {/* Terms */}
            <div>
              <label className={`flex items-start gap-2 text-sm cursor-pointer ${fieldErr('accept_terms') ? 'text-rose-600' : 'text-ink-700'}`}>
                <input
                  type="checkbox"
                  checked={form.accept_terms}
                  onChange={(e) => set('accept_terms', e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-ink-300 accent-ink-900"
                />
                <span>
                  I agree to the{' '}
                  <Link to="/legal/terms"   className="text-brand-700 hover:underline font-medium">Terms of Service</Link>
                  {' '}and{' '}
                  <Link to="/legal/privacy" className="text-brand-700 hover:underline font-medium">Privacy Policy</Link>.
                </span>
              </label>
              {fieldErr('accept_terms') && (
                <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                  <XCircle className="h-3.5 w-3.5 shrink-0" /> {fieldErr('accept_terms')}
                </p>
              )}
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Creating account…
                </span>
              ) : 'Create account'}
            </button>
          </form>

          <div className="mt-6">
            <SocialAuthButtons />
          </div>

          <p className="mt-6 text-sm text-ink-600 text-center">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-700 hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
