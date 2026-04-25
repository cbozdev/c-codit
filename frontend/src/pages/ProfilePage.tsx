import { useState } from 'react';
import { useAuth } from '@/context/auth';
import { apiCall } from '@/lib/api';
import toast from 'react-hot-toast';
import { useMutation } from '@tanstack/react-query';
import { Mail, ShieldCheck, LogOut, Lock, User, Eye, EyeOff, CheckCircle2, XCircle, Bell } from 'lucide-react';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw]         = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw]       = useState(false);

  const checks = [
    { ok: newPw.length >= 10,        label: 'At least 10 characters' },
    { ok: /[A-Z]/.test(newPw),       label: 'Uppercase letter' },
    { ok: /[0-9]/.test(newPw),       label: 'Number' },
    { ok: /[^A-Za-z0-9]/.test(newPw),label: 'Symbol (! # $ @)' },
    { ok: newPw === confirmPw && !!confirmPw, label: 'Passwords match' },
  ];

  const sendVerify = useMutation({
    mutationFn: () => apiCall<null>({ method: 'POST', url: '/auth/email/send-verification' }),
    onSuccess: () => toast.success('Verification email sent. Check your inbox.'),
    onError: (e) => toast.error((e as Error).message ?? 'Failed to send.'),
  });

  const changePassword = useMutation({
    mutationFn: () => apiCall<null>({
      method: 'POST',
      url: '/auth/change-password',
      data: { current_password: currentPw, password: newPw, password_confirmation: confirmPw },
    }),
    onSuccess: () => {
      toast.success('Password changed successfully.');
      setShowChangePassword(false);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    },
    onError: (e) => toast.error((e as Error).message ?? 'Could not change password.'),
  });

  const logoutAll = useMutation({
    mutationFn: () => apiCall<null>({ method: 'POST', url: '/auth/logout-all' }),
    onSuccess: async () => {
      toast.success('All sessions signed out.');
      await logout();
      window.location.href = '/login';
    },
  });

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight dark:text-white">Profile</h1>
        <p className="text-sm text-ink-600 dark:text-ink-400 mt-1">Manage your account settings and security.</p>
      </div>

      {/* Account info */}
      <div className="card-pad space-y-4">
        <h2 className="font-semibold dark:text-white flex items-center gap-2">
          <User className="h-4 w-4 text-brand-600" /> Account information
        </h2>
        <div className="space-y-3 text-sm">
          <Row label="Name"   value={user.name} />
          <Row label="Email"  value={user.email} />
          <Row label="Role"   value={<span className="badge-muted capitalize">{user.roles?.[0] ?? 'user'}</span>} />
          <Row label="Member since" value={user.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'} />
        </div>

        {/* Email verification */}
        {!user.email_verified && (
          <div className="mt-4 flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <Mail className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-400">Email not verified</p>
              <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">Verify your email to secure your account.</p>
            </div>
            <button onClick={() => sendVerify.mutate()} disabled={sendVerify.isPending} className="btn-outline text-xs border-amber-300 text-amber-700 hover:bg-amber-100">
              {sendVerify.isPending ? 'Sending…' : 'Send link'}
            </button>
          </div>
        )}
        {user.email_verified && (
          <div className="mt-2 flex items-center gap-2 text-sm text-brand-700 dark:text-brand-400">
            <CheckCircle2 className="h-4 w-4" /> Email verified
          </div>
        )}
      </div>

      {/* Security */}
      <div className="card-pad space-y-4">
        <h2 className="font-semibold dark:text-white flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-brand-600" /> Security
        </h2>

        {!showChangePassword ? (
          <button onClick={() => setShowChangePassword(true)} className="btn-outline text-sm">
            <Lock className="h-4 w-4" /> Change password
          </button>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="label">Current password</label>
              <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className="input" placeholder="Your current password" />
            </div>
            <div>
              <label className="label">New password</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={newPw} onChange={(e) => setNewPw(e.target.value)} className="input pr-10" placeholder="New password" />
                <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-ink-400">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {newPw && (
                <ul className="mt-2 space-y-1">
                  {checks.map((c) => (
                    <li key={c.label} className={`flex items-center gap-1.5 text-xs ${c.ok ? 'text-brand-700' : 'text-ink-500'}`}>
                      {c.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-brand-500" /> : <XCircle className="h-3.5 w-3.5 text-ink-300" />}
                      {c.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <label className="label">Confirm new password</label>
              <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className="input" placeholder="Repeat new password" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => changePassword.mutate()}
                disabled={changePassword.isPending || !checks.every((c) => c.ok) || !currentPw}
                className="btn-primary text-sm">
                {changePassword.isPending ? 'Saving…' : 'Save new password'}
              </button>
              <button onClick={() => { setShowChangePassword(false); setCurrentPw(''); setNewPw(''); setConfirmPw(''); }} className="btn-outline text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-ink-100 dark:border-ink-800">
          <p className="text-sm font-medium dark:text-white mb-1">Active sessions</p>
          <p className="text-xs text-ink-500 dark:text-ink-400 mb-3">
            Sign out of all devices if you think your account has been compromised.
          </p>
          <button onClick={() => {
            if (confirm('Sign out of all devices? You will need to log in again.')) {
              logoutAll.mutate();
            }
          }} disabled={logoutAll.isPending} className="btn text-sm border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 dark:border-rose-900 dark:text-rose-400 dark:bg-rose-950/30">
            <LogOut className="h-4 w-4" />
            {logoutAll.isPending ? 'Signing out…' : 'Sign out all devices'}
          </button>
        </div>
      </div>

      {/* Support */}
      <div className="card-pad space-y-3">
        <h2 className="font-semibold dark:text-white flex items-center gap-2">
          <Bell className="h-4 w-4 text-brand-600" /> Help & support
        </h2>
        <p className="text-sm text-ink-600 dark:text-ink-400">
          Need help? Contact our support team via live chat or email.
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="mailto:support@c-codit.com" className="btn-outline text-sm">
            <Mail className="h-4 w-4" /> Email support
          </a>
          <button onClick={() => {
            // Open Tawk.to or Crisp live chat
            if ((window as any).Tawk_API) {
              (window as any).Tawk_API.toggle();
            } else {
              window.open('mailto:support@c-codit.com', '_blank');
            }
          }} className="btn-outline text-sm">
            💬 Live chat
          </button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="card-pad border-rose-200 dark:border-rose-900 space-y-3">
        <h2 className="font-semibold text-rose-700 dark:text-rose-400">Danger zone</h2>
        <p className="text-sm text-ink-600 dark:text-ink-400">
          To close your account or request data deletion, email us at <a href="mailto:privacy@c-codit.com" className="underline">privacy@c-codit.com</a>.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-ink-500 dark:text-ink-400">{label}</span>
      <span className="font-medium text-ink-900 dark:text-ink-100">{value}</span>
    </div>
  );
}
