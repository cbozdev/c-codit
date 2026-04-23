import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiCall } from '@/lib/api';
import { formatMoney, formatDate } from '@/lib/format';
import type { Paginated, User } from '@/types/api';
import {
  Activity, Users, AlertTriangle, TrendingUp,
  Search, Ban, UserCheck, Shield, ShieldOff,
} from 'lucide-react';

type Metrics = {
  users_total: number;
  users_active_24h: number;
  transactions_today: number;
  transactions_success_24h: number;
  transactions_failed_24h: number;
  payments_pending: number;
  gmv_today_minor: number;
  wallet_funding_today_minor: number;
};

export default function AdminPage() {
  const [tab, setTab]                   = useState<'metrics' | 'users'>('metrics');
  const [userSearch, setUserSearch]     = useState('');
  const [suspendTarget, setSuspendTarget] = useState<User | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [roleTarget, setRoleTarget]     = useState<User | null>(null);
  const qc = useQueryClient();

  const metrics = useQuery({
    queryKey: ['admin', 'metrics'],
    queryFn:  () => apiCall<Metrics>({ url: '/admin/metrics' }),
    refetchInterval: 30_000,
  });

  const users = useQuery({
    queryKey: ['admin', 'users', userSearch],
    queryFn:  () => apiCall<Paginated<User>>({
      url: '/admin/users',
      params: { q: userSearch || undefined, per_page: 50 },
    }),
    enabled: tab === 'users',
  });

  const suspend = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiCall<null>({ method: 'POST', url: `/admin/users/${id}/suspend`, data: { reason } }),
    onSuccess: () => {
      toast.success('User suspended.');
      setSuspendTarget(null);
      setSuspendReason('');
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const unsuspend = useMutation({
    mutationFn: (id: string) =>
      apiCall<null>({ method: 'POST', url: `/admin/users/${id}/unsuspend` }),
    onSuccess: () => {
      toast.success('User unsuspended.');
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // Toggle admin role — promotes user to admin or demotes admin to user
  const toggleAdmin = useMutation({
    mutationFn: ({ id, makeAdmin }: { id: string; makeAdmin: boolean }) =>
      apiCall<null>({
        method: 'POST',
        url:    `/admin/users/${id}/toggle-role`,
        data:   { is_active: true, role: makeAdmin ? 'admin' : 'user' },
      }),
    onSuccess: (_, vars) => {
      toast.success(vars.makeAdmin ? 'User promoted to admin.' : 'Admin role removed.');
      setRoleTarget(null);
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const d = metrics.data;

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-ink-600 mt-1">Platform overview and user management.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-ink-200">
        {(['metrics', 'users'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition -mb-px ${
              tab === t
                ? 'border-ink-900 text-ink-900'
                : 'border-transparent text-ink-500 hover:text-ink-700'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* Metrics tab */}
      {tab === 'metrics' && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard icon={Users}         label="Total users"       value={d?.users_total ?? '…'} />
            <MetricCard icon={Activity}      label="Active (24 h)"     value={d?.users_active_24h ?? '…'} />
            <MetricCard icon={TrendingUp}    label="Transactions today" value={d?.transactions_today ?? '…'} />
            <MetricCard icon={AlertTriangle} label="Payments pending"  value={d?.payments_pending ?? '…'} color="amber" />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label="Success / 24 h"  value={d?.transactions_success_24h ?? '…'} color="green" />
            <MetricCard label="Failed / 24 h"   value={d?.transactions_failed_24h  ?? '…'} color="red" />
            <MetricCard label="GMV today"        value={d ? formatMoney(d.gmv_today_minor) : '…'} />
            <MetricCard label="Funding today"    value={d ? formatMoney(d.wallet_funding_today_minor) : '…'} />
          </div>
          {metrics.dataUpdatedAt > 0 && (
            <p className="text-xs text-ink-400">
              Last refreshed {new Date(metrics.dataUpdatedAt).toLocaleTimeString()} · auto-refreshes every 30 s
            </p>
          )}
        </div>
      )}

      {/* Users tab */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
            <input
              className="input pl-9"
              placeholder="Search by name or email…"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-ink-50 border-b border-ink-100">
                  <tr>
                    {['User', 'Email', 'Status', 'Roles', 'Last login', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {users.isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-ink-500">Loading…</td>
                    </tr>
                  ) : (users.data?.items ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-ink-500">No users found.</td>
                    </tr>
                  ) : (users.data?.items ?? []).map((u) => {
                    const isAdmin = u.roles?.includes('admin');
                    return (
                      <tr key={u.id} className="hover:bg-ink-50/50">
                        <td className="px-4 py-3 font-medium">{u.name}</td>
                        <td className="px-4 py-3 text-ink-600 text-xs">{u.email}</td>
                        <td className="px-4 py-3">
                          {u.is_suspended
                            ? <span className="badge-danger">Suspended</span>
                            : u.is_active
                              ? <span className="badge-success">Active</span>
                              : <span className="badge-muted">Inactive</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {(u.roles ?? []).map((r) => (
                              <span key={r} className={`badge ${r === 'admin' ? 'badge-warning' : 'badge-muted'}`}>
                                {r}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-ink-600 text-xs">{formatDate(u.last_login_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 flex-wrap">
                            {/* Suspend / Unsuspend */}
                            {u.is_suspended ? (
                              <button
                                onClick={() => unsuspend.mutate(u.id)}
                                disabled={unsuspend.isPending}
                                className="btn-ghost text-xs text-brand-700 px-2 py-1"
                              >
                                <UserCheck className="h-3.5 w-3.5" /> Unsuspend
                              </button>
                            ) : (
                              <button
                                onClick={() => setSuspendTarget(u)}
                                className="btn-ghost text-xs text-rose-600 px-2 py-1"
                              >
                                <Ban className="h-3.5 w-3.5" /> Suspend
                              </button>
                            )}

                            {/* Admin role toggle */}
                            {isAdmin ? (
                              <button
                                onClick={() => setRoleTarget(u)}
                                className="btn-ghost text-xs text-amber-600 px-2 py-1"
                              >
                                <ShieldOff className="h-3.5 w-3.5" /> Remove admin
                              </button>
                            ) : (
                              <button
                                onClick={() => setRoleTarget(u)}
                                className="btn-ghost text-xs text-ink-700 px-2 py-1"
                              >
                                <Shield className="h-3.5 w-3.5" /> Make admin
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Suspend modal */}
      {suspendTarget && (
        <Modal onClose={() => { setSuspendTarget(null); setSuspendReason(''); }}>
          <h3 className="font-semibold text-lg">Suspend {suspendTarget.name}?</h3>
          <p className="text-sm text-ink-600 mt-1">
            This will immediately revoke all their active sessions.
          </p>
          <div className="mt-4">
            <label className="label">Reason <span className="text-rose-500">*</span></label>
            <input
              className="input"
              placeholder="e.g. Suspicious transaction activity"
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              autoFocus
            />
            <p className="mt-1 text-xs text-ink-500">This reason will be shown to the user if they try to log in.</p>
          </div>
          <div className="flex gap-2 mt-5 justify-end">
            <button onClick={() => { setSuspendTarget(null); setSuspendReason(''); }} className="btn-outline">
              Cancel
            </button>
            <button
              onClick={() => suspend.mutate({ id: suspendTarget.id, reason: suspendReason })}
              disabled={!suspendReason.trim() || suspend.isPending}
              className="btn bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-50"
            >
              {suspend.isPending ? 'Suspending…' : 'Confirm suspend'}
            </button>
          </div>
        </Modal>
      )}

      {/* Role toggle modal */}
      {roleTarget && (
        <Modal onClose={() => setRoleTarget(null)}>
          {roleTarget.roles?.includes('admin') ? (
            <>
              <h3 className="font-semibold text-lg">Remove admin from {roleTarget.name}?</h3>
              <p className="text-sm text-ink-600 mt-2">
                They will lose access to the admin panel and all admin permissions. Their wallet and account remain active.
              </p>
              <div className="flex gap-2 mt-5 justify-end">
                <button onClick={() => setRoleTarget(null)} className="btn-outline">Cancel</button>
                <button
                  onClick={() => toggleAdmin.mutate({ id: roleTarget.id, makeAdmin: false })}
                  disabled={toggleAdmin.isPending}
                  className="btn-primary"
                >
                  {toggleAdmin.isPending ? 'Updating…' : 'Remove admin role'}
                </button>
              </div>
            </>
          ) : (
            <>
              <h3 className="font-semibold text-lg">Make {roleTarget.name} an admin?</h3>
              <p className="text-sm text-ink-600 mt-2">
                They will gain full access to the admin panel — user management, all transactions, metrics, and service controls.
              </p>
              <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                ⚠ Only grant admin access to people you fully trust.
              </div>
              <div className="flex gap-2 mt-5 justify-end">
                <button onClick={() => setRoleTarget(null)} className="btn-outline">Cancel</button>
                <button
                  onClick={() => toggleAdmin.mutate({ id: roleTarget.id, makeAdmin: true })}
                  disabled={toggleAdmin.isPending}
                  className="btn bg-amber-500 text-white hover:bg-amber-400"
                >
                  {toggleAdmin.isPending ? 'Updating…' : 'Grant admin access'}
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-ink-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card-pad w-full max-w-md shadow-xl">
        {children}
      </div>
    </div>
  );
}

function MetricCard({
  label, value, icon: Icon, color,
}: {
  label: string;
  value: string | number;
  icon?: React.ComponentType<{ className?: string }>;
  color?: 'green' | 'red' | 'amber';
}) {
  const text = color === 'green' ? 'text-brand-700'
             : color === 'red'   ? 'text-rose-600'
             : color === 'amber' ? 'text-amber-600'
             : 'text-ink-900';
  return (
    <div className="card-pad">
      <div className="flex items-center gap-2 text-ink-500 text-xs uppercase tracking-wide mb-2">
        {Icon && <Icon className="h-3.5 w-3.5" />} {label}
      </div>
      <div className={`text-2xl font-semibold tracking-tight ${text}`}>{value}</div>
    </div>
  );
}
