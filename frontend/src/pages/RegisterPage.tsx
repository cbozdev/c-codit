import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/auth';
import { Logo } from '@/components/Logo';
import { SocialAuthButtons } from '@/components/SocialAuthButtons';
import toast from 'react-hot-toast';
import { extractFieldErrors } from '@/lib/api';
import { Eye, EyeOff, CheckCircle2, XCircle, ShieldCheck, Zap, RefreshCw } from 'lucide-react';

const PERKS = [
  { icon: Zap,         text: 'Free to create — no card required.' },
  { icon: RefreshCw,   text: 'Auto-refund on every failed delivery.' },
  { icon: ShieldCheck, text: '2FA & full audit log on your account.' },
];

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: 'At least 10 characters', ok: password.length >= 10 },
    { label: 'Uppercase letter (A–Z)',  ok: /[A-Z]/.test(password) },
    { label: 'Lowercase letter (a–z)',  ok: /[a-z]/.test(password) },
    { label: 'Number (0–9)',            ok: /[0-9]/.test(password) },
    { label: 'Symbol (e.g. ! # $ @)',   ok: /[^A-Za-z0-9]/.test(password) },
  ];
  if (!password) return null;
  const passed = checks.filter((c) => c.ok).length;
  const pct    = (passed / checks.length) * 100;
  const barColor = pct < 40 ? 'bg-rose-500' : pct < 80 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="mt-2 space-y-2">
      <div className="h-1 w-full rounded-full bg-ink-100 dark:bg-ink-700 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <ul className="space-y-1">
        {checks.map((c) => (
          <li key={c.label} className={`flex items-center gap-1.5 text-xs ${c.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-400'}`}>
            {c.ok
              ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              : <XCircle     className="h-3.5 w-3.5 text-ink-300 shrink-0" />}
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, loading } = useAuth();
  const [form, setForm] = useState({
    name: '', email: '', password: '', password_confirmation: '', accept_terms: false,
  });
  const [errors, setErrors]           = useState<Record<string, string[]>>({});
  const [showPass, setShowPass]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((s) => ({ ...s, [k]: v }));
    if (errors[k as string]) setErrors((e) => { const n = { ...e }; delete n[k as string]; return n; });
  }

  function fieldErr(name: string) { return errors[name]?.[0]; }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    const local: Record<string, string[]> = {};
    if (!form.name.trim() || form.name.trim().length < 2) local['name'] = ['Name must be at least 2 characters.'];
    if (!form.email.includes('@'))                         local['email'] = ['Please enter a valid email address.'];
    if (form.password.length < 10)                         local['password'] = ['Password must be at least 10 characters.'];
    if (!/[A-Z]/.test(form.password))                      local['password'] = ['Must contain an uppercase letter.'];
    if (!/[0-9]/.test(form.password))                      local['password'] = ['Must contain a number.'];
    if (!/[^A-Za-z0-9]/.test(form.password))               local['password'] = ['Must contain a symbol (e.g. ! # $ @).'];
    if (form.password !== form.password_confirmation)       local['password_confirmation'] = ['Passwords do not match.'];
    if (!form.accept_terms)                                 local['accept_terms'] = ['You must accept the Terms to continue.'];

    if (Object.keys(local).length > 0) { setErrors(local); toast.error('Please fix the errors below.'); return; }

    try {
      await register(form);
      toast.success('Account created! Welcome to C-codit.');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const fieldErrs = extractFieldErrors(err);
      if (fieldErrs && Object.keys(fieldErrs).length > 0) {
        setErrors(fieldErrs);
        toast.error(Object.values(fieldErrs)[0]?.[0] ?? 'Please fix the errors below.');
      } else {
        toast.error((err as Error).message ?? 'Registration failed. Please try again.');
      }
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-ink-50 dark:bg-ink-950">

      {/* ── Left panel ── */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-ink-950 via-ink-900 to-brand-950 relative overflow-hidden">
        <div className="absolute -top-20 -right-10 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-20 left-0 h-48 w-48 rounded-full bg-brand-500/10 blur-2xl pointer-events-none" />

        <div className="relative"><Logo /></div>

        <div className="relative space-y-8">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-white leading-tight">
              Open your wallet<br />in 30 seconds.
            </h1>
            <p className="mt-3 text-ink-400 text-lg">No paperwork, no minimums. Top up by card or crypto.</p>
          </div>

          <div className="space-y-4">
            {PERKS.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-brand-500/20 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-brand-400" />
                </div>
                <p className="text-sm text-ink-300">{text}</p>
              </div>
            ))}
          </div>

          {/* Social proof */}
          <div className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-3">
            <div className="flex -space-x-2">
              {['#6d28d9','#0891b2','#059669','#d97706'].map((c) => (
                <div key={c} className="h-7 w-7 rounded-full border-2 border-ink-900" style={{ background: c }} />
              ))}
            </div>
            <p className="text-xs text-ink-400">Thousands of users trust C-codit every day.</p>
          </div>
        </div>

        <p className="relative text-xs text-ink-600">© {new Date().getFullYear()} C-codit · All rights reserved.</p>
      </div>

      {/* ── Right panel ── */}
      <div className="flex items-center justify-center p-6 sm:p-10 bg-white dark:bg-ink-900 overflow-y-auto">
        <div className="w-full max-w-sm py-4">
          <div className="lg:hidden mb-8"><Logo /></div>

          <h2 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-white">Create account</h2>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">It's free. You only pay for what you use.</p>

          <form onSubmit={onSubmit} className="mt-7 space-y-4" noValidate>

            {/* Name */}
            <div>
              <label className="label">Full name</label>
              <input value={form.name} onChange={(e) => set('name', e.target.value)}
                className={`input ${fieldErr('name') ? 'border-rose-400' : ''}`}
                placeholder="Jane Doe" autoComplete="name" />
              {fieldErr('name') && <FieldError msg={fieldErr('name')!} />}
            </div>

            {/* Email */}
            <div>
              <label className="label">Email address</label>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
                className={`input ${fieldErr('email') ? 'border-rose-400' : ''}`}
                placeholder="you@example.com" autoComplete="email" />
              {fieldErr('email') && <FieldError msg={fieldErr('email')!} />}
            </div>

            {/* Password */}
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  className={`input pr-10 ${fieldErr('password') ? 'border-rose-400' : ''}`}
                  placeholder="Create a strong password" autoComplete="new-password" />
                <button type="button" onClick={() => setShowPass((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-ink-400 hover:text-ink-700 dark:hover:text-ink-200"
                  aria-label="Toggle password">
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErr('password') && <FieldError msg={fieldErr('password')!} />}
              <PasswordStrength password={form.password} />
            </div>

            {/* Confirm password */}
            <div>
              <label className="label">Confirm password</label>
              <div className="relative">
                <input type={showConfirm ? 'text' : 'password'} value={form.password_confirmation}
                  onChange={(e) => set('password_confirmation', e.target.value)}
                  className={`input pr-10 ${fieldErr('password_confirmation') ? 'border-rose-400' : ''}`}
                  autoComplete="new-password" placeholder="Repeat your password" />
                <button type="button" onClick={() => setShowConfirm((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-ink-400 hover:text-ink-700 dark:hover:text-ink-200"
                  aria-label="Toggle confirm password">
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErr('password_confirmation') && <FieldError msg={fieldErr('password_confirmation')!} />}
            </div>

            {/* Terms */}
            <div>
              <label className={`flex items-start gap-2.5 text-sm cursor-pointer ${fieldErr('accept_terms') ? 'text-rose-600' : 'text-ink-600 dark:text-ink-400'}`}>
                <input type="checkbox" checked={form.accept_terms}
                  onChange={(e) => set('accept_terms', e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-ink-300 accent-ink-900 shrink-0" />
                <span>
                  I agree to the{' '}
                  <Link to="/legal/terms"   className="text-brand-600 dark:text-brand-400 hover:underline font-medium">Terms of Service</Link>
                  {' '}and{' '}
                  <Link to="/legal/privacy" className="text-brand-600 dark:text-brand-400 hover:underline font-medium">Privacy Policy</Link>.
                </span>
              </label>
              {fieldErr('accept_terms') && <FieldError msg={fieldErr('accept_terms')!} />}
            </div>

            <button type="submit" disabled={loading} className="btn-brand w-full py-3 text-base font-semibold">
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

          <p className="mt-8 text-sm text-ink-500 dark:text-ink-400 text-center">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-600 dark:text-brand-400 hover:underline font-semibold">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function FieldError({ msg }: { msg: string }) {
  return (
    <p className="mt-1 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
      <XCircle className="h-3.5 w-3.5 shrink-0" /> {msg}
    </p>
  );
}
