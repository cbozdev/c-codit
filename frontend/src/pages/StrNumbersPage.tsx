import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiCall } from '@/lib/api';
import type { Paginated, ServiceOrder } from '@/types/api';
import { Phone, CheckCircle2, Copy, ExternalLink, RefreshCw, XCircle } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate, formatMoney } from '@/lib/format';
import { clsx } from 'clsx';

const VN_PROVIDERS = ['pvadeals', '5sim', 'smsactivate', 'smsman', 'smspool', 'textverified', 'textverified_rental'];

const SERVICE_ICONS: Record<string, string> = {
  whatsapp: '💬', facebook: '🔵', google: '🔴', telegram: '✈️', twitter: '🐦',
  instagram: '📸', tiktok: '🎵', snapchat: '👻', discord: '🎮', uber: '🚗',
  netflix: '🎬', amazon: '📦', paypal: '💳', apple: '🍎', microsoft: '🪟',
  binance: '🟡', coinbase: '🟠', viber: '📞', line: '💚', wechat: '💚',
  linkedin: '💼', pinterest: '📌', reddit: '🤖', spotify: '🎵',
};

function getServiceIcon(name?: string): string {
  if (!name) return '📱';
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(SERVICE_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return '📱';
}

export default function StrNumbersPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const orders = useQuery({
    queryKey: ['orders', 'str'],
    queryFn: () => apiCall<Paginated<ServiceOrder>>({ url: '/orders', params: { per_page: 100 } }),
  });

  const strOrders = (orders.data?.items ?? []).filter((o) => {
    const d = o.delivery as Record<string, unknown> | null;
    const isVn = VN_PROVIDERS.includes(o.service?.provider ?? '') ||
      o.service?.category === 'virtual_number';
    const isNotLtr = (d?.number_type as string | null) !== 'LTR';
    return isVn && isNotLtr;
  });

  const filtered = statusFilter === 'all'
    ? strOrders
    : strOrders.filter((o) => o.status === statusFilter);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight dark:text-white">STR Numbers</h1>
          <p className="text-sm text-ink-600 dark:text-ink-400 mt-1">
            Your short-term rental numbers — one-time SMS verifications.
          </p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-700 dark:text-ink-300 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="all">All statuses</option>
          <option value="completed">Completed</option>
          <option value="refunded">Refunded</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      <div className="card-pad dark:bg-ink-900 overflow-x-auto">
        {orders.isLoading ? (
          <div className="text-sm text-ink-500 py-8 text-center">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-ink-500 dark:text-ink-400 py-10 text-center">
            {strOrders.length === 0
              ? <>No STR numbers yet. <a href="/services" className="text-brand-600 hover:underline">Buy one on the Services page →</a></>
              : 'No orders match this filter.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-500 dark:text-ink-400 border-b border-ink-100 dark:border-ink-800">
                <th className="pb-2 pr-4 font-medium">Service</th>
                <th className="pb-2 pr-4 font-medium">Number</th>
                <th className="pb-2 pr-4 font-medium">Code</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium">Date</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {filtered.map((o) => <StrRow key={o.id} order={o} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StrRow({ order }: { order: ServiceOrder }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);

  const delivery    = order.delivery as Record<string, unknown> | null;
  const request     = order.request  as Record<string, unknown> | null;
  const phoneNumber = delivery?.phone_number as string | null;
  const smsCode     = delivery?.sms_code as string | null;
  const serviceName = (request?.service as string | null) ?? order.service?.name ?? '';
  const country     = (request?.country as string | null) ?? '';

  const canCancel = !smsCode && order.status !== 'refunded' && order.status !== 'pending';
  const canCheck  = !smsCode && order.status === 'completed';

  const cancelMut = useMutation({
    mutationFn: () => apiCall({ url: `/orders/${order.id}/cancel`, method: 'POST' }),
    onSuccess: () => { toast.success('Order cancelled and refunded.'); qc.invalidateQueries({ queryKey: ['orders', 'str'] }); },
    onError: (e) => toast.error((e as Error).message ?? 'Could not cancel.'),
  });

  const checkMut = useMutation({
    mutationFn: () => apiCall<{ code: string | null }>({ url: `/orders/${order.id}/fetch-code`, method: 'POST' }),
    onSuccess: (d) => {
      if (d.code) { toast.success('Code: ' + d.code); qc.invalidateQueries({ queryKey: ['orders', 'str'] }); }
      else toast('No code yet — try again in a moment.');
    },
    onError: (e) => toast.error((e as Error).message ?? 'Could not check.'),
  });

  return (
    <tr className="group">
      {/* Service */}
      <td className="py-3 pr-4">
        <button
          onClick={() => navigate(`/orders/${order.id}`)}
          className="flex items-center gap-2 hover:text-brand-600 transition text-left"
        >
          <span className="text-xl leading-none">{getServiceIcon(serviceName)}</span>
          <div className="min-w-0">
            <div className="font-medium dark:text-white capitalize truncate max-w-[110px]">{serviceName || order.service?.name}</div>
            {country && <div className="text-xs text-ink-400 uppercase">{country}</div>}
          </div>
          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-40 shrink-0" />
        </button>
      </td>

      {/* Number */}
      <td className="py-3 pr-4">
        {phoneNumber ? (
          <div className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 text-ink-400 shrink-0" />
            <span className="font-mono text-sm dark:text-white">{phoneNumber}</span>
            <button
              onClick={() => { navigator.clipboard.writeText(phoneNumber); setCopied(true); toast.success('Copied!'); setTimeout(() => setCopied(false), 2000); }}
              className={clsx('p-0.5 rounded transition', copied ? 'text-brand-600' : 'text-ink-300 hover:text-ink-600')}
            >
              {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        ) : (
          <span className="text-ink-400">—</span>
        )}
      </td>

      {/* Code */}
      <td className="py-3 pr-4">
        {smsCode ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-50 dark:bg-brand-950/30 rounded border border-brand-200 dark:border-brand-900 font-mono font-bold text-brand-700 dark:text-brand-300 text-sm tracking-widest">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            {smsCode}
          </span>
        ) : (
          <span className="text-ink-400 text-xs">waiting…</span>
        )}
      </td>

      {/* Status */}
      <td className="py-3 pr-4">
        <StatusBadge status={order.status} />
      </td>

      {/* Date */}
      <td className="py-3 pr-4 text-xs text-ink-500 dark:text-ink-400 whitespace-nowrap">
        {formatDate(order.created_at)}
        <div className="text-ink-400">{formatMoney(order.amount_minor, order.currency)}</div>
      </td>

      {/* Actions */}
      <td className="py-3">
        <div className="flex items-center gap-2">
          {canCheck && (
            <button
              onClick={() => checkMut.mutate()}
              disabled={checkMut.isPending}
              title="Check for code"
              className="p-1.5 rounded-lg text-ink-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/30 disabled:opacity-40 transition"
            >
              <RefreshCw className={clsx('h-4 w-4', checkMut.isPending && 'animate-spin')} />
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => { if (confirm('Cancel this order and refund your wallet?')) cancelMut.mutate(); }}
              disabled={cancelMut.isPending}
              title="Cancel & refund"
              className="p-1.5 rounded-lg text-ink-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-40 transition"
            >
              <XCircle className={clsx('h-4 w-4', cancelMut.isPending && 'animate-spin')} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
