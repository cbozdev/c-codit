import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/auth';
import { Logo } from '@/components/Logo';
import toast from 'react-hot-toast';
import { extractFieldErrors } from '@/lib/api';

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
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    if (!form.accept_terms) {
      toast.error('Please accept the Terms to continue.');
      return;
    }
    try {
      await register(form);
      toast.success('Account created — check your email to verify.');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const fieldErrs = extractFieldErrors(err);
      if (fieldErrs) setErrors(fieldErrs);
      toast.error((err as Error).message ?? 'Registration failed.');
    }
  }

  function fieldError(name: string) {
    return errors[name]?.[0];
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-ink-50">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-aurora">
        <Logo />
        <div className="max-w-md">
          <h1 className="text-4xl font-semibold tracking-tight text-ink-950">
            Open your wallet in 30 seconds.
          </h1>
          <p className="mt-3 text-ink-600">No paperwork, no minimums. Top up by card or crypto.</p>
        </div>
        <div className="text-sm text-ink-500">© {new Date().getFullYear()} C-codit</div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8"><Logo /></div>
          <h2 className="text-2xl font-semibold tracking-tight">Create account</h2>
          <p className="mt-1 text-sm text-ink-600">It's free. You only pay for what you use.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
            <div>
              <label className="label">Full name</label>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} required
                className="input" placeholder="Jane Doe" autoComplete="name" />
              {fieldError('name') && <p className="mt-1 text-xs text-rose-600">{fieldError('name')}</p>}
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required
                className="input" placeholder="you@example.com" autoComplete="email" />
              {fieldError('email') && <p className="mt-1 text-xs text-rose-600">{fieldError('email')}</p>}
            </div>
            <div>
              <label className="label">Password</label>
              <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} required
                className="input" placeholder="At least 10 chars, mix of cases, numbers, symbols" autoComplete="new-password" />
              {fieldError('password') && <p className="mt-1 text-xs text-rose-600">{fieldError('password')}</p>}
            </div>
            <div>
              <label className="label">Confirm password</label>
              <input type="password" value={form.password_confirmation}
                onChange={(e) => set('password_confirmation', e.target.value)} required
                className="input" autoComplete="new-password" />
            </div>

            <label className="flex items-start gap-2 text-sm text-ink-700">
              <input type="checkbox" checked={form.accept_terms}
                onChange={(e) => set('accept_terms', e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-ink-300" />
              <span>
                I agree to the{' '}
                <Link to="/legal/terms"   className="text-brand-700 hover:underline">Terms</Link>{' '}and{' '}
                <Link to="/legal/privacy" className="text-brand-700 hover:underline">Privacy Policy</Link>.
              </span>
            </label>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-sm text-ink-600">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-700 hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
