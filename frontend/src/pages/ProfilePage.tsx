import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/auth';
import { apiCall } from '@/lib/api';
import toast from 'react-hot-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import {
  Mail, ShieldCheck, LogOut, Lock, User, Eye, EyeOff,
  CheckCircle2, XCircle, Bell, Edit2, Save, X, Phone, Globe,
  Copy, Users, AlertTriangle, Smartphone,
} from 'lucide-react';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editingProfile, setEditingProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [name, setName]       = useState(user?.name ?? '');
  const [phone, setPhone]     = useState(user?.phone ?? '');
  const [country, setCountry] = useState(user?.country ?? '');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw]         = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw]       = useState(false);

  // 2FA state
  const [show2faSetup, setShow2faSetup]   = useState(false);
  const [twoFaCode, setTwoFaCode]         = useState('');
  const [disablePw, setDisablePw]         = useState('');
  const [showDisable2fa, setShowDisable2fa] = useState(false);

  // Referral state
  const [showReferral, setShowReferral] = useState(false);

  // Delete account state
  const [showDelete, setShowDelete]   = useState(false);
  const [deletePw, setDeletePw]       = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');

  const checks = [
    { ok: newPw.length >= 10,         label: 'At least 10 characters' },
    { ok: /[A-Z]/.test(newPw),        label: 'Uppercase letter' },
    { ok: /[0-9]/.test(newPw),        label: 'Number' },
    { ok: /[^A-Za-z0-9]/.test(newPw), label: 'Symbol (! # $ @)' },
    { ok: newPw === confirmPw && !!confirmPw, label: 'Passwords match' },
  ];

  const updateProfile = useMutation({
    mutationFn: () => apiCall<null>({
      method: 'PATCH',
      url: '/auth/profile',
      data: { name, phone: phone || null, country: country || null },
    }),
    onSuccess: () => {
      toast.success('Profile updated.');
      setEditingProfile(false);
      qc.invalidateQueries({ queryKey: ['me'] });
      // Update auth store
      window.location.reload();
    },
    onError: (e) => toast.error((e as Error).message ?? 'Could not update profile.'),
  });

  const sendVerify = useMutation({
    mutationFn: () => apiCall<null>({ method: 'POST', url: '/auth/email/send-verification' }),
    onSuccess: () => toast.success('Verification email sent. Check your inbox.'),
    onError: (e) => toast.error((e as Error).message ?? 'Failed to send.'),
  });

  const changePassword = useMutation({
    mutationFn: () => apiCall<null>({
      method: 'POST', url: '/auth/change-password',
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

  // 2FA queries & mutations
  const { data: twoFaSetup, refetch: refetchSetup } = useQuery<{ secret: string; uri: string; enabled: boolean }>({
    queryKey: ['2fa-setup'],
    queryFn: () => apiCall({ method: 'GET', url: '/profile/2fa/setup' }),
    enabled: show2faSetup,
    staleTime: 0,
  });

  const confirmTwoFa = useMutation({
    mutationFn: () => apiCall({ method: 'POST', url: '/profile/2fa/confirm', data: { code: twoFaCode } }),
    onSuccess: () => { toast.success('2FA enabled.'); setShow2faSetup(false); setTwoFaCode(''); window.location.reload(); },
    onError: (e) => toast.error((e as Error).message),
  });

  const disableTwoFa = useMutation({
    mutationFn: () => apiCall({ method: 'DELETE', url: '/profile/2fa', data: { password: disablePw } }),
    onSuccess: () => { toast.success('2FA disabled.'); setShowDisable2fa(false); setDisablePw(''); window.location.reload(); },
    onError: (e) => toast.error((e as Error).message),
  });

  // Referral
  const { data: referralInfo } = useQuery<{ code: string; referrals: number; link: string }>({
    queryKey: ['referral-info'],
    queryFn: () => apiCall({ method: 'GET', url: '/auth/referral' }),
    enabled: showReferral,
  });

  // Account deletion
  const deleteAccount = useMutation({
    mutationFn: () => apiCall({ method: 'DELETE', url: '/auth/account', data: { password: deletePw } }),
    onSuccess: async () => {
      toast.success('Account deleted.');
      await logout();
      navigate('/login', { replace: true });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const twoFaEnabled = !!(user as any).two_factor_confirmed_at;

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight dark:text-white">Profile</h1>
        <p className="text-sm text-ink-600 dark:text-ink-400 mt-1">Manage your account settings and security.</p>
      </div>

      {/* Account info */}
      <div className="card-pad space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold dark:text-white flex items-center gap-2">
            <User className="h-4 w-4 text-brand-600" /> Account information
          </h2>
          {!editingProfile && (
            <button onClick={() => { setEditingProfile(true); setName(user.name); setPhone(user.phone ?? ''); setCountry(user.country ?? ''); }}
              className="btn-ghost text-sm">
              <Edit2 className="h-3.5 w-3.5" /> Edit
            </button>
          )}
        </div>

        {editingProfile ? (
          <div className="space-y-3">
            <div>
              <label className="label">Full name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </div>
            <div>
              <label className="label">Phone number <span className="text-ink-400 font-normal">(optional)</span></label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
                <input className="input pl-9" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234..." type="tel" />
              </div>
            </div>
            <div>
              <label className="label">Country <span className="text-ink-400 font-normal">(optional)</span></label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
                <input className="input pl-9" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. Nigeria" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => updateProfile.mutate()} disabled={!name.trim() || updateProfile.isPending}
                className="btn-primary text-sm">
                <Save className="h-4 w-4" />
                {updateProfile.isPending ? 'Saving…' : 'Save changes'}
              </button>
              <button onClick={() => setEditingProfile(false)} className="btn-outline text-sm">
                <X className="h-4 w-4" /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <Row label="Name"         value={user.name} />
            <Row label="Email"        value={user.email} />
            <Row label="Phone"        value={user.phone ?? <span className="text-ink-400 italic">Not set</span>} />
            <Row label="Country"      value={user.country ?? <span className="text-ink-400 italic">Not set</span>} />
            <Row label="Role"         value={<span className="badge-muted capitalize">{user.roles?.[0] ?? 'user'}</span>} />
            <Row label="Member since" value={new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} />
          </div>
        )}

        {/* Email verification */}
        {!user.email_verified && (
          <div className="mt-4 flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <Mail className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-400">Email not verified</p>
              <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">Verify your email to secure your account.</p>
            </div>
            <button onClick={() => sendVerify.mutate()} disabled={sendVerify.isPending}
              className="btn-outline text-xs border-amber-300 text-amber-700 hover:bg-amber-100">
              {sendVerify.isPending ? 'Sending…' : 'Send link'}
            </button>
          </div>
        )}
        {user.email_verified && (
          <div className="flex items-center gap-2 text-sm text-brand-700 dark:text-brand-400">
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
              <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className="input" placeholder="Your current password" autoFocus />
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
          <p className="text-sm font-medium dark:text-white mb-1">Sign out all devices</p>
          <p className="text-xs text-ink-500 dark:text-ink-400 mb-3">Use this if you think your account was accessed by someone else.</p>
          <button onClick={() => { if (confirm('Sign out of all devices?')) logoutAll.mutate(); }}
            disabled={logoutAll.isPending}
            className="btn text-sm border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 dark:border-rose-900 dark:text-rose-400 dark:bg-rose-950/30">
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
        <p className="text-sm text-ink-600 dark:text-ink-400">Need help? Contact our support team.</p>
        <div className="flex flex-wrap gap-2">
          <a href="mailto:support@c-codit.com" className="btn-outline text-sm">
            <Mail className="h-4 w-4" /> Email support
          </a>
          <button onClick={() => {
            const api = (window as any).Tawk_API;
            if (api?.toggle) api.toggle();
            else window.open('mailto:support@c-codit.com', '_blank');
          }} className="btn-outline text-sm">
            💬 Live chat
          </button>
        </div>
      </div>

      {/* Two-Factor Authentication */}
      <div className="card-pad space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-semibold dark:text-white flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-brand-600" /> Two-factor authentication
          </h2>
          {twoFaEnabled ? (
            <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-full font-medium">
              <CheckCircle2 className="h-3 w-3" /> Enabled
            </span>
          ) : (
            <span className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded-full font-medium">Not enabled</span>
          )}
        </div>
        <p className="text-sm text-ink-500 dark:text-ink-400">
          {twoFaEnabled
            ? 'Your account is protected with an authenticator app. You\'ll need a code every time you sign in.'
            : 'Add an extra layer of security. Use any TOTP app (Google Authenticator, Authy, etc.).'}
        </p>

        {!twoFaEnabled && !show2faSetup && (
          <button onClick={() => { setShow2faSetup(true); refetchSetup(); }} className="btn-primary text-sm px-4 py-2">
            Enable 2FA
          </button>
        )}

        {show2faSetup && twoFaSetup && (
          <div className="space-y-4 p-4 bg-ink-50 dark:bg-ink-800 rounded-xl">
            <p className="text-sm font-medium dark:text-white">1. Scan this QR code with your authenticator app</p>
            <div className="flex justify-center">
              <div className="p-3 bg-white rounded-xl">
                <QRCodeSVG value={twoFaSetup.uri} size={180} />
              </div>
            </div>
            <div>
              <p className="text-xs text-ink-500 mb-1">Or enter manually:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-white dark:bg-ink-700 rounded-lg px-3 py-2 font-mono text-ink-600 dark:text-ink-300 break-all">
                  {twoFaSetup.secret}
                </code>
                <button onClick={() => { navigator.clipboard.writeText(twoFaSetup.secret); toast.success('Copied!'); }}
                  className="p-2 text-ink-400 hover:text-ink-600 transition">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium dark:text-white mb-2">2. Enter the 6-digit code to confirm</p>
              <div className="flex gap-2">
                <input type="text" inputMode="numeric" maxLength={6} placeholder="000000"
                  value={twoFaCode} onChange={e => setTwoFaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input text-center font-mono tracking-widest text-lg flex-1" />
                <button onClick={() => confirmTwoFa.mutate()}
                  disabled={twoFaCode.length !== 6 || confirmTwoFa.isPending}
                  className="btn-primary px-4">
                  {confirmTwoFa.isPending ? '…' : 'Confirm'}
                </button>
              </div>
            </div>
            <button onClick={() => { setShow2faSetup(false); setTwoFaCode(''); }}
              className="text-sm text-ink-400 hover:text-ink-600">Cancel</button>
          </div>
        )}

        {twoFaEnabled && (
          <div>
            {!showDisable2fa ? (
              <button onClick={() => setShowDisable2fa(true)} className="text-sm text-rose-600 hover:text-rose-700 font-medium">
                Disable 2FA
              </button>
            ) : (
              <div className="flex gap-2 flex-wrap">
                <input type="password" placeholder="Enter your password to disable"
                  value={disablePw} onChange={e => setDisablePw(e.target.value)}
                  className="input text-sm flex-1" autoComplete="current-password" />
                <button onClick={() => disableTwoFa.mutate()} disabled={!disablePw || disableTwoFa.isPending}
                  className="btn-danger text-sm px-4">
                  {disableTwoFa.isPending ? '…' : 'Disable'}
                </button>
                <button onClick={() => { setShowDisable2fa(false); setDisablePw(''); }}
                  className="text-sm text-ink-400 hover:text-ink-600">Cancel</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Referral */}
      <div className="card-pad space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-semibold dark:text-white flex items-center gap-2">
            <Users className="h-4 w-4 text-brand-600" /> Referral program
          </h2>
          <button onClick={() => setShowReferral(r => !r)} className="text-sm text-brand-600 hover:text-brand-700 font-medium">
            {showReferral ? 'Hide' : 'Show my code'}
          </button>
        </div>
        <p className="text-sm text-ink-500 dark:text-ink-400">
          Share your referral code. When someone signs up and completes their first order, you earn <strong>$1.00</strong> wallet credit.
        </p>
        {showReferral && referralInfo && (
          <div className="space-y-3 p-4 bg-ink-50 dark:bg-ink-800 rounded-xl">
            <div className="flex items-center gap-2">
              <code className="flex-1 text-lg font-mono font-bold text-ink-900 dark:text-white tracking-widest text-center py-2 bg-white dark:bg-ink-700 rounded-lg">
                {referralInfo.code}
              </code>
              <button onClick={() => { navigator.clipboard.writeText(referralInfo.link); toast.success('Link copied!'); }}
                className="flex items-center gap-1.5 btn-primary text-sm px-3 py-2 shrink-0">
                <Copy className="h-4 w-4" /> Copy link
              </button>
            </div>
            <p className="text-xs text-ink-500 break-all">{referralInfo.link}</p>
            <div className="flex items-center gap-2 text-sm text-ink-600 dark:text-ink-300">
              <Users className="h-4 w-4 text-brand-500" />
              <span><strong>{referralInfo.referrals}</strong> {referralInfo.referrals === 1 ? 'person' : 'people'} referred so far</span>
            </div>
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="card-pad border border-rose-200 dark:border-rose-900 space-y-4">
        <h2 className="font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> Danger zone
        </h2>
        <p className="text-sm text-ink-600 dark:text-ink-400">
          Permanently delete your account and anonymise your personal data. Transaction records are retained for compliance. This cannot be undone.
        </p>
        {!showDelete ? (
          <button onClick={() => setShowDelete(true)} className="btn-danger text-sm px-4 py-2">
            Delete my account
          </button>
        ) : (
          <div className="space-y-3 p-4 bg-rose-50 dark:bg-rose-900/20 rounded-xl">
            <p className="text-sm font-medium text-rose-700 dark:text-rose-400">
              Type <strong>DELETE</strong> and enter your password to confirm.
            </p>
            <input type="text" placeholder='Type "DELETE" to confirm'
              value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
              className="input text-sm" />
            <input type="password" placeholder="Your current password"
              value={deletePw} onChange={e => setDeletePw(e.target.value)}
              className="input text-sm" autoComplete="current-password" />
            <div className="flex gap-2">
              <button
                onClick={() => deleteAccount.mutate()}
                disabled={deleteConfirm !== 'DELETE' || !deletePw || deleteAccount.isPending}
                className="btn-danger text-sm px-4 py-2">
                {deleteAccount.isPending ? 'Deleting…' : 'Permanently delete'}
              </button>
              <button onClick={() => { setShowDelete(false); setDeleteConfirm(''); setDeletePw(''); }}
                className="btn-ghost text-sm px-4 py-2">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-ink-500 dark:text-ink-400 shrink-0">{label}</span>
      <span className="font-medium text-ink-900 dark:text-ink-100 text-right">{value}</span>
    </div>
  );
}
