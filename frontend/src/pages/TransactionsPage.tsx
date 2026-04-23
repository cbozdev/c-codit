import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiCall } from '@/lib/api';
import { formatMoney, formatDate } from '@/lib/format';
import type { Paginated, Transaction } from '@/types/api';
import { StatusBadge } from '@/components/StatusBadge';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function TransactionsPage() {
  const [page, setPage] = useState(1);
  const [type, setType] = useState<string>('');
  const [status, setStatus] = useState<string>('');

  const q = useQuery({
    queryKey: ['transactions', { page, type, status }],
    queryFn: () => apiCall<Paginated<Transaction>>({
      url: '/wallet/transactions',
      params: { page, per_page: 20, type: type || undefined, status: status || undefined },
    }),
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
        <p className="text-sm text-ink-600 mt-1">Every credit and debit, fully traceable.</p>
      </div>

      <div className="card-pad">
        <div className="flex flex-wrap gap-3 mb-4">
          <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="input max-w-xs">
            <option value="">All types</option>
            <option value="wallet_funding">Funding</option>
            <option value="service_purchase">Service purchase</option>
            <option value="refund">Refund</option>
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="input max-w-xs">
            <option value="">All statuses</option>
            <option value="success">Success</option>
            <option value="processing">Processing</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>

        {q.isLoading ? (
          <div className="text-sm text-ink-500 py-8 text-center">Loading…</div>
        ) : q.data?.items.length === 0 ? (
          <div className="text-sm text-ink-500 py-8 text-center">No transactions match your filters.</div>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-ink-500 text-xs uppercase tracking-wide border-b border-ink-100">
                  <th className="px-2 py-3 font-medium">Reference</th>
                  <th className="px-2 py-3 font-medium">Type</th>
                  <th className="px-2 py-3 font-medium">Amount</th>
                  <th className="px-2 py-3 font-medium">Status</th>
                  <th className="px-2 py-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {q.data!.items.map((tx) => {
                  const isCredit = tx.type === 'wallet_funding' || tx.type === 'refund';
                  return (
                    <tr key={tx.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50/50">
                      <td className="px-2 py-3">
                        <div className="font-mono text-xs">{tx.reference}</div>
                        {tx.description && <div className="text-xs text-ink-500 mt-0.5">{tx.description}</div>}
                      </td>
                      <td className="px-2 py-3 text-ink-600">{tx.type.replace('_', ' ')}</td>
                      <td className="px-2 py-3 font-mono">
                        <span className={isCredit ? 'text-brand-700' : 'text-ink-900'}>
                          {isCredit ? '+' : '−'}{formatMoney(tx.amount_minor, tx.currency)}
                        </span>
                      </td>
                      <td className="px-2 py-3"><StatusBadge status={tx.status} /></td>
                      <td className="px-2 py-3 text-ink-600">{formatDate(tx.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {q.data && q.data.meta.last_page > 1 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-ink-500">
              Page {q.data.meta.current_page} of {q.data.meta.last_page} · {q.data.meta.total} total
            </span>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="btn-outline px-2 py-1.5"><ChevronLeft className="h-4 w-4" /></button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= q.data.meta.last_page}
                className="btn-outline px-2 py-1.5"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
