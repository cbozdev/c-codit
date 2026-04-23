import { useAuth } from '@/context/auth';
import { apiCall } from '@/lib/api';
import toast from 'react-hot-toast';
import { useMutation } from '@tanstack/react-query';
import { Mail, ShieldCheck, LogOut } from 'lucide-react';

export default function ProfilePage() {
  const { user, logout } = useAuth();

  const sendVerify = useMutation({
    mutationFn: () => apiCall<null>({ method: 'POST', url: '/auth/email/send-verification' }),
    onSuccess: () => toast.success('Verification email sent.'),
    onError: (e) => toast.error((e as Error).message ?? 'Failed to send.'),
  });

  const logoutAll = useMutation({
    mutationFn: () => apiCall<null>({ method: 'POST', url: '/auth/logout-all' }),
    onSuccess: async () => {
      toast.success('All sessions revoked.');
      await logout();
      window.location.href = '/login';
    },
  });

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-ink-600 mt-1">Account details & security.</p>
      </div>

      <div className="card-pad">
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <Field label="Name"    value={user.name} />
          <Field label="Email"   value={user.email} />
          <Field label="Phone"   value={user.phone ?? '—'} />
          <Field label="Country" value={user.country ?? '—'} />
          <Field label="Roles"   value={user.roles.join(', ') || '—'} />
          <Field label="Joined"  value={new Date(user.created_at).toLocaleDateString()} />
        </div>
      </div>

      <div className="card-pad">
        <h2 className="font-semibold flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-brand-600" /> Security
        </h2>
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-medium">Email verification</div>
              <div className="text-ink-500 text-xs">
                {user.email_verified ? 'Your email is verified.' : 'Verify your email to unlock all features.'}
              </div>
            </div>
            {!user.email_verified && (
              <button onClick={() => sendVerify.mutate()} disabled={sendVerify.isPending} className="btn-outline text-sm">
                <Mail className="h-4 w-4" /> Resend verification
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-ink-100 pt-4">
            <div>
              <div className="font-medium">Sign out everywhere</div>
              <div className="text-ink-500 text-xs">Revoke all active tokens for this account.</div>
            </div>
            <button onClick={() => logoutAll.mutate()} disabled={logoutAll.isPending} className="btn-outline text-sm">
              <LogOut className="h-4 w-4" /> Sign out all
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-ink-500">{label}</div>
      <div className="font-medium text-ink-900 mt-0.5">{value}</div>
    </div>
  );
}
