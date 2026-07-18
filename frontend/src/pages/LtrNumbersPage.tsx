import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiCall } from '@/lib/api';
import type { Paginated, ServiceOrder } from '@/types/api';
import {
  Phone, Clock, RefreshCw, Copy, CheckCircle2, ExternalLink,
  Flag, Plus, ShoppingCart,
} from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate, formatMoney } from '@/lib/format';
import { clsx } from 'clsx';

export default function LtrNumbersPage() {
  const orders = useQuery({
    queryKey: ['orders', 'ltr'],
    queryFn: () => apiCall<Paginated<ServiceOrder>>({ url: '/orders', params: { per_page: 50 } }),
  });

  const ltrOrders = (orders.data?.items ?? []).filter((o) => {
    const d = o.delivery as Record<string, unknown> | null;
    return o.service?.provider === 'pvadeals' && d?.number_type === 'LTR';
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight dark:text-white">LTR Numbers</h1>
        <p className="text-sm text-ink-600 dark:text-ink-400 mt-1">
          Your long-term rental phone numbers from PVADeals.
        </p>
      </div>

      <div className="card-pad dark:bg-ink-900">
        {orders.isLoading ? (
          <div className="text-sm text-ink-500 py-8 text-center">Loading…</div>
        ) : ltrOrders.length === 0 ? (
          <div className="text-sm text-ink-500 dark:text-ink-400 py-10 text-center">
            No LTR numbers yet.{' '}
            <a href="/services" className="text-brand-600 hover:underline">Buy one on the Services page →</a>
          </div>
        ) : (
          <ul className="divide-y divide-ink-100 dark:divide-ink-800">
            {ltrOrders.map((o) => <LtrRow key={o.id} order={o} />)}
          </ul>
        )}
      </div>
    </div>
  );
}

function LtrRow({ order }: { order: ServiceOrder }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);

  const delivery    = order.delivery as Record<string, unknown> | null;
  const req         = order.request  as Record<string, unknown> | null;
  const phoneNumber = delivery?.phone_number as string | null;
  const smsCode     = delivery?.sms_code     as string | null;
  const expiresAt   = delivery?.expires_at   as string | null;
  const duration    = delivery?.duration     as number | null;
  const autoRenew   = !!(delivery?.auto_renew_enable);
  const allowReuse  = !!(delivery?.allow_reuse);
  const allowFlag   = !!(delivery?.allow_flag);
  const isActive    = order.status === 'completed';

  // Original purchase params for "New number" re-purchase
  const origService  = req?.service  as string | null;
  const origCountry  = req?.country  as string | null;
  const origDuration = (req?.duration as number | null) ?? duration ?? 3;

  const reuseMut = useMutation({
    mutationFn: () => apiCall({ url: `/orders/${order.id}/reuse`, method: 'POST' }),
    onSuccess: () => {
      toast.success('Number reused — waiting for new SMS.');
      qc.invalidateQueries({ queryKey: ['orders', 'ltr'] });
    },
    onError: (e) => toast.error((e as Error).message ?? 'Could not reuse number.'),
  });

  const autoRenewMut = useMutation({
    mutationFn: () => apiCall<{ auto_renew_enable: boolean }>({ url: `/orders/${order.id}/toggle-auto-renew`, method: 'POST' }),
    onSuccess: (d) => {
      toast.success(d.auto_renew_enable ? 'Auto-renew enabled.' : 'Auto-renew disabled.');
      qc.invalidateQueries({ queryKey: ['orders', 'ltr'] });
    },
    onError: (e) => toast.error((e as Error).message ?? 'Could not toggle auto-renew.'),
  });

  const cancelMut = useMutation({
    mutationFn: () => apiCall({ url: `/orders/${order.id}/cancel`, method: 'POST' }),
    onSuccess: () => {
      toast.success('Number flagged and wallet refunded.');
      qc.invalidateQueries({ queryKey: ['orders', 'ltr'] });
    },
    onError: (e) => toast.error((e as Error).message ?? 'Could not flag number.'),
  });

  const buyNewMut = useMutation({
    mutationFn: (payload: { service_code: string; service: string; duration: number; country: string }) =>
      apiCall<ServiceOrder>({ url: '/services/virtual-number/purchase-ltr', method: 'POST', data: payload }),
    onSuccess: (newOrder) => {
      toast.success('New LTR number purchased!');
      setShowBuyModal(false);
      qc.invalidateQueries({ queryKey: ['orders', 'ltr'] });
      navigate(`/orders/${newOrder.id}`);
    },
    onError: (e) => toast.error((e as Error).message ?? 'Purchase failed.'),
  });

  return (
    <li className="py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* Service name + status + duration badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => navigate(`/orders/${order.id}`)}
              className="font-medium text-sm dark:text-white hover:text-brand-600 transition flex items-center gap-1"
            >
              {order.service?.name ?? 'PVADeals LTR'}
              <ExternalLink className="h-3 w-3 opacity-50" />
            </button>
            <StatusBadge status={order.status} />
            {duration && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-ink-100 dark:bg-ink-700 text-ink-600 dark:text-ink-300">
                {duration}d LTR
              </span>
            )}
            {origCountry && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-ink-100 dark:bg-ink-700 text-ink-500 dark:text-ink-400 uppercase">
                {origCountry}
              </span>
            )}
          </div>

          {/* Phone number */}
          {phoneNumber && (
            <div className="mt-2 flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-ink-400 shrink-0" />
              <span className="font-mono text-base font-semibold dark:text-white">{phoneNumber}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(phoneNumber);
                  setCopied(true);
                  toast.success('Copied!');
                  setTimeout(() => setCopied(false), 2000);
                }}
                className={clsx('p-1 rounded transition', copied ? 'text-brand-600' : 'text-ink-400 hover:text-ink-700')}
              >
                {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          )}

          {/* SMS code */}
          {smsCode && (
            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-brand-50 dark:bg-brand-950/30 rounded-lg border border-brand-200 dark:border-brand-900">
              <CheckCircle2 className="h-4 w-4 text-brand-600 shrink-0" />
              <span className="font-mono font-bold text-brand-700 dark:text-brand-300 text-lg tracking-widest">{smsCode}</span>
            </div>
          )}

          {/* Expiry */}
          {expiresAt && (
            <div className="mt-2 flex items-center gap-1 text-xs text-ink-500 dark:text-ink-400">
              <Clock className="h-3 w-3" />
              Expires {formatDate(expiresAt)}
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-3 flex items-center gap-1 flex-wrap">
            {/* Auto-renew toggle */}
            {isActive && (
              <button
                onClick={() => autoRenewMut.mutate()}
                disabled={autoRenewMut.isPending}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-400 hover:border-brand-400 hover:text-brand-600 disabled:opacity-40 transition"
              >
                <span className={clsx('inline-flex w-6 h-3.5 rounded-full transition-colors shrink-0', autoRenew ? 'bg-brand-500' : 'bg-ink-300 dark:bg-ink-600')}>
                  <span className={clsx('inline-block w-2.5 h-2.5 m-0.5 rounded-full bg-white transition-transform', autoRenew ? 'translate-x-2.5' : 'translate-x-0')} />
                </span>
                Auto-renew {autoRenew ? 'on' : 'off'}
              </button>
            )}

            {/* Reuse number */}
            {isActive && allowReuse && (
              <button
                onClick={() => reuseMut.mutate()}
                disabled={reuseMut.isPending}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-400 hover:border-brand-400 hover:text-brand-600 disabled:opacity-40 transition"
              >
                <RefreshCw className={clsx('h-3.5 w-3.5', reuseMut.isPending && 'animate-spin')} />
                {reuseMut.isPending ? 'Reusing…' : 'Reuse number'}
              </button>
            )}


            {/* Flag number (cancel early) — only when allow_flag=true */}
            {isActive && allowFlag && (
              <button
                onClick={() => {
                  if (confirm('Flag this number and refund your wallet?')) cancelMut.mutate();
                }}
                disabled={cancelMut.isPending}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-40 transition"
              >
                <Flag className={clsx('h-3.5 w-3.5', cancelMut.isPending && 'animate-spin')} />
                {cancelMut.isPending ? 'Flagging…' : 'Flag number'}
              </button>
            )}

            {/* New number — buy same service/country again */}
            {origService && origCountry && (
              <button
                onClick={() => setShowBuyModal(true)}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-brand-200 dark:border-brand-900 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/30 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                New number
              </button>
            )}
          </div>
        </div>

        {/* Amount + date */}
        <div className="text-right shrink-0">
          <div className="font-mono font-medium text-sm dark:text-white">
            {formatMoney(order.amount_minor, order.currency)}
          </div>
          <div className="text-xs text-ink-400 mt-0.5">{formatDate(order.created_at)}</div>
        </div>
      </div>

      {/* New number confirmation modal */}
      {showBuyModal && origService && origCountry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-ink-900 rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-lg dark:text-white flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-brand-600" />
              Buy new number
            </h3>
            <p className="text-sm text-ink-500 mt-2">
              Purchase a new <strong className="capitalize dark:text-ink-200">{origService}</strong> LTR number
              in <strong className="dark:text-ink-200">{origCountry}</strong> for{' '}
              <strong className="dark:text-ink-200">{origDuration} days</strong>.
              A different number will be assigned.
            </p>
            <div className="mt-5 flex gap-2 justify-end">
              <button
                onClick={() => setShowBuyModal(false)}
                className="btn-outline"
                disabled={buyNewMut.isPending}
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  buyNewMut.mutate({
                    service_code: order.service?.code ?? '',
                    service:      origService,
                    duration:     origDuration,
                    country:      origCountry,
                  })
                }
                disabled={buyNewMut.isPending}
                className="btn-primary flex items-center gap-2"
              >
                <ShoppingCart className="h-4 w-4" />
                {buyNewMut.isPending ? 'Purchasing…' : 'Confirm purchase'}
              </button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}
