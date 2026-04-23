import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiCall } from '@/lib/api';
import { formatMoney, formatDate } from '@/lib/format';
import type { Paginated, Transaction } from '@/types/api';
import {
  Activity, Users, AlertTriangle, TrendingUp, Search,
  Ban, UserCheck, Shield, ShieldOff, Wallet,
  ChevronLeft, ChevronRight, ToggleLeft, ToggleRight,
  Plus, Minus, RefreshCw, Eye,
} from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';

// ─── Types ────────────────────────────────────────────────────────────────────

type Metrics = {
  users_total: number; users_active_24h: number;
  transactions_today: number; transactions_success_24h: number;
  transactions_failed_24h: number; payments_pending: number;
  gmv_today_minor: number; wallet_funding_today_minor: number;
};

type AdminUser = {
  id: string; name: string; email: string; roles: string[];
  is_active: boolean; is_suspended: boolean; suspension_reason: string | null;
  last_login_at: string | null; registered_at: string | null;
  balance_minor: number; balance: string; wallet_frozen: boolean;
};

type AdminTransaction = Transaction & { user_email?: string; user_name?: string };

type AdminService = {
  code: string; name: string; category: string; provider: string;
  description: string | null; is_active: boolean; currency: string;
  orders_today: number; orders_total: number; orders_failed: number;
  markup_percent: number;
};

type Tab = 'metrics' | 'users' | 'transactions' | 'services';

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('metrics');

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-ink-600 mt-1">Platform overview and management.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-ink-200 overflow-x-auto">
        {(['metrics', 'users', 'transactions', 'services'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize whitespace-nowrap border-b-2 transition -mb-px ${
              tab === t
                ? 'border-ink-900 text-ink-900'
                : 'border-transparent text-ink-500 hover:text-ink-700'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'metrics'      && <MetricsTab />}
      {tab === 'users'        && <UsersTab />}
      {tab === 'transactions' && <TransactionsTab />}
      {tab === 'services'     && <ServicesTab />}
    </div>
  );
}

// ─── Metrics Tab ──────────────────────────────────────────────────────────────

function MetricsTab() {
  const metrics = useQuery({
    queryKey: ['admin', 'metrics'],
    queryFn:  () => apiCall<Metrics>({ url: '/admin/metrics' }),
    refetchInterval: 30_000,
  });
  const d = metrics.data;

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={Users}         label="Total users"        value={d?.users_total ?? '…'} />
        <MetricCard icon={Activity}      label="Active (24 h)"      value={d?.users_active_24h ?? '…'} />
        <MetricCard icon={TrendingUp}    label="Transactions today"  value={d?.transactions_today ?? '…'} />
        <MetricCard icon={AlertTriangle} label="Payments pending"   value={d?.payments_pending ?? '…'} color="amber" />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Success / 24 h"  value={d?.transactions_success_24h ?? '…'} color="green" />
        <MetricCard label="Failed / 24 h"   value={d?.transactions_failed_24h  ?? '…'} color="red" />
        <MetricCard label="GMV today"        value={d ? formatMoney(d.gmv_today_minor) : '…'} />
        <MetricCard label="Funding today"    value={d ? formatMoney(d.wallet_funding_today_minor) : '…'} />
      </div>
      {metrics.dataUpdatedAt > 0 && (
        <p className="text-xs text-ink-400">
          Updated {new Date(metrics.dataUpdatedAt).toLocaleTimeString()} · auto-refreshes every 30 s
        </p>
      )}
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab() {
  const qc = useQueryClient();
  const [search, setSearch]             = useState('');
  const [suspendTarget, setSuspend]     = useState<AdminUser | null>(null);
  const [suspendReason, setReason]      = useState('');
  const [roleTarget, setRoleTarget]     = useState<AdminUser | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<AdminUser | null>(null);
  const [txTarget, setTxTarget]         = useState<AdminUser | null>(null);

  const users = useQuery({
    queryKey: ['admin', 'users', search],
    queryFn:  () => apiCall<Paginated<AdminUser>>({
      url: '/admin/users', params: { q: search || undefined, per_page: 50 },
    }),
  });

  const suspend = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiCall<null>({ method: 'POST', url: `/admin/users/${id}/suspend`, data: { reason } }),
    onSuccess: () => {
      toast.success('User suspended.'); setSuspend(null); setReason('');
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const unsuspend = useMutation({
    mutationFn: (id: string) => apiCall<null>({ method: 'POST', url: `/admin/users/${id}/unsuspend` }),
    onSuccess: () => { toast.success('User unsuspended.'); qc.invalidateQueries({ queryKey: ['admin', 'users'] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const toggleRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      apiCall<null>({ method: 'POST', url: `/admin/users/${id}/toggle-role`, data: { role } }),
    onSuccess: (_, v) => {
      toast.success(v.role === 'admin' ? 'Promoted to admin.' : 'Admin role removed.');
      setRoleTarget(null); qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
          <input className="input pl-9" placeholder="Search by name or email…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button onClick={() => qc.invalidateQueries({ queryKey: ['admin', 'users'] })} className="btn-outline">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-ink-50 border-b border-ink-100">
              <tr>
                {['User', 'Email', 'Balance', 'Status', 'Roles', 'Registered', 'Last login', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {users.isLoading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-ink-500">Loading…</td></tr>
              ) : (users.data?.items ?? []).length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-ink-500">No users found.</td></tr>
              ) : (users.data?.items ?? []).map((u) => {
                const isAdmin = u.roles?.includes('admin');
                return (
                  <tr key={u.id} className="hover:bg-ink-50/50">
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{u.name}</td>
                    <td className="px-4 py-3 text-ink-600 text-xs">{u.email}</td>
                    <td className="px-4 py-3 font-mono text-sm">
                      <span className={u.wallet_frozen ? 'text-rose-600' : 'text-ink-900'}>
                        {formatMoney(u.balance_minor)}
                      </span>
                      {u.wallet_frozen && <span className="ml-1 text-xs text-rose-500">🔒</span>}
                    </td>
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
                          <span key={r} className={`badge ${r === 'admin' ? 'badge-warning' : 'badge-muted'}`}>{r}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-600 text-xs whitespace-nowrap">{formatDate(u.registered_at)}</td>
                    <td className="px-4 py-3 text-ink-600 text-xs whitespace-nowrap">{formatDate(u.last_login_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 flex-wrap min-w-[220px]">
                        {/* Transactions */}
                        <button onClick={() => setTxTarget(u)} className="btn-ghost text-xs text-ink-600 px-2 py-1">
                          <Eye className="h-3.5 w-3.5" /> Txns
                        </button>
                        {/* Wallet adjust */}
                        <button onClick={() => setAdjustTarget(u)} className="btn-ghost text-xs text-brand-700 px-2 py-1">
                          <Wallet className="h-3.5 w-3.5" /> Adjust
                        </button>
                        {/* Role toggle */}
                        {isAdmin ? (
                          <button onClick={() => setRoleTarget(u)} className="btn-ghost text-xs text-amber-600 px-2 py-1">
                            <ShieldOff className="h-3.5 w-3.5" /> Demote
                          </button>
                        ) : (
                          <button onClick={() => setRoleTarget(u)} className="btn-ghost text-xs text-ink-700 px-2 py-1">
                            <Shield className="h-3.5 w-3.5" /> Promote
                          </button>
                        )}
                        {/* Suspend */}
                        {u.is_suspended ? (
                          <button onClick={() => unsuspend.mutate(u.id)} disabled={unsuspend.isPending}
                            className="btn-ghost text-xs text-brand-700 px-2 py-1">
                            <UserCheck className="h-3.5 w-3.5" /> Restore
                          </button>
                        ) : (
                          <button onClick={() => setSuspend(u)} className="btn-ghost text-xs text-rose-600 px-2 py-1">
                            <Ban className="h-3.5 w-3.5" /> Suspend
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

      {/* Suspend modal */}
      {suspendTarget && (
        <Modal onClose={() => { setSuspend(null); setReason(''); }}>
          <h3 className="font-semibold text-lg">Suspend {suspendTarget.name}?</h3>
          <p className="text-sm text-ink-600 mt-1">All active sessions will be revoked immediately.</p>
          <div className="mt-4">
            <label className="label">Reason <span className="text-rose-500">*</span></label>
            <input className="input" placeholder="e.g. Suspicious activity"
              value={suspendReason} onChange={(e) => setReason(e.target.value)} autoFocus />
            <p className="mt-1 text-xs text-ink-500">Shown to the user when they try to log in.</p>
          </div>
          <div className="flex gap-2 mt-5 justify-end">
            <button onClick={() => { setSuspend(null); setReason(''); }} className="btn-outline">Cancel</button>
            <button onClick={() => suspend.mutate({ id: suspendTarget.id, reason: suspendReason })}
              disabled={!suspendReason.trim() || suspend.isPending}
              className="btn bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-50">
              {suspend.isPending ? 'Suspending…' : 'Confirm suspend'}
            </button>
          </div>
        </Modal>
      )}

      {/* Role modal */}
      {roleTarget && (
        <Modal onClose={() => setRoleTarget(null)}>
          {roleTarget.roles?.includes('admin') ? (
            <>
              <h3 className="font-semibold text-lg">Remove admin from {roleTarget.name}?</h3>
              <p className="text-sm text-ink-600 mt-2">They will lose admin panel access. Their wallet remains active.</p>
              <div className="flex gap-2 mt-5 justify-end">
                <button onClick={() => setRoleTarget(null)} className="btn-outline">Cancel</button>
                <button onClick={() => toggleRole.mutate({ id: roleTarget.id, role: 'user' })}
                  disabled={toggleRole.isPending} className="btn-primary">
                  {toggleRole.isPending ? 'Updating…' : 'Remove admin role'}
                </button>
              </div>
            </>
          ) : (
            <>
              <h3 className="font-semibold text-lg">Promote {roleTarget.name} to admin?</h3>
              <p className="text-sm text-ink-600 mt-2">Full access to admin panel — users, transactions, services.</p>
              <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                ⚠ Only grant to people you fully trust.
              </div>
              <div className="flex gap-2 mt-5 justify-end">
                <button onClick={() => setRoleTarget(null)} className="btn-outline">Cancel</button>
                <button onClick={() => toggleRole.mutate({ id: roleTarget.id, role: 'admin' })}
                  disabled={toggleRole.isPending}
                  className="btn bg-amber-500 text-white hover:bg-amber-400">
                  {toggleRole.isPending ? 'Updating…' : 'Grant admin access'}
                </button>
              </div>
            </>
          )}
        </Modal>
      )}

      {/* Wallet adjust modal */}
      {adjustTarget && (
        <WalletAdjustModal user={adjustTarget} onClose={() => setAdjustTarget(null)}
          onDone={() => { setAdjustTarget(null); qc.invalidateQueries({ queryKey: ['admin', 'users'] }); }} />
      )}

      {/* User transactions modal */}
      {txTarget && (
        <UserTxModal user={txTarget} onClose={() => setTxTarget(null)} />
      )}
    </div>
  );
}

// ─── Wallet Adjust Modal ──────────────────────────────────────────────────────

function WalletAdjustModal({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: () => void }) {
  const [direction, setDirection] = useState<'credit' | 'debit'>('credit');
  const [amount, setAmount]       = useState('');
  const [reason, setReason]       = useState('');

  const adjust = useMutation({
    mutationFn: () => apiCall<null>({
      method: 'POST',
      url:    `/admin/users/${user.id}/adjust-wallet`,
      data:   { direction, amount: parseFloat(amount), reason },
    }),
    onSuccess: () => { toast.success(`Wallet ${direction}ed successfully.`); onDone(); },
    onError:   (e) => toast.error((e as Error).message),
  });

  const num = parseFloat(amount || '0');
  const canSubmit = num > 0 && num <= 10000 && reason.trim().length >= 5 && !adjust.isPending;

  return (
    <Modal onClose={onClose}>
      <h3 className="font-semibold text-lg">Adjust wallet — {user.name}</h3>
      <p className="text-sm text-ink-600 mt-1">
        Current balance: <span className="font-semibold">{formatMoney(user.balance_minor)}</span>
      </p>

      <div className="mt-5 space-y-4">
        {/* Direction toggle */}
        <div>
          <label className="label">Direction</label>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setDirection('credit')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition ${
                direction === 'credit'
                  ? 'bg-brand-50 border-brand-400 text-brand-700'
                  : 'border-ink-200 text-ink-600 hover:border-ink-300'
              }`}>
              <Plus className="h-4 w-4" /> Credit (add funds)
            </button>
            <button onClick={() => setDirection('debit')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition ${
                direction === 'debit'
                  ? 'bg-rose-50 border-rose-400 text-rose-700'
                  : 'border-ink-200 text-ink-600 hover:border-ink-300'
              }`}>
              <Minus className="h-4 w-4" /> Debit (remove funds)
            </button>
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="label">Amount (USD)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500">$</span>
            <input type="number" min="0.01" max="10000" step="0.01"
              className="input pl-7" placeholder="0.00"
              value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="label">Reason <span className="text-rose-500">*</span></label>
          <input className="input" placeholder="e.g. Compensation for failed payment on 23 Apr"
            value={reason} onChange={(e) => setReason(e.target.value)} />
          <p className="mt-1 text-xs text-ink-500">Minimum 5 characters. Recorded in the audit log.</p>
        </div>

        {/* Preview */}
        {num > 0 && (
          <div className={`rounded-lg px-4 py-3 text-sm ${direction === 'credit' ? 'bg-brand-50 text-brand-800' : 'bg-rose-50 text-rose-800'}`}>
            New balance will be: <strong>
              {formatMoney(direction === 'credit'
                ? user.balance_minor + Math.round(num * 100)
                : user.balance_minor - Math.round(num * 100)
              )}
            </strong>
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-5 justify-end">
        <button onClick={onClose} className="btn-outline">Cancel</button>
        <button onClick={() => adjust.mutate()} disabled={!canSubmit}
          className={`btn text-white disabled:opacity-50 ${direction === 'credit' ? 'bg-brand-600 hover:bg-brand-500' : 'bg-rose-600 hover:bg-rose-500'}`}>
          {adjust.isPending ? 'Processing…' : `Confirm ${direction}`}
        </button>
      </div>
    </Modal>
  );
}

// ─── User Transactions Modal ───────────────────────────────────────────────────

function UserTxModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const txs = useQuery({
    queryKey: ['admin', 'user-txns', user.id],
    queryFn:  () => apiCall<Paginated<Transaction>>({
      url: `/admin/users/${user.id}/transactions`, params: { per_page: 20 },
    }),
  });

  return (
    <Modal onClose={onClose} wide>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-lg">{user.name}</h3>
          <p className="text-sm text-ink-500">{user.email} · {formatMoney(user.balance_minor)} balance</p>
        </div>
      </div>

      {txs.isLoading ? (
        <p className="text-sm text-ink-500 py-4 text-center">Loading…</p>
      ) : (txs.data?.items ?? []).length === 0 ? (
        <p className="text-sm text-ink-500 py-4 text-center">No transactions yet.</p>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="min-w-full text-sm">
            <thead className="bg-ink-50 border-b border-ink-100">
              <tr>
                {['Reference', 'Type', 'Amount', 'Status', 'Date'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-ink-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {txs.data!.items.map((tx) => {
                const isCredit = tx.type === 'wallet_funding' || tx.type === 'refund';
                return (
                  <tr key={tx.id} className="hover:bg-ink-50/50">
                    <td className="px-3 py-2 font-mono text-xs">{tx.reference}</td>
                    <td className="px-3 py-2 text-ink-600 capitalize">{tx.type.replace('_', ' ')}</td>
                    <td className="px-3 py-2 font-mono">
                      <span className={isCredit ? 'text-brand-700' : 'text-ink-900'}>
                        {isCredit ? '+' : '−'}{formatMoney(tx.amount_minor, tx.currency)}
                      </span>
                    </td>
                    <td className="px-3 py-2"><StatusBadge status={tx.status} /></td>
                    <td className="px-3 py-2 text-ink-600 text-xs">{formatDate(tx.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <button onClick={onClose} className="btn-outline">Close</button>
      </div>
    </Modal>
  );
}

// ─── Transactions Tab ─────────────────────────────────────────────────────────

function TransactionsTab() {
  const [page, setPage]     = useState(1);
  const [type, setType]     = useState('');
  const [status, setStatus] = useState('');
  const [email, setEmail]   = useState('');

  const txs = useQuery({
    queryKey: ['admin', 'transactions', { page, type, status, email }],
    queryFn:  () => apiCall<Paginated<AdminTransaction>>({
      url: '/admin/transactions',
      params: { page, per_page: 50, type: type || undefined, status: status || undefined, user_email: email || undefined },
    }),
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
          <input className="input pl-9 w-56" placeholder="Filter by email…"
            value={email} onChange={(e) => { setEmail(e.target.value); setPage(1); }} />
        </div>
        <select className="input w-44" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
          <option value="">All types</option>
          <option value="wallet_funding">Funding</option>
          <option value="service_purchase">Service purchase</option>
          <option value="refund">Refund</option>
          <option value="adjustment">Adjustment</option>
        </select>
        <select className="input w-44" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="success">Success</option>
          <option value="processing">Processing</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-ink-50 border-b border-ink-100">
              <tr>
                {['Reference', 'User', 'Type', 'Amount', 'Status', 'Date'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {txs.isLoading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-500">Loading…</td></tr>
              ) : (txs.data?.items ?? []).length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-500">No transactions match filters.</td></tr>
              ) : (txs.data!.items as AdminTransaction[]).map((tx) => {
                const isCredit = tx.type === 'wallet_funding' || tx.type === 'refund';
                return (
                  <tr key={tx.id} className="hover:bg-ink-50/50">
                    <td className="px-4 py-3 font-mono text-xs">{tx.reference}</td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-medium">{tx.user_name ?? '—'}</div>
                      <div className="text-ink-500">{tx.user_email ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-ink-600 capitalize">{tx.type.replace('_', ' ')}</td>
                    <td className="px-4 py-3 font-mono">
                      <span className={isCredit ? 'text-brand-700' : 'text-ink-900'}>
                        {isCredit ? '+' : '−'}{formatMoney(tx.amount_minor, tx.currency)}
                      </span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={tx.status} /></td>
                    <td className="px-4 py-3 text-ink-600 text-xs whitespace-nowrap">{formatDate(tx.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {txs.data && txs.data.meta.last_page > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-ink-100">
            <span className="text-xs text-ink-500">
              Page {txs.data.meta.current_page} of {txs.data.meta.last_page} · {txs.data.meta.total} total
            </span>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-outline px-2 py-1.5">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= txs.data.meta.last_page} className="btn-outline px-2 py-1.5">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Services Tab ─────────────────────────────────────────────────────────────

function ServicesTab() {
  const qc = useQueryClient();
  const [markupTarget, setMarkupTarget] = useState<AdminService | null>(null);
  const [markup, setMarkup]             = useState('');

  const services = useQuery({
    queryKey: ['admin', 'services'],
    queryFn:  () => apiCall<AdminService[]>({ url: '/admin/services' }),
  });

  const toggle = useMutation({
    mutationFn: ({ code, is_active }: { code: string; is_active: boolean }) =>
      apiCall<null>({ method: 'POST', url: `/admin/services/${code}/toggle`, data: { is_active } }),
    onSuccess: (_, v) => {
      toast.success(v.is_active ? 'Service enabled.' : 'Service disabled.');
      qc.invalidateQueries({ queryKey: ['admin', 'services'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const updateMarkup = useMutation({
    mutationFn: ({ code, pct }: { code: string; pct: number }) =>
      apiCall<null>({ method: 'POST', url: `/admin/services/${code}/markup`, data: { markup_percent: pct } }),
    onSuccess: () => {
      toast.success('Markup updated.'); setMarkupTarget(null);
      qc.invalidateQueries({ queryKey: ['admin', 'services'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const grouped = (services.data ?? []).reduce((acc: Record<string, AdminService[]>, s) => {
    acc[s.category] ??= [];
    acc[s.category].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {services.isLoading ? (
        <div className="text-sm text-ink-500">Loading…</div>
      ) : Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <h3 className="font-semibold text-ink-800 capitalize mb-3">
            {category.replace('_', ' ')}
          </h3>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-ink-50 border-b border-ink-100">
                  <tr>
                    {['Service', 'Provider', 'Markup', 'Orders today', 'Failed (7d)', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {items.map((svc) => (
                    <tr key={svc.code} className="hover:bg-ink-50/50">
                      <td className="px-4 py-3">
                        <div className="font-medium">{svc.name}</div>
                        <div className="text-xs text-ink-500 mt-0.5">{svc.description}</div>
                      </td>
                      <td className="px-4 py-3 text-ink-600">{svc.provider}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => { setMarkupTarget(svc); setMarkup(String(svc.markup_percent)); }}
                          className="text-ink-700 hover:text-ink-900 font-mono text-sm underline decoration-dashed">
                          {svc.markup_percent}%
                        </button>
                      </td>
                      <td className="px-4 py-3 text-ink-700">{svc.orders_today}</td>
                      <td className="px-4 py-3">
                        <span className={svc.orders_failed > 0 ? 'text-rose-600 font-medium' : 'text-ink-600'}>
                          {svc.orders_failed}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {svc.is_active
                          ? <span className="badge-success">Active</span>
                          : <span className="badge-muted">Disabled</span>}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggle.mutate({ code: svc.code, is_active: !svc.is_active })}
                          disabled={toggle.isPending}
                          className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition ${
                            svc.is_active
                              ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
                              : 'border-brand-200 text-brand-700 hover:bg-brand-50'
                          }`}>
                          {svc.is_active
                            ? <><ToggleRight className="h-3.5 w-3.5" /> Disable</>
                            : <><ToggleLeft className="h-3.5 w-3.5" /> Enable</>}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}

      {/* Markup modal */}
      {markupTarget && (
        <Modal onClose={() => setMarkupTarget(null)}>
          <h3 className="font-semibold text-lg">Update markup — {markupTarget.name}</h3>
          <p className="text-sm text-ink-600 mt-1">
            The markup is added on top of the provider's cost before charging the user.
          </p>
          <div className="mt-4">
            <label className="label">Markup percentage</label>
            <div className="relative">
              <input type="number" min="0" max="500" step="0.5"
                className="input pr-8" value={markup}
                onChange={(e) => setMarkup(e.target.value)} autoFocus />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500">%</span>
            </div>
            <p className="mt-1 text-xs text-ink-500">
              Example: provider charges $0.80 with 15% markup → user pays $0.92
            </p>
          </div>
          <div className="flex gap-2 mt-5 justify-end">
            <button onClick={() => setMarkupTarget(null)} className="btn-outline">Cancel</button>
            <button
              onClick={() => updateMarkup.mutate({ code: markupTarget.code, pct: parseFloat(markup) })}
              disabled={!markup || isNaN(parseFloat(markup)) || updateMarkup.isPending}
              className="btn-primary">
              {updateMarkup.isPending ? 'Saving…' : 'Save markup'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Shared Components ────────────────────────────────────────────────────────

function Modal({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 bg-ink-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`card-pad w-full shadow-xl max-h-[85vh] overflow-y-auto ${wide ? 'max-w-3xl' : 'max-w-md'}`}>
        {children}
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, color }: {
  label: string; value: string | number;
  icon?: React.ComponentType<{ className?: string }>; color?: 'green' | 'red' | 'amber';
}) {
  const text = color === 'green' ? 'text-brand-700' : color === 'red' ? 'text-rose-600' : color === 'amber' ? 'text-amber-600' : 'text-ink-900';
  return (
    <div className="card-pad">
      <div className="flex items-center gap-2 text-ink-500 text-xs uppercase tracking-wide mb-2">
        {Icon && <Icon className="h-3.5 w-3.5" />} {label}
      </div>
      <div className={`text-2xl font-semibold tracking-tight ${text}`}>{value}</div>
    </div>
  );
}
