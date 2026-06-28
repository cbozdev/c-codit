import { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiCall } from '@/lib/api';
import { useAppSettings } from '@/components/Logo';
import { formatMoney, formatDate } from '@/lib/format';
import type { Paginated, Transaction } from '@/types/api';
import {
  Activity, Users, AlertTriangle, TrendingUp, Search,
  Ban, UserCheck, Shield, ShieldOff, Wallet,
  ChevronLeft, ChevronRight, ToggleLeft, ToggleRight,
  Plus, Minus, RefreshCw, Eye, ImagePlus, Settings2,
  DollarSign, TrendingDown, BarChart3, RotateCcw,
  Globe, Server, Key, EyeOff, Trash2, CheckCircle2,
  Gift, Crown, Calendar, Pencil,
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

type Tab = 'metrics' | 'analytics' | 'profit' | 'users' | 'transactions' | 'services' | 'messages' | 'livechat' | 'settings' | 'proxy' | 'apikeys' | 'auditlog' | 'health' | 'referrals';

const TAB_LABELS: Record<Tab, string> = {
  metrics: 'Metrics', analytics: 'Analytics', profit: 'Profit', users: 'Users',
  transactions: 'Transactions', services: 'Services', proxy: 'Proxy',
  messages: 'Messages', livechat: 'Live chat', settings: 'Settings',
  apikeys: 'API Keys', auditlog: 'Audit log', health: 'Health', referrals: 'Referrals',
};

type ProfitSummary = {
  orders: number; revenue_minor: number; cost_minor: number;
  profit_minor: number; margin_percent: number;
};
type ProfitByService = ProfitSummary & { name: string; category: string; markup_percent: number };
type ProfitByDay     = { date: string; orders: number; revenue_minor: number; profit_minor: number };
type ProfitData = {
  period: string; summary: ProfitSummary;
  by_service: ProfitByService[]; by_day: ProfitByDay[];
};

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
        {(['metrics', 'analytics', 'profit', 'users', 'transactions', 'services', 'proxy', 'messages', 'livechat', 'settings', 'apikeys', 'auditlog', 'health', 'referrals'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition -mb-px ${
              tab === t
                ? 'border-ink-900 text-ink-900'
                : 'border-transparent text-ink-500 hover:text-ink-700'
            }`}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === 'metrics'      && <MetricsTab />}
      {tab === 'analytics'    && <AnalyticsTab />}
      {tab === 'profit'       && <ProfitTab />}
      {tab === 'users'        && <UsersTab />}
      {tab === 'transactions' && <TransactionsTab />}
      {tab === 'services'     && <ServicesTab />}
      {tab === 'proxy'        && <ProxyAdminTab />}
      {tab === 'messages'     && <MessagesTab />}
      {tab === 'livechat'     && <LiveChatTab />}
      {tab === 'settings'    && <AppSettingsTab />}
      {tab === 'apikeys'     && <ApiKeysTab />}
      {tab === 'auditlog'    && <AuditLogTab />}
      {tab === 'health'      && <HealthTab />}
      {tab === 'referrals'   && <ReferralsTab />}
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
  const [msgTarget, setMsgTarget]       = useState<AdminUser | null>(null);

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
                        {/* Message user */}
                        <button onClick={() => setMsgTarget(u)} className="btn-ghost text-xs text-ink-600 px-2 py-1">
                          ✉ Message
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

      {/* User message modal */}
      {msgTarget && (
        <UserMessageModal user={msgTarget} onClose={() => setMsgTarget(null)} />
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
  const qc                  = useQueryClient();
  const [page, setPage]     = useState(1);
  const [type, setType]     = useState('');
  const [status, setStatus] = useState('');
  const [email, setEmail]   = useState('');
  const [refundTarget, setRefundTarget] = useState<AdminTransaction | null>(null);
  const [refundReason, setRefundReason] = useState('');

  const txs = useQuery({
    queryKey: ['admin', 'transactions', { page, type, status, email }],
    queryFn:  () => apiCall<Paginated<AdminTransaction>>({
      url: '/admin/transactions',
      params: { page, per_page: 50, type: type || undefined, status: status || undefined, user_email: email || undefined },
    }),
  });

  const refund = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiCall<null>({ method: 'POST', url: `/admin/transactions/${id}/refund`, data: { reason } }),
    onSuccess: () => {
      toast.success('Transaction refunded.');
      qc.invalidateQueries({ queryKey: ['admin', 'transactions'] });
      setRefundTarget(null);
      setRefundReason('');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const canRefund = (tx: AdminTransaction) =>
    tx.type === 'service_purchase' && (tx.status === 'processing' || tx.status === 'failed');

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
                {['Reference', 'User', 'Type', 'Amount', 'Status', 'Date', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {txs.isLoading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-ink-500">Loading…</td></tr>
              ) : (txs.data?.items ?? []).length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-ink-500">No transactions match filters.</td></tr>
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
                    <td className="px-4 py-3">
                      {canRefund(tx) && (
                        <button
                          onClick={() => { setRefundTarget(tx); setRefundReason(''); }}
                          className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 font-medium"
                          title="Refund this transaction"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Refund
                        </button>
                      )}
                    </td>
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

      {/* Refund confirmation modal */}
      {refundTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold">Refund Transaction</h3>
            <div className="rounded-lg bg-ink-50 border border-ink-100 p-3 text-sm space-y-1">
              <div className="font-mono text-xs text-ink-500">{refundTarget.reference}</div>
              <div className="font-medium">{refundTarget.user_name} · {refundTarget.user_email}</div>
              <div className="text-rose-600 font-semibold">{formatMoney(refundTarget.amount_minor, refundTarget.currency)}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1">Reason (optional)</label>
              <input
                className="input w-full"
                placeholder="e.g. Provider failed, order stuck"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                className="btn-outline"
                onClick={() => setRefundTarget(null)}
                disabled={refund.isPending}
              >
                Cancel
              </button>
              <button
                className="btn-danger"
                disabled={refund.isPending}
                onClick={() => refund.mutate({ id: refundTarget.id, reason: refundReason })}
              >
                {refund.isPending ? 'Refunding…' : 'Confirm Refund'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Services Tab ─────────────────────────────────────────────────────────────

function ServicesTab() {
  const qc = useQueryClient();
  const [markupTarget, setMarkupTarget] = useState<AdminService | null>(null);
  const [markup, setMarkup]             = useState('');
  const [renameTarget, setRenameTarget] = useState<AdminService | null>(null);
  const [newName, setNewName]           = useState('');

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
      qc.invalidateQueries({ queryKey: ['services'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const renameService = useMutation({
    mutationFn: ({ code, name }: { code: string; name: string }) =>
      apiCall<null>({ method: 'POST', url: `/admin/services/${code}/rename`, data: { name } }),
    onSuccess: () => {
      toast.success('Service renamed.'); setRenameTarget(null);
      qc.invalidateQueries({ queryKey: ['admin', 'services'] });
      qc.invalidateQueries({ queryKey: ['services'] });
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
                    {['Service', 'Provider', 'Markup', 'Orders today', 'Failed (7d)', 'Status', 'Actions', ''].map((h) => (
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
                      <td className="px-4 py-3">
                        <button
                          onClick={() => { setRenameTarget(svc); setNewName(svc.name); }}
                          className="p-1.5 rounded-lg text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition"
                          title="Rename">
                          <Pencil className="h-3.5 w-3.5" />
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

      {/* Rename modal */}
      {renameTarget && (
        <Modal onClose={() => setRenameTarget(null)}>
          <h3 className="font-semibold text-lg">Rename service</h3>
          <p className="text-sm text-ink-600 mt-1">This name is shown to users on the services page.</p>
          <div className="mt-4">
            <label className="label">Display name</label>
            <input
              type="text" maxLength={80}
              className="input" value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex gap-2 mt-5 justify-end">
            <button onClick={() => setRenameTarget(null)} className="btn-outline">Cancel</button>
            <button
              onClick={() => renameService.mutate({ code: renameTarget.code, name: newName.trim() })}
              disabled={!newName.trim() || newName.trim() === renameTarget.name || renameService.isPending}
              className="btn-primary">
              {renameService.isPending ? 'Saving…' : 'Save name'}
            </button>
          </div>
        </Modal>
      )}

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

// ─── User Message Modal ───────────────────────────────────────────────────────

function UserMessageModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [subject, setSubject] = useState('');
  const [body, setBody]       = useState('');

  const send = useMutation({
    mutationFn: () => apiCall<null>({
      method: 'POST',
      url: `/admin/users/${user.id}/message`,
      data: { subject, body, channel: 'email' },
    }),
    onSuccess: () => { toast.success(`Message sent to ${user.name}.`); onClose(); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Modal onClose={onClose}>
      <h3 className="font-semibold text-lg dark:text-white">Message {user.name}</h3>
      <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">{user.email}</p>
      <div className="mt-4 space-y-3">
        <div>
          <label className="label">Subject</label>
          <input className="input" placeholder="e.g. Important update about your account"
            value={subject} onChange={(e) => setSubject(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label">Message</label>
          <textarea className="input h-32 resize-none" placeholder="Write your message…"
            value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2 mt-4 justify-end">
        <button onClick={onClose} className="btn-outline">Cancel</button>
        <button onClick={() => send.mutate()} disabled={!subject.trim() || !body.trim() || send.isPending}
          className="btn-primary">
          {send.isPending ? 'Sending…' : '✉ Send message'}
        </button>
      </div>
    </Modal>
  );
}

// ─── Messages Tab ─────────────────────────────────────────────────────────────

function MessagesTab() {
  const [subject, setSubject]   = useState('');
  const [body, setBody]         = useState('');
  const [audience, setAudience] = useState('all');
  const [result, setResult]     = useState<string | null>(null);

  const broadcast = useMutation({
    mutationFn: () => apiCall<{ sent_to: number }>({
      method: 'POST', url: '/admin/broadcast',
      data: { subject, body, audience },
    }),
    onSuccess: (data) => {
      setResult(`✅ Message queued for ${data.sent_to} users.`);
      setSubject(''); setBody('');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="card-pad space-y-4">
        <h3 className="font-semibold dark:text-white">Broadcast to users</h3>
        <p className="text-sm text-ink-600 dark:text-ink-400">Send an email to a group of users. To message a single user, go to the Users tab and click ✉ Message.</p>
        <div>
          <label className="label">Audience</label>
          <select className="input" value={audience} onChange={(e) => setAudience(e.target.value)}>
            <option value="all">All users</option>
            <option value="verified">Verified email only</option>
            <option value="active_30d">Active in last 30 days</option>
          </select>
        </div>
        <div>
          <label className="label">Subject</label>
          <input className="input" placeholder="e.g. Important update" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div>
          <label className="label">Message body</label>
          <textarea className="input h-40 resize-none" placeholder="Write your message…" value={body} onChange={(e) => setBody(e.target.value)} />
          <p className="text-xs text-ink-500 mt-1">{body.length}/5000 characters</p>
        </div>
        {result && (
          <div className="p-3 rounded-lg bg-brand-50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-800 text-sm text-brand-800 dark:text-brand-300">{result}</div>
        )}
        <button
          onClick={() => { if (confirm(`Send to ${audience}? Cannot be undone.`)) broadcast.mutate(); }}
          disabled={!subject.trim() || !body.trim() || broadcast.isPending}
          className="btn-primary">
          {broadcast.isPending ? 'Sending…' : '📢 Send broadcast'}
        </button>
      </div>
    </div>
  );
}

// ─── Live Chat Settings Tab ───────────────────────────────────────────────────

function LiveChatTab() {
  const [widgetId, setWidgetId] = useState(
    localStorage.getItem('admin_tawk_id') ?? ''
  );
  const [saved, setSaved] = useState(false);

  function save() {
    localStorage.setItem('admin_tawk_id', widgetId);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    toast.success('Live chat settings saved. Refresh the page to apply.');
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="card-pad space-y-4">
        <h3 className="font-semibold dark:text-white">Tawk.to Live Chat</h3>
        <p className="text-sm text-ink-600 dark:text-ink-400">
          Connect your Tawk.to account to enable live chat for all users.
          The chat widget will appear on the bottom-right of every page.
        </p>

        <div className="p-4 rounded-lg bg-ink-50 dark:bg-ink-800 space-y-2 text-sm">
          <p className="font-medium dark:text-white">Setup steps:</p>
          <ol className="list-decimal ml-4 space-y-1 text-ink-600 dark:text-ink-400">
            <li>Sign up free at <a href="https://tawk.to" target="_blank" rel="noreferrer" className="text-brand-700 dark:text-brand-400 underline">tawk.to</a></li>
            <li>Create a property for C-codit</li>
            <li>Go to <strong>Administration → Channels → Chat Widget</strong></li>
            <li>Copy your <strong>Property ID</strong> (looks like <code>6abc123.../1abc123d</code>)</li>
            <li>Paste it below and save</li>
          </ol>
        </div>

        <div>
          <label className="label">Tawk.to Property ID</label>
          <input className="input font-mono" placeholder="e.g. 6abc123def456/1abc123d"
            value={widgetId} onChange={(e) => setWidgetId(e.target.value)} />
          <p className="text-xs text-ink-500 mt-1">
            Found in your Tawk.to dashboard under Administration → Chat Widget → Direct Chat Link
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={save} disabled={!widgetId.trim()} className="btn-primary">
            {saved ? '✓ Saved' : 'Save & apply'}
          </button>
          {widgetId && (
            <a href={`https://embed.tawk.to/${widgetId}`} target="_blank" rel="noreferrer"
              className="btn-outline text-sm">
              Test widget ↗
            </a>
          )}
        </div>

        <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-400">
          💡 For the widget to load on the live site, the Tawk.to Property ID also needs to be added to <code>index.html</code> in your codebase. Contact your developer to update the script tag.
        </div>
      </div>

      <div className="card-pad space-y-3">
        <h3 className="font-semibold dark:text-white">Current chat status</h3>
        <div className="flex items-center gap-3">
          <div className={`h-2.5 w-2.5 rounded-full ${(window as any).Tawk_API ? 'bg-brand-500' : 'bg-ink-300'}`} />
          <span className="text-sm text-ink-600 dark:text-ink-400">
            {(window as any).Tawk_API ? 'Tawk.to widget is active' : 'Tawk.to not configured yet'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── App Settings Tab ─────────────────────────────────────────────────────────

function AppSettingsTab() {
  const qc = useQueryClient();
  const { data: current } = useAppSettings();
  const fileRef = useRef<HTMLInputElement>(null);

  const [logoUrl, setLogoUrl]         = useState('');
  const [appName, setAppName]         = useState('');
  const [support, setSupport]         = useState('');
  const [preview, setPreview]         = useState<string | null>(null);
  const [faviconUrl, setFaviconUrl]   = useState('');
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const faviconRef = useRef<HTMLInputElement>(null);

  // Seed fields from current settings once loaded
  useState(() => {
    if (current) {
      setLogoUrl(current.logo_url ?? '');
      setAppName((current as any).app_name ?? '');
      setSupport((current as any).support_email ?? '');
      setFaviconUrl((current as any).favicon_url ?? '');
    }
  });

  const save = useMutation({
    mutationFn: () => apiCall<null>({
      method: 'POST',
      url: '/admin/settings',
      data: {
        logo_url:      (preview ?? logoUrl) || null,
        favicon_url:   (faviconPreview ?? faviconUrl) || null,
        app_name:      appName || null,
        support_email: support || null,
      },
    }),
    onSuccess: () => {
      toast.success('Settings saved.');
      setPreview(null);
      setFaviconPreview(null);
      qc.invalidateQueries({ queryKey: ['app-settings'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { toast.error('Image must be under 500 KB.'); return; }
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function onFaviconChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 200 * 1024) { toast.error('Favicon must be under 200 KB.'); return; }
    const reader = new FileReader();
    reader.onload = () => setFaviconPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  const displayLogo = preview ?? logoUrl ?? current?.logo_url;

  return (
    <div className="space-y-6 max-w-xl">
      <div className="card-pad space-y-5">
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-ink-500" />
          <h3 className="font-semibold dark:text-white">App settings</h3>
        </div>

        {/* Logo */}
        <div className="space-y-3">
          <label className="label">App logo</label>

          {displayLogo && (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-ink-100 dark:border-ink-700 bg-ink-50 dark:bg-ink-800">
              <img src={displayLogo} alt="Logo preview" className="h-12 w-12 rounded-lg object-contain bg-white border border-ink-200" />
              <div className="text-xs text-ink-500 dark:text-ink-400">
                {preview ? 'File ready to save' : 'Current logo'}
              </div>
              <button onClick={() => { setPreview(null); setLogoUrl(''); }}
                className="ml-auto text-xs text-rose-600 hover:underline">Remove</button>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="https://example.com/logo.png"
                value={preview ? '(file selected)' : logoUrl}
                onChange={(e) => { setLogoUrl(e.target.value); setPreview(null); }}
                disabled={!!preview}
              />
              <button onClick={() => fileRef.current?.click()}
                className="btn-outline flex items-center gap-1.5 whitespace-nowrap">
                <ImagePlus className="h-4 w-4" /> Upload
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
            </div>
            <p className="text-xs text-ink-500 dark:text-ink-400">
              Paste a URL or upload an image (PNG/SVG, max 500 KB). Displayed in the sidebar and header.
            </p>
          </div>
        </div>

        {/* Favicon */}
        <div className="space-y-3">
          <label className="label">Favicon</label>

          {(faviconPreview ?? faviconUrl) && (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-ink-100 dark:border-ink-700 bg-ink-50 dark:bg-ink-800">
              <img src={faviconPreview ?? faviconUrl} alt="Favicon preview" className="h-8 w-8 rounded object-contain bg-white border border-ink-200" />
              <div className="text-xs text-ink-500 dark:text-ink-400">
                {faviconPreview ? 'File ready to save' : 'Current favicon'}
              </div>
              <button onClick={() => { setFaviconPreview(null); setFaviconUrl(''); }}
                className="ml-auto text-xs text-rose-600 hover:underline">Remove</button>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="https://example.com/favicon.ico"
                value={faviconPreview ? '(file selected)' : faviconUrl}
                onChange={(e) => { setFaviconUrl(e.target.value); setFaviconPreview(null); }}
                disabled={!!faviconPreview}
              />
              <button onClick={() => faviconRef.current?.click()}
                className="btn-outline flex items-center gap-1.5 whitespace-nowrap">
                <ImagePlus className="h-4 w-4" /> Upload
              </button>
              <input ref={faviconRef} type="file" accept="image/*" className="hidden" onChange={onFaviconChange} />
            </div>
            <p className="text-xs text-ink-500 dark:text-ink-400">
              Upload a PNG, ICO, or SVG (max 200 KB). Shown in browser tabs.
            </p>
          </div>
        </div>

        {/* App name */}
        <div>
          <label className="label">App name</label>
          <input className="input" placeholder="C-codit" value={appName}
            onChange={(e) => setAppName(e.target.value)} />
          <p className="text-xs text-ink-500 dark:text-ink-400 mt-1">Shown next to the logo.</p>
        </div>

        {/* Support email */}
        <div>
          <label className="label">Support email</label>
          <input className="input" type="email" placeholder="support@c-codit.com"
            value={support} onChange={(e) => setSupport(e.target.value)} />
        </div>

        <button onClick={() => save.mutate()} disabled={save.isPending} className="btn-primary">
          {save.isPending ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </div>
  );
}

// ─── Profit Tab ───────────────────────────────────────────────────────────────

function ProfitTab() {
  const [period, setPeriod] = useState<'today' | '7d' | '30d' | 'all'>('30d');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'profit', period],
    queryFn:  () => apiCall<ProfitData>({ url: '/admin/profit', params: { period } }),
  });

  const s = data?.summary;

  function money(minor: number) { return formatMoney(minor); }
  function pct(n: number) { return n.toFixed(1) + '%'; }

  const categoryLabel: Record<string, string> = {
    virtual_number: 'Virtual Numbers',
    esim:           'eSIM',
    giftcard:       'Gift Cards',
    utility:        'Utility Bills',
  };

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-ink-500 mr-1">Period:</span>
        {(['today', '7d', '30d', 'all'] as const).map((p) => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-3 py-1 text-sm rounded-lg border transition ${
              period === p
                ? 'bg-ink-900 text-white border-ink-900'
                : 'border-ink-200 text-ink-600 hover:border-ink-400'
            }`}>
            {p === 'today' ? 'Today' : p === 'all' ? 'All time' : p}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-ink-500">Loading…</p>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard icon={TrendingUp}   label="Revenue"     value={s ? money(s.revenue_minor) : '…'} />
            <MetricCard icon={TrendingDown} label="Cost"        value={s ? money(s.cost_minor)    : '…'} />
            <MetricCard icon={DollarSign}   label="Profit"      value={s ? money(s.profit_minor)  : '…'} color="green" />
            <MetricCard icon={BarChart3}    label="Margin"      value={s ? pct(s.margin_percent)  : '…'} color={s && s.margin_percent >= 10 ? 'green' : 'amber'} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <MetricCard label="Completed orders" value={s?.orders ?? '…'} />
            <MetricCard label="Avg profit / order" value={s && s.orders > 0 ? money(Math.round(s.profit_minor / s.orders)) : '—'} />
          </div>

          {/* By service */}
          <div>
            <h2 className="text-sm font-semibold text-ink-700 mb-3">Breakdown by service</h2>
            <div className="overflow-x-auto rounded-xl border border-ink-200">
              <table className="w-full text-sm">
                <thead className="bg-ink-50 text-ink-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">Service</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-right">Orders</th>
                    <th className="px-4 py-3 text-right">Revenue</th>
                    <th className="px-4 py-3 text-right">Cost</th>
                    <th className="px-4 py-3 text-right">Profit</th>
                    <th className="px-4 py-3 text-right">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {data?.by_service.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-6 text-center text-ink-400">No completed orders in this period.</td></tr>
                  )}
                  {data?.by_service.map((row) => (
                    <tr key={row.name} className="hover:bg-ink-50 transition">
                      <td className="px-4 py-3 font-medium text-ink-800">{row.name}</td>
                      <td className="px-4 py-3 text-ink-500">{categoryLabel[row.category] ?? row.category}</td>
                      <td className="px-4 py-3 text-right">{row.orders}</td>
                      <td className="px-4 py-3 text-right">{money(row.revenue_minor)}</td>
                      <td className="px-4 py-3 text-right text-ink-500">
                        {row.cost_minor > 0 ? money(row.cost_minor) : <span className="text-ink-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-brand-700">{money(row.profit_minor)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          row.margin_percent >= 10 ? 'bg-brand-50 text-brand-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {pct(row.margin_percent)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data?.by_service.some((r) => r.cost_minor === 0) && (
              <p className="text-xs text-ink-400 mt-2">
                — Cost shown as — for utility bills (Flutterwave charges NGN directly; FX spread is the margin).
              </p>
            )}
          </div>

          {/* Daily breakdown */}
          {data && data.by_day.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-ink-700 mb-3">Daily summary</h2>
              <div className="overflow-x-auto rounded-xl border border-ink-200">
                <table className="w-full text-sm">
                  <thead className="bg-ink-50 text-ink-500 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-right">Orders</th>
                      <th className="px-4 py-3 text-right">Revenue</th>
                      <th className="px-4 py-3 text-right">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {[...data.by_day].reverse().map((row) => (
                      <tr key={row.date} className="hover:bg-ink-50 transition">
                        <td className="px-4 py-3 text-ink-700">{row.date}</td>
                        <td className="px-4 py-3 text-right">{row.orders}</td>
                        <td className="px-4 py-3 text-right">{money(row.revenue_minor)}</td>
                        <td className="px-4 py-3 text-right font-medium text-brand-700">{money(row.profit_minor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Audit Log Tab ────────────────────────────────────────────────────────────

type AuditLogEntry = {
  id: string; user_email: string | null; user_name: string | null;
  action: string; description: string | null; ip: string | null; created_at: string;
};

function AuditLogTab() {
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage]     = useState(1);

  const logs = useQuery({
    queryKey: ['admin', 'audit-logs', { search, action, page }],
    queryFn: () => apiCall<Paginated<AuditLogEntry>>({
      url: '/admin/audit-logs',
      params: { q: search || undefined, action: action || undefined, page, per_page: 50 },
    }),
  });

  const chip = (a: string) => {
    const map: Record<string, string> = {
      login: 'bg-blue-50 text-blue-700',
      logout: 'bg-ink-100 text-ink-600',
      register: 'bg-brand-50 text-brand-700',
      password_changed: 'bg-amber-50 text-amber-700',
      '2fa_enabled': 'bg-emerald-50 text-emerald-700',
      '2fa_disabled': 'bg-rose-50 text-rose-700',
      account_deleted: 'bg-rose-100 text-rose-800',
      admin_wallet_adjust: 'bg-violet-50 text-violet-700',
      admin_suspend: 'bg-rose-50 text-rose-700',
      admin_role_change: 'bg-amber-50 text-amber-700',
    };
    return map[a] ?? 'bg-ink-100 text-ink-600';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
          <input className="input pl-9" placeholder="Search by user, email, or description…"
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input w-52" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
          <option value="">All actions</option>
          <option value="login">Login</option>
          <option value="logout">Logout</option>
          <option value="register">Register</option>
          <option value="password_changed">Password changed</option>
          <option value="2fa_enabled">2FA enabled</option>
          <option value="2fa_disabled">2FA disabled</option>
          <option value="account_deleted">Account deleted</option>
          <option value="admin_wallet_adjust">Wallet adjustment</option>
          <option value="admin_suspend">Suspend</option>
          <option value="admin_role_change">Role change</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-ink-50 border-b border-ink-100">
              <tr>
                {['Time', 'User', 'Action', 'Details', 'IP'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {logs.isLoading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-500">Loading…</td></tr>
              ) : (logs.data?.items ?? []).length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-500">No audit log entries match your filters.</td></tr>
              ) : logs.data!.items.map((log) => (
                <tr key={log.id} className="hover:bg-ink-50/50">
                  <td className="px-4 py-3 text-xs text-ink-500 whitespace-nowrap">{formatDate(log.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="text-xs">
                      <div className="font-medium">{log.user_name ?? '—'}</div>
                      <div className="text-ink-500">{log.user_email ?? 'System'}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${chip(log.action)}`}>
                      {log.action.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-600 max-w-xs truncate">{log.description ?? '—'}</td>
                  <td className="px-4 py-3 text-xs font-mono text-ink-500">{log.ip ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {logs.data && logs.data.meta.last_page > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-ink-100">
            <span className="text-xs text-ink-500">
              Page {logs.data.meta.current_page} of {logs.data.meta.last_page} · {logs.data.meta.total} total
            </span>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-outline px-2 py-1.5">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= logs.data.meta.last_page} className="btn-outline px-2 py-1.5">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Service Health Tab ───────────────────────────────────────────────────────

type HealthResult = {
  provider: string; status: 'up' | 'down'; response_ms: number | null; checked_at: string;
};

function HealthTab() {
  const qc = useQueryClient();

  const health = useQuery({
    queryKey: ['admin', 'health'],
    queryFn: () => apiCall<HealthResult[]>({ url: '/admin/health' }),
    staleTime: 60_000,
    refetchOnMount: true,
  });

  const allUp = health.data?.every((h) => h.status === 'up');

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-brand-600" /> Provider health
          </h2>
          <p className="text-sm text-ink-500 mt-0.5">Live HTTP reachability check for all integrated providers.</p>
        </div>
        <button onClick={() => qc.invalidateQueries({ queryKey: ['admin', 'health'] })} className="btn-outline text-sm">
          <RefreshCw className="h-4 w-4" /> Check now
        </button>
      </div>

      {health.isLoading ? (
        <div className="text-sm text-ink-500 py-12 text-center">Checking providers…</div>
      ) : (
        <>
          {allUp !== undefined && (
            <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
              allUp
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400'
            }`}>
              <div className={`h-2.5 w-2.5 rounded-full ${allUp ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
              {allUp ? 'All systems operational' : 'One or more providers are down'}
            </div>
          )}

          <div className="space-y-3">
            {(health.data ?? []).map((h) => (
              <div key={h.provider} className={`card-pad flex items-center justify-between gap-4 ${
                h.status === 'down' ? 'border border-rose-200 dark:border-rose-800' : ''
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full shrink-0 ${
                    h.status === 'up' ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'
                  }`} />
                  <div>
                    <p className="font-medium capitalize text-sm">{h.provider.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-ink-500">
                      {h.status === 'up'
                        ? `${h.response_ms != null ? h.response_ms + ' ms' : 'OK'}`
                        : 'Unreachable'}
                      {h.checked_at ? ` · checked ${formatDate(h.checked_at)}` : ''}
                    </p>
                  </div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                  h.status === 'up'
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                    : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400'
                }`}>
                  {h.status === 'up' ? 'Online' : 'Down'}
                </span>
              </div>
            ))}
            {(health.data ?? []).length === 0 && (
              <div className="text-sm text-ink-500 py-4 text-center">No providers configured.</div>
            )}
          </div>
        </>
      )}

      <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-400">
        Checks run on page load. Providers that go down trigger an admin email alert (60-minute dedup to avoid spam).
      </div>
    </div>
  );
}

// ─── Referrals Tab ────────────────────────────────────────────────────────────

type TopReferrer = {
  user_name: string; user_email: string; total_referrals: number; code: string;
};

function ReferralsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'referrals'],
    queryFn: () => apiCall<{ total: number; top_referrers: TopReferrer[] }>({ url: '/admin/referrals' }),
  });

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h2 className="font-semibold flex items-center gap-2">
          <Gift className="h-4 w-4 text-brand-600" /> Referral programme
        </h2>
        <p className="text-sm text-ink-500 mt-0.5">Users earn $1.00 when someone they refer completes their first order.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <MetricCard icon={Users} label="Total referrals" value={data?.total ?? '…'} />
        <MetricCard icon={Gift} label="Commission paid" value={data ? formatMoney((data.total ?? 0) * 100) : '…'} color="green" />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">Top referrers</h3>
        <div className="card overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-ink-50 dark:bg-ink-800 border-b border-ink-100 dark:border-ink-700">
              <tr>
                {['#', 'User', 'Referral code', 'Referrals', 'Commission'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {isLoading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-500">Loading…</td></tr>
              ) : (data?.top_referrers ?? []).length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-500">No referrals recorded yet.</td></tr>
              ) : data!.top_referrers.map((r, i) => (
                <tr key={r.user_email} className="hover:bg-ink-50/50 dark:hover:bg-ink-800/50">
                  <td className="px-4 py-3 text-ink-400 text-sm font-mono">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm">{r.user_name}</div>
                    <div className="text-xs text-ink-500">{r.user_email}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm font-semibold tracking-widest">{r.code}</td>
                  <td className="px-4 py-3 font-semibold">{r.total_referrals}</td>
                  <td className="px-4 py-3 text-brand-700 dark:text-brand-400 font-mono font-medium">
                    {formatMoney(r.total_referrals * 100)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-ink-400 mt-2">Commission = $1.00 × number of referred users who completed their first order.</p>
      </div>
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

type PeriodStats = { orders: number; revenue_minor: number; profit_minor: number; funding_minor: number };
type RevenueStats = { weekly: PeriodStats; monthly: PeriodStats; yearly: PeriodStats; all_time: PeriodStats };
type TopSpender   = { name: string; email: string; orders: number; total_spent_minor: number };

function AnalyticsTab() {
  const [spenderPeriod, setSpenderPeriod] = useState<'week' | 'month' | 'year' | 'all'>('month');

  const revenue = useQuery({
    queryKey: ['admin', 'revenue-stats'],
    queryFn:  () => apiCall<RevenueStats>({ url: '/admin/revenue-stats' }),
  });

  const spenders = useQuery({
    queryKey: ['admin', 'top-spenders', spenderPeriod],
    queryFn:  () => apiCall<TopSpender[]>({ url: '/admin/top-spenders', params: { period: spenderPeriod, limit: 10 } }),
  });

  const r = revenue.data;

  function revCard(label: string, icon: React.ComponentType<{ className?: string }>, stats?: PeriodStats) {
    const Icon = icon;
    return (
      <div className="card-pad space-y-3">
        <div className="flex items-center gap-2 text-ink-500 text-xs uppercase tracking-wide">
          <Icon className="h-3.5 w-3.5" /> {label}
        </div>
        {stats ? (
          <div className="space-y-2">
            <div>
              <div className="text-xs text-ink-400 mb-0.5">Revenue (GMV)</div>
              <div className="text-xl font-semibold text-ink-900 dark:text-white">{formatMoney(stats.revenue_minor)}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-ink-100 dark:border-ink-800">
              <div>
                <div className="text-xs text-ink-400">Profit</div>
                <div className="text-sm font-semibold text-brand-700 dark:text-brand-400">{formatMoney(stats.profit_minor)}</div>
              </div>
              <div>
                <div className="text-xs text-ink-400">Deposits</div>
                <div className="text-sm font-semibold text-ink-700 dark:text-ink-300">{formatMoney(stats.funding_minor)}</div>
              </div>
            </div>
            <div className="text-xs text-ink-400">{stats.orders} completed orders</div>
          </div>
        ) : (
          <div className="animate-pulse space-y-2">
            <div className="h-6 bg-ink-100 dark:bg-ink-800 rounded w-1/2" />
            <div className="h-4 bg-ink-100 dark:bg-ink-800 rounded w-1/3" />
          </div>
        )}
      </div>
    );
  }

  const PERIOD_LABELS = { week: 'This week', month: 'This month', year: 'This year', all: 'All time' };

  return (
    <div className="space-y-8">
      {/* Revenue overview */}
      <div>
        <h2 className="text-sm font-semibold text-ink-700 dark:text-ink-300 uppercase tracking-wide mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-brand-600" /> Revenue overview
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {revCard('This week',  Calendar,   r?.weekly)}
          {revCard('This month', Calendar,   r?.monthly)}
          {revCard('This year',  TrendingUp, r?.yearly)}
          {revCard('All time',   BarChart3,  r?.all_time)}
        </div>
      </div>

      {/* Top spenders */}
      <div>
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <h2 className="text-sm font-semibold text-ink-700 dark:text-ink-300 uppercase tracking-wide flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-500" /> Top spenders
          </h2>
          <div className="flex gap-1">
            {(['week', 'month', 'year', 'all'] as const).map((p) => (
              <button key={p} onClick={() => setSpenderPeriod(p)}
                className={`px-3 py-1 text-xs rounded-lg border transition ${
                  spenderPeriod === p
                    ? 'bg-ink-900 text-white border-ink-900 dark:bg-ink-100 dark:text-ink-900'
                    : 'border-ink-200 text-ink-600 hover:border-ink-400 dark:border-ink-700 dark:text-ink-400'
                }`}>
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        <div className="card overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-ink-50 dark:bg-ink-800 border-b border-ink-100 dark:border-ink-700">
              <tr>
                {['#', 'User', 'Email', 'Orders', 'Total spent'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {spenders.isLoading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-500">Loading…</td></tr>
              ) : (spenders.data ?? []).length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-500">No completed orders in this period.</td></tr>
              ) : (spenders.data ?? []).map((s, i) => (
                <tr key={s.email} className="hover:bg-ink-50/50 dark:hover:bg-ink-800/50">
                  <td className="px-4 py-3 text-ink-400 font-mono text-sm w-10">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="ml-1">{i + 1}</span>}
                  </td>
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-ink-500 text-xs">{s.email}</td>
                  <td className="px-4 py-3 text-ink-700 dark:text-ink-300">{s.orders}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-brand-700 dark:text-brand-400">
                    {formatMoney(s.total_spent_minor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-ink-400 mt-2">Only completed service orders are counted. Wallet top-ups are not included.</p>
      </div>
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

// ─── Proxy Admin Tab ──────────────────────────────────────────────────────────

type ProxyOverview = {
  total_subscriptions: number;
  active_subscriptions: number;
  expired_subscriptions: number;
  trial_subscriptions: number;
  revenue_usd: string;
  by_provider: Record<string, number>;
  by_type: Record<string, number>;
  provider_stats: Record<string, { enabled: boolean; failures_1h: number }>;
};

type AdminProxySub = {
  id: string;
  provider: string;
  proxy_type: string;
  status: string;
  location_country: string;
  is_trial: boolean;
  bandwidth_gb_used: number;
  bandwidth_gb_total: number;
  expires_at: string;
  created_at: string;
  user?: { name: string; email: string; public_id: string };
};

function ProxyAdminTab() {
  const qc                  = useQueryClient();
  const [subTab, setSubTab] = useState<'overview' | 'subscriptions' | 'analytics'>('overview');
  const [statusFilter, setStatusFilter] = useState('');
  const [providerFilter, setProviderFilter] = useState('');

  const overview = useQuery({
    queryKey: ['admin', 'proxy', 'overview'],
    queryFn:  () => apiCall<ProxyOverview>({ url: '/admin/proxy/overview' }),
  });

  const subscriptions = useQuery({
    queryKey: ['admin', 'proxy', 'subscriptions', statusFilter, providerFilter],
    queryFn:  () => apiCall<{ items: AdminProxySub[]; meta: { total: number; current_page: number; last_page: number } }>({
      url: '/admin/proxy/subscriptions',
      params: {
        status:   statusFilter   || undefined,
        provider: providerFilter || undefined,
        per_page: 25,
      },
    }),
    enabled: subTab === 'subscriptions',
  });

  const analytics = useQuery({
    queryKey: ['admin', 'proxy', 'analytics'],
    queryFn:  () => apiCall<{
      revenue:  { date: string; total: number }[];
      bandwidth:{ date: string; total_mb: number }[];
      new_subs: { date: string; count: number }[];
    }>({ url: '/admin/proxy/analytics', params: { days: 30 } }),
    enabled: subTab === 'analytics',
  });

  const syncUsage = useMutation({
    mutationFn: (id: string) => apiCall<null>({ method: 'POST', url: `/admin/proxy/subscriptions/${id}/sync-usage` }),
    onSuccess: () => { toast.success('Usage synced.'); qc.invalidateQueries({ queryKey: ['admin', 'proxy'] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const cancelSub = useMutation({
    mutationFn: (id: string) => apiCall<null>({ method: 'POST', url: `/admin/proxy/subscriptions/${id}/cancel` }),
    onSuccess: () => { toast.success('Subscription cancelled.'); qc.invalidateQueries({ queryKey: ['admin', 'proxy'] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const resetCreds = useMutation({
    mutationFn: (id: string) => apiCall<null>({ method: 'POST', url: `/admin/proxy/subscriptions/${id}/reset-creds` }),
    onSuccess: () => toast.success('Credentials reset.'),
    onError: (e) => toast.error((e as Error).message),
  });

  const syncListings = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return apiCall<{ count: number }>({ method: 'POST', url: '/admin/proxy/sync-listings', data: form });
    },
    onSuccess: (r) => { toast.success(`${r.count} proxy listings imported.`); qc.invalidateQueries({ queryKey: ['proxy', 'marketplace'] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const d = overview.data;

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-ink-200">
        {(['overview', 'subscriptions', 'analytics'] as const).map((t) => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition ${
              subTab === t ? 'border-ink-900 text-ink-900' : 'border-transparent text-ink-500 hover:text-ink-700'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* Overview */}
      {subTab === 'overview' && (
        <div className="space-y-4">
          <div className="flex justify-end items-center gap-3">
            <p className="text-xs text-ink-400">Import proxy list from Decodo dashboard (JSON or CSV):</p>
            <label className={`btn-outline text-sm flex items-center gap-2 cursor-pointer ${syncListings.isPending ? 'opacity-50 pointer-events-none' : ''}`}>
              <RotateCcw className={`h-4 w-4 ${syncListings.isPending ? 'animate-spin' : ''}`} />
              {syncListings.isPending ? 'Importing…' : 'Import Proxy Listings'}
              <input
                type="file"
                accept=".json,.csv,.txt"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) syncListings.mutate(file);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard icon={Globe}       label="Total subs"     value={d?.total_subscriptions ?? '…'} />
            <MetricCard icon={Server}      label="Active"         value={d?.active_subscriptions ?? '…'} color="green" />
            <MetricCard icon={AlertTriangle} label="Expired"      value={d?.expired_subscriptions ?? '…'} color="amber" />
            <MetricCard icon={DollarSign}  label="Revenue (USD)"  value={d?.revenue_usd ? `$${d.revenue_usd}` : '…'} />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="card-pad">
              <h3 className="text-sm font-semibold mb-3">By Provider</h3>
              {d?.by_provider && Object.entries(d.by_provider).length > 0
                ? Object.entries(d.by_provider).map(([provider, count]) => (
                    <div key={provider} className="flex justify-between text-sm py-1.5 border-b border-ink-50 last:border-0">
                      <span className="capitalize">{provider}</span>
                      <span className="font-mono font-medium">{count}</span>
                    </div>
                  ))
                : <p className="text-sm text-ink-500">No active subscriptions.</p>
              }
            </div>

            <div className="card-pad">
              <h3 className="text-sm font-semibold mb-3">Provider Health</h3>
              {d?.provider_stats && Object.entries(d.provider_stats).map(([p, stat]) => (
                <div key={p} className="flex justify-between items-center py-1.5 border-b border-ink-50 last:border-0">
                  <div>
                    <span className="text-sm capitalize">{p}</span>
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${stat.enabled ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'}`}>
                      {stat.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  {stat.failures_1h > 0 && (
                    <span className="text-xs text-rose-600">{stat.failures_1h} fail/1h</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="card-pad">
            <h3 className="text-sm font-semibold mb-3">Active by Type</h3>
            {d?.by_type && Object.entries(d.by_type).length > 0 ? (
              <div className="grid sm:grid-cols-2 gap-2">
                {Object.entries(d.by_type).map(([type, count]) => (
                  <div key={type} className="flex justify-between text-sm py-1.5">
                    <span className="text-ink-600 capitalize">{type.replace(/_/g, ' ')}</span>
                    <span className="font-mono font-medium">{count}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-ink-500">No data.</p>}
          </div>
        </div>
      )}

      {/* Subscriptions */}
      {subTab === 'subscriptions' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select className="input" value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)}>
              <option value="">All providers</option>
              <option value="decodo">Decodo</option>
              <option value="brightdata">BrightData</option>
            </select>
            <button onClick={() => qc.invalidateQueries({ queryKey: ['admin', 'proxy', 'subscriptions'] })} className="btn-outline">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-ink-50 border-b border-ink-100">
                  <tr>
                    {['User', 'Type', 'Provider', 'Country', 'Status', 'Bandwidth', 'Expires', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {subscriptions.isLoading ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-ink-500">Loading…</td></tr>
                  ) : (subscriptions.data?.items ?? []).length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-ink-500">No subscriptions found.</td></tr>
                  ) : (subscriptions.data?.items ?? []).map((sub) => (
                    <tr key={sub.id} className="hover:bg-ink-50/50">
                      <td className="px-4 py-3">
                        <div className="text-xs">
                          <div className="font-medium">{sub.user?.name ?? '—'}</div>
                          <div className="text-ink-500">{sub.user?.email ?? '—'}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {sub.proxy_type.replace(/_/g, ' ')}
                        {sub.is_trial && <span className="ml-1 badge-warning">Trial</span>}
                      </td>
                      <td className="px-4 py-3 text-xs capitalize">{sub.provider}</td>
                      <td className="px-4 py-3 text-xs">{sub.location_country}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          sub.status === 'active' ? 'bg-green-100 text-green-700' :
                          sub.status === 'expired' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                        }`}>{sub.status}</span>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono">
                        {sub.bandwidth_gb_total > 0
                          ? `${sub.bandwidth_gb_used.toFixed(2)}/${sub.bandwidth_gb_total} GB`
                          : `—`}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">{formatDate(sub.expires_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => syncUsage.mutate(sub.id)} disabled={syncUsage.isPending}
                            className="btn-ghost text-xs px-2 py-1 text-ink-600">
                            <RefreshCw className="h-3 w-3" /> Sync
                          </button>
                          <button onClick={() => resetCreds.mutate(sub.id)} disabled={resetCreds.isPending}
                            className="btn-ghost text-xs px-2 py-1 text-brand-600">
                            <RotateCcw className="h-3 w-3" /> Creds
                          </button>
                          {sub.status === 'active' && (
                            <button onClick={() => { if (confirm('Cancel this subscription?')) cancelSub.mutate(sub.id); }}
                              disabled={cancelSub.isPending}
                              className="btn-ghost text-xs px-2 py-1 text-rose-600">
                              <Ban className="h-3 w-3" /> Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {subscriptions.data?.meta && (
              <div className="px-4 py-3 border-t border-ink-100 text-xs text-ink-500">
                {subscriptions.data.meta.total} total · Page {subscriptions.data.meta.current_page} of {subscriptions.data.meta.last_page}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analytics */}
      {subTab === 'analytics' && (
        <div className="space-y-4">
          {analytics.isLoading && <p className="text-sm text-ink-500">Loading analytics…</p>}
          {analytics.data && (
            <>
              <div className="card-pad">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-brand-500" /> Revenue (last 30 days)
                </h3>
                {analytics.data.revenue.length === 0 ? (
                  <p className="text-sm text-ink-500">No revenue data.</p>
                ) : (
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {analytics.data.revenue.slice(-14).map((r) => (
                      <div key={r.date} className="flex justify-between text-sm py-1">
                        <span className="text-ink-600">{r.date}</span>
                        <span className="font-mono font-medium">${(r.total / 100).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="card-pad">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-brand-500" /> New Subscriptions
                  </h3>
                  {analytics.data.new_subs.length === 0 ? (
                    <p className="text-sm text-ink-500">No data.</p>
                  ) : (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {analytics.data.new_subs.slice(-7).map((r) => (
                        <div key={r.date} className="flex justify-between text-sm py-1">
                          <span className="text-ink-600">{r.date}</span>
                          <span className="font-mono font-medium">{r.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="card-pad">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-brand-500" /> Bandwidth Synced
                  </h3>
                  {analytics.data.bandwidth.length === 0 ? (
                    <p className="text-sm text-ink-500">No bandwidth data.</p>
                  ) : (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {analytics.data.bandwidth.slice(-7).map((r) => (
                        <div key={r.date} className="flex justify-between text-sm py-1">
                          <span className="text-ink-600">{r.date}</span>
                          <span className="font-mono font-medium">{(r.total_mb / 1024).toFixed(2)} GB</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── API Keys Tab ─────────────────────────────────────────────────────────────

type ApiKeyEntry = {
  group: string; key: string; label: string; is_secret: boolean;
  has_value: boolean; preview: string | null; updated_at: string | null;
};

const SERVICE_GROUPS = [
  { id: 'fivesim',     label: '5sim',         icon: '📱', color: 'bg-violet-50 border-violet-200 dark:bg-violet-900/20 dark:border-violet-800' },
  { id: 'smsactivate', label: 'SMS Activate', icon: '💬', color: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' },
  { id: 'smsman',      label: 'SMS Man',      icon: '📨', color: 'bg-cyan-50 border-cyan-200 dark:bg-cyan-900/20 dark:border-cyan-800' },
  { id: 'smspool',     label: 'SMSPool',      icon: '🌊', color: 'bg-teal-50 border-teal-200 dark:bg-teal-900/20 dark:border-teal-800' },
  { id: 'pvadeals',   label: 'PVADeals',     icon: '🏷️', color: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800' },
  { id: 'flutterwave', label: 'Flutterwave',  icon: '💳', color: 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800' },
  { id: 'nowpayments', label: 'NOWPayments',  icon: '₿',  color: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800' },
  { id: 'reloadly',    label: 'Reloadly',     icon: '🎁', color: 'bg-pink-50 border-pink-200 dark:bg-pink-900/20 dark:border-pink-800' },
  { id: 'decodo',       label: 'Decodo Proxy',  icon: '🔒', color: 'bg-slate-50 border-slate-200 dark:bg-slate-900/20 dark:border-slate-700' },
  { id: 'textverified', label: 'TextVerified',  icon: '✅', color: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' },
];

function ApiKeysTab() {
  const qc = useQueryClient();
  const [showVal, setShowVal]           = useState<Record<string, boolean>>({});
  const [editVal, setEditVal]           = useState<Record<string, string>>({});
  const [saving, setSaving]             = useState<Record<string, boolean>>({});
  const [removing, setRemoving]         = useState<Record<string, boolean>>({});
  const [customGroup, setCustomGroup]   = useState('');
  const [customKey, setCustomKey]       = useState('');
  const [customValue, setCustomValue]   = useState('');
  const [addingCustom, setAddingCustom] = useState(false);

  const { data: keys = [], isLoading } = useQuery<ApiKeyEntry[]>({
    queryKey: ['admin-api-keys'],
    queryFn: () => apiCall<ApiKeyEntry[]>({ method: 'GET', url: '/admin/api-keys' }),
    staleTime: 30_000,
  });

  const eid = (e: ApiKeyEntry) => `${e.group}.${e.key}`;

  async function saveKey(entry: ApiKeyEntry) {
    const id = eid(entry), val = editVal[id]?.trim();
    if (!val) return;
    setSaving(s => ({ ...s, [id]: true }));
    try {
      await apiCall({ method: 'POST', url: '/admin/api-keys', data: { group: entry.group, key: entry.key, value: val } });
      toast.success(`${entry.label} saved.`);
      setEditVal(v => { const n = { ...v }; delete n[id]; return n; });
      qc.invalidateQueries({ queryKey: ['admin-api-keys'] });
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(s => ({ ...s, [id]: false })); }
  }

  async function removeKey(entry: ApiKeyEntry) {
    const id = eid(entry);
    setRemoving(r => ({ ...r, [id]: true }));
    try {
      await apiCall({ method: 'DELETE', url: '/admin/api-keys', data: { group: entry.group, key: entry.key } });
      toast.success(`${entry.label} removed.`);
      qc.invalidateQueries({ queryKey: ['admin-api-keys'] });
    } catch (e) { toast.error((e as Error).message); }
    finally { setRemoving(r => ({ ...r, [id]: false })); }
  }

  async function saveCustom() {
    if (!customGroup.trim() || !customKey.trim() || !customValue.trim()) { toast.error('Fill in all fields.'); return; }
    setAddingCustom(true);
    try {
      await apiCall({ method: 'POST', url: '/admin/api-keys', data: {
        group: customGroup.trim().toLowerCase(), key: customKey.trim().toLowerCase(), value: customValue.trim(),
      }});
      toast.success('Key saved.');
      setCustomGroup(''); setCustomKey(''); setCustomValue('');
      qc.invalidateQueries({ queryKey: ['admin-api-keys'] });
    } catch (e) { toast.error((e as Error).message); }
    finally { setAddingCustom(false); }
  }

  const byGroup = (g: string) => keys.filter(k => k.group === g);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-lg font-semibold dark:text-white flex items-center gap-2">
          <Key className="h-5 w-5 text-ink-500" /> API Keys
        </h2>
        <p className="text-sm text-ink-500 mt-0.5">
          Keys saved here override <code className="text-xs bg-ink-100 dark:bg-ink-700 px-1 rounded">.env</code> at runtime. Values are encrypted at rest.
        </p>
      </div>

      {isLoading ? (
        <div className="text-sm text-ink-400 py-8 text-center">Loading…</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {SERVICE_GROUPS.map(group => {
            const entries = byGroup(group.id);
            if (!entries.length) return null;
            return (
              <div key={group.id} className={`rounded-xl border p-4 space-y-3 ${group.color}`}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{group.icon}</span>
                  <span className="font-semibold text-sm dark:text-white">{group.label}</span>
                  <span className="ml-auto text-xs text-ink-400">
                    {entries.filter(e => e.has_value).length}/{entries.length} set
                  </span>
                </div>
                <div className="space-y-2">
                  {entries.map(entry => {
                    const id = eid(entry), editing = id in editVal, shown = showVal[id];
                    return (
                      <div key={id} className="bg-white dark:bg-ink-800 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {entry.has_value
                              ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              : <div className="h-3.5 w-3.5 rounded-full border-2 border-ink-300 shrink-0" />}
                            <span className="text-xs font-medium text-ink-700 dark:text-ink-300 truncate">{entry.label}</span>
                          </div>
                          {entry.has_value && !editing && (
                            <button onClick={() => removeKey(entry)} disabled={removing[id]}
                              className="p-1 text-ink-400 hover:text-red-500 transition shrink-0">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        {entry.has_value && !editing && (
                          <div className="flex items-center gap-2">
                            <code className="flex-1 text-xs bg-ink-50 dark:bg-ink-700 rounded px-2 py-1 truncate text-ink-600 dark:text-ink-300">
                              {shown || !entry.is_secret ? entry.preview : '••••••••••••'}
                            </code>
                            {entry.is_secret && (
                              <button onClick={() => setShowVal(v => ({ ...v, [id]: !v[id] }))}
                                className="text-ink-400 hover:text-ink-600 shrink-0">
                                {shown ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </button>
                            )}
                            <button onClick={() => setEditVal(v => ({ ...v, [id]: '' }))}
                              className="text-xs text-brand-600 hover:text-brand-700 font-medium shrink-0">
                              Update
                            </button>
                          </div>
                        )}

                        {(!entry.has_value || editing) && (
                          <div className="flex gap-2 flex-wrap">
                            <input type={entry.is_secret ? 'password' : 'text'}
                              placeholder={`Enter ${entry.label}`}
                              value={editVal[id] ?? ''}
                              onChange={e => setEditVal(v => ({ ...v, [id]: e.target.value }))}
                              className="flex-1 input text-xs py-1.5 min-w-0" autoComplete="off" />
                            <button onClick={() => saveKey(entry)}
                              disabled={saving[id] || !editVal[id]?.trim()}
                              className="btn-primary text-xs px-3 py-1.5 shrink-0">
                              {saving[id] ? '…' : 'Save'}
                            </button>
                            {editing && (
                              <button onClick={() => setEditVal(v => { const n = { ...v }; delete n[id]; return n; })}
                                className="text-xs text-ink-400 hover:text-ink-600 shrink-0">Cancel</button>
                            )}
                          </div>
                        )}

                        {entry.updated_at && (
                          <p className="text-[10px] text-ink-400">Updated {formatDate(entry.updated_at)}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add credentials for a new / future service provider */}
      <div className="rounded-xl border border-dashed border-ink-300 dark:border-ink-600 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-ink-400" />
          <span className="font-semibold text-sm dark:text-white">Add new service / future provider</span>
        </div>
        <p className="text-xs text-ink-500 leading-relaxed">
          Add credentials for any new provider you integrate later. The <strong>Service ID</strong> maps to
          the Laravel config group (e.g. <code className="bg-ink-100 dark:bg-ink-700 px-1 rounded">airalo</code>),
          and <strong>Key name</strong> to the config key (e.g.{' '}
          <code className="bg-ink-100 dark:bg-ink-700 px-1 rounded">api_key</code>). Stored encrypted, applied at runtime.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label text-xs">Service ID</label>
            <input value={customGroup} onChange={e => setCustomGroup(e.target.value)}
              placeholder="e.g. airalo" className="input text-sm" autoComplete="off" />
          </div>
          <div>
            <label className="label text-xs">Key name</label>
            <input value={customKey} onChange={e => setCustomKey(e.target.value)}
              placeholder="e.g. api_key" className="input text-sm" autoComplete="off" />
          </div>
          <div className="sm:col-span-2">
            <label className="label text-xs">Value</label>
            <input type="password" value={customValue} onChange={e => setCustomValue(e.target.value)}
              placeholder="Enter the key value" className="input text-sm" autoComplete="new-password" />
          </div>
        </div>
        <button onClick={saveCustom}
          disabled={addingCustom || !customGroup.trim() || !customKey.trim() || !customValue.trim()}
          className="btn-primary text-sm px-4 py-2">
          {addingCustom ? 'Saving…' : 'Save key'}
        </button>
      </div>
    </div>
  );
}
