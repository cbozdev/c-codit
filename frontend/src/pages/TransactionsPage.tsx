import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiCall } from '@/lib/api';
import { formatMoney, formatDate, relativeTime } from '@/lib/format';
import type { Paginated, Transaction } from '@/types/api';
import { StatusBadge } from '@/components/StatusBadge';
import {
  ChevronLeft, ChevronRight, Printer, ArrowDownToLine,
  ShoppingBag, RefreshCw, TrendingUp, ListOrdered,
  SlidersHorizontal,
} from 'lucide-react';
import { clsx } from 'clsx';

const TX_ICON: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  wallet_funding:   { icon: ArrowDownToLine, color: 'text-brand-600',   bg: 'bg-brand-50 dark:bg-brand-900/30' },
  service_purchase: { icon: ShoppingBag,     color: 'text-violet-600',  bg: 'bg-violet-50 dark:bg-violet-900/30' },
  refund:           { icon: RefreshCw,       color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
  adjustment:       { icon: TrendingUp,      color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-900/30' },
};

const TYPE_LABELS: Record<string, string> = {
  wallet_funding:   'Funding',
  service_purchase: 'Purchase',
  refund:           'Refund',
  adjustment:       'Adjustment',
};

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

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'wallet_funding',   label: 'Funding' },
  { value: 'service_purchase', label: 'Purchase' },
  { value: 'refund',           label: 'Refund' },
  { value: 'adjustment',       label: 'Adjustment' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'success',    label: 'Success' },
  { value: 'processing', label: 'Processing' },
  { value: 'failed',     label: 'Failed' },
  { value: 'refunded',   label: 'Refunded' },
];

export default function TransactionsPage() {
  const [page, setPage]     = useState(1);
  const [type, setType]     = useState('');
  const [status, setStatus] = useState('');

  const q = useQuery({
    queryKey: ['transactions', { page, type, status }],
    queryFn: () => apiCall<Paginated<Transaction>>({
      url: '/wallet/transactions',
      params: { page, per_page: 20, type: type || undefined, status: status || undefined },
    }),
  });

  const hasFilters = type || status;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-white">Transactions</h1>
        <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">Every credit and debit on your account.</p>
      </div>

      {/* Card */}
      <div className="rounded-xl border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 overflow-hidden">

        {/* Filters bar */}
        <div className="flex flex-wrap items-center gap-2 px-5 py-4 border-b border-ink-100 dark:border-ink-800">
          <SlidersHorizontal className="h-4 w-4 text-ink-400 shrink-0" />
          <div className="flex flex-wrap gap-2 flex-1">
            {TYPE_OPTIONS.map(({ value, label }) => (
              <button key={value} onClick={() => { setType(value); setPage(1); }}
                className={clsx(
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition',
                  type === value
                    ? 'bg-ink-900 dark:bg-white text-white dark:text-ink-900 border-ink-900 dark:border-white'
                    : 'border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300 hover:border-ink-400 dark:hover:border-ink-500',
                )}>
                {label}
              </button>
            ))}
          </div>
          {/* Status selector */}
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="input text-xs py-1.5 max-w-[150px]">
            {STATUS_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {hasFilters && (
            <button onClick={() => { setType(''); setStatus(''); setPage(1); }}
              className="text-xs text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 transition underline">
              Clear
            </button>
          )}
        </div>

        {/* Loading skeleton */}
        {q.isLoading ? (
          <div className="px-5 py-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="h-10 w-10 rounded-lg bg-ink-100 dark:bg-ink-800 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-ink-100 dark:bg-ink-800 rounded w-2/5" />
                  <div className="h-2.5 bg-ink-100 dark:bg-ink-800 rounded w-1/4" />
                </div>
                <div className="h-4 bg-ink-100 dark:bg-ink-800 rounded w-20" />
              </div>
            ))}
          </div>

        ) : (q.data?.items.length ?? 0) === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="h-14 w-14 rounded-full bg-ink-100 dark:bg-ink-800 flex items-center justify-center mx-auto mb-4">
              <ListOrdered className="h-6 w-6 text-ink-400" />
            </div>
            <p className="font-semibold text-ink-700 dark:text-ink-300">No transactions found</p>
            <p className="text-sm text-ink-400 dark:text-ink-500 mt-1">
              {hasFilters ? 'Try adjusting your filters.' : 'Fund your wallet to get started.'}
            </p>
          </div>

        ) : (
          <ul className="divide-y divide-ink-50 dark:divide-ink-800/60">
            {q.data!.items.map((tx) => {
              const isCredit = tx.type === 'wallet_funding' || tx.type === 'refund';
              const meta = TX_ICON[tx.type] ?? TX_ICON.service_purchase;
              const Icon = meta.icon;
              return (
                <li key={tx.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-ink-50/50 dark:hover:bg-ink-800/30 transition group">
                  {/* Icon */}
                  <div className={`h-10 w-10 rounded-lg ${meta.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`h-[18px] w-[18px] ${meta.color}`} />
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-ink-900 dark:text-white truncate">
                        {tx.description ?? TYPE_LABELS[tx.type] ?? tx.type.replace(/_/g, ' ')}
                      </span>
                      <StatusBadge status={tx.status} />
                    </div>
                    <div className="text-xs text-ink-400 dark:text-ink-500 mt-0.5 font-mono">
                      {tx.reference} · {relativeTime(tx.created_at)}
                    </div>
                  </div>

                  {/* Amount + print */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className={`font-mono font-semibold text-sm ${
                      isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-900 dark:text-white'
                    }`}>
                      {isCredit ? '+' : '−'}{formatMoney(tx.amount_minor, tx.currency)}
                    </div>
                    <button onClick={() => printReceipt(tx)} title="Print receipt"
                      className="p-1.5 text-ink-300 hover:text-ink-600 dark:hover:text-ink-200 transition rounded-lg hover:bg-ink-100 dark:hover:bg-ink-700 opacity-0 group-hover:opacity-100">
                      <Printer className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Pagination */}
        {q.data && q.data.meta.last_page > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-ink-100 dark:border-ink-800">
            <span className="text-xs text-ink-500 dark:text-ink-400">
              Page {q.data.meta.current_page} of {q.data.meta.last_page}
              <span className="hidden sm:inline"> · {q.data.meta.total.toLocaleString()} total</span>
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-ink-200 dark:border-ink-700 text-xs font-medium text-ink-600 dark:text-ink-300 hover:border-ink-400 disabled:opacity-40 disabled:cursor-not-allowed transition">
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= q.data.meta.last_page}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-ink-200 dark:border-ink-700 text-xs font-medium text-ink-600 dark:text-ink-300 hover:border-ink-400 disabled:opacity-40 disabled:cursor-not-allowed transition">
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
