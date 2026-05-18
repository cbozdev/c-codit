import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiCall } from '@/lib/api';
import { formatMoney, formatDate } from '@/lib/format';
import type { Paginated, Transaction } from '@/types/api';
import { StatusBadge } from '@/components/StatusBadge';
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react';

function printReceipt(tx: Transaction) {
  const isCredit = tx.type === 'wallet_funding' || tx.type === 'refund';
  const win = window.open('', '_blank', 'width=420,height=620');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8">
<title>Receipt · ${tx.reference}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; padding: 32px 24px; max-width: 340px; margin: 0 auto; color: #111; }
  h1 { font-size: 18px; text-align: center; margin-bottom: 4px; font-family: sans-serif; }
  .sub { text-align: center; font-size: 12px; color: #666; margin-bottom: 20px; font-family: sans-serif; }
  .divider { border-top: 1px dashed #ccc; margin: 14px 0; }
  .row { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; padding: 3px 0; }
  .label { color: #555; }
  .val { text-align: right; word-break: break-all; max-width: 60%; }
  .amount-row { font-size: 20px; font-weight: bold; padding: 8px 0; }
  .credit { color: #16a34a; }
  .debit { color: #111; }
  .footer { text-align: center; font-size: 11px; color: #999; margin-top: 20px; font-family: sans-serif; }
  @media print { body { padding: 16px; } }
</style>
</head><body>
<h1>C-codit</h1>
<p class="sub">Transaction Receipt</p>
<div class="divider"></div>
<div class="row"><span class="label">Reference</span><span class="val">${tx.reference}</span></div>
<div class="row"><span class="label">Type</span><span class="val">${tx.type.replace(/_/g, ' ')}</span></div>
<div class="row"><span class="label">Status</span><span class="val">${tx.status}</span></div>
<div class="row"><span class="label">Date</span><span class="val">${formatDate(tx.created_at)}</span></div>
${tx.description ? `<div class="row"><span class="label">Note</span><span class="val">${tx.description}</span></div>` : ''}
<div class="divider"></div>
<div class="row amount-row ${isCredit ? 'credit' : 'debit'}">
  <span>${isCredit ? 'Credited' : 'Debited'}</span>
  <span>${isCredit ? '+' : '−'}${formatMoney(tx.amount_minor, tx.currency)}</span>
</div>
<div class="divider"></div>
<p class="footer">Thank you for using C-codit<br>support@c-codit.com</p>
<script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }<\/script>
</body></html>`);
  win.document.close();
}

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
                  <th className="px-2 py-3 font-medium"></th>
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
                      <td className="px-2 py-3">
                        <button onClick={() => printReceipt(tx)} title="Print receipt"
                          className="p-1.5 text-ink-400 hover:text-ink-700 transition rounded">
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                      </td>
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
