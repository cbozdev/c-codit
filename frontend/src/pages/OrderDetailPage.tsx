import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Copy, ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiCall } from '@/lib/api';
import { formatMoney, formatDate } from '@/lib/format';
import { StatusBadge } from '@/components/StatusBadge';
import type { ServiceOrder } from '@/types/api';

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const order = useQuery({
    queryKey: ['order', id],
    queryFn: () => apiCall<ServiceOrder>({ method: 'GET', url: `/orders/${id}` }),
    refetchInterval: (q) => (q.state.data?.status === 'provisioning' ? 5_000 : false),
    enabled: !!id,
  });

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => toast.success('Copied'));
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Link to="/services" className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900">
        <ChevronLeft className="h-4 w-4" /> Back to services
      </Link>

      <div className="card-pad">
        {order.isLoading && <p className="text-ink-500">Loading…</p>}
        {order.data && (
          <>
            <header className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold text-ink-900">
                  {order.data.service?.name ?? 'Order'}
                </h1>
                <p className="text-xs text-ink-500 font-mono mt-1">{order.data.id}</p>
              </div>
              <StatusBadge status={order.data.status} />
            </header>

            <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-ink-500">Amount</dt>
                <dd className="font-mono text-ink-900 mt-0.5">{formatMoney(order.data.amount_minor, order.data.currency)}</dd>
              </div>
              <div>
                <dt className="text-ink-500">Created</dt>
                <dd className="text-ink-900 mt-0.5">{formatDate(order.data.created_at)}</dd>
              </div>
              {order.data.provisioned_at && (
                <div>
                  <dt className="text-ink-500">Delivered</dt>
                  <dd className="text-ink-900 mt-0.5">{formatDate(order.data.provisioned_at)}</dd>
                </div>
              )}
              {order.data.refunded_at && (
                <div>
                  <dt className="text-ink-500">Refunded</dt>
                  <dd className="text-ink-900 mt-0.5">{formatDate(order.data.refunded_at)}</dd>
                </div>
              )}
            </dl>

            {order.data.delivery?.phone_number && (
              <div className="mt-6 rounded-xl bg-brand-50 border border-brand-100 p-4">
                <p className="text-xs uppercase tracking-wider text-brand-700">Your number</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-2xl font-bold text-ink-900 font-mono">
                    {order.data.delivery.phone_number}
                  </span>
                  <button
                    onClick={() => copy(order.data!.delivery!.phone_number!)}
                    className="btn-outline text-xs"
                  >
                    <Copy className="h-3 w-3" /> Copy
                  </button>
                </div>
                {order.data.delivery.expires_at && (
                  <p className="mt-2 text-xs text-ink-600">
                    Expires {formatDate(order.data.delivery.expires_at)}
                  </p>
                )}
              </div>
            )}

            {order.data.failure_reason && (
              <div className="mt-6 rounded-xl bg-rose-50 border border-rose-100 p-4 text-sm text-rose-800">
                <p className="font-medium">Order failed</p>
                <p className="mt-1">{order.data.failure_reason}</p>
                <p className="mt-2 text-xs text-rose-700">Your wallet has been automatically refunded.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
