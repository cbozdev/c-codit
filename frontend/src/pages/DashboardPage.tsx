import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiCall } from '@/lib/api';
import { useAuth } from '@/context/auth';
import { formatMoney, relativeTime } from '@/lib/format';
import type { Paginated, Transaction, Wallet } from '@/types/api';
import { StatusBadge } from '@/components/StatusBadge';
import { ArrowDownToLine, ArrowUpRight, Wallet as WalletIcon, Smartphone, Receipt } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();

  const wallet = useQuery({
    queryKey: ['wallet'],
    queryFn: () => apiCall<Wallet>({ url: '/wallet' }),
  });

  const recentTx = useQuery({
    queryKey: ['transactions', { per_page: 5 }],
    queryFn: () => apiCall<Paginated<Transaction>>({ url: '/wallet/transactions', params: { per_page: 5 } }),
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome, {user?.name?.split(' ')[0] ?? 'there'}.</h1>
        <p className="text-sm text-ink-600 mt-1">Here's your wallet at a glance.</p>
      </div>

      {/* Wallet card */}
      <div className="card-pad bg-gradient-to-br from-ink-950 to-ink-900 text-white border-ink-950">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-ink-300 text-sm">
              <WalletIcon className="h-4 w-4" /> Available balance
            </div>
            <div className="mt-2 text-4xl font-semibold tracking-tight">
              {wallet.isLoading
                ? <span className="inline-block bg-ink-700 rounded h-9 w-40 animate-pulse" />
                : formatMoney(wallet.data?.balance_minor ?? 0, wallet.data?.currency ?? 'USD')}
            </div>
            <div className="text-ink-400 text-sm mt-1">{wallet.data?.currency ?? 'USD'}</div>
          </div>
          <Link to="/wallet" className="btn-brand">
            <ArrowDownToLine className="h-4 w-4" /> Add funds
          </Link>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Link to="/services" className="card-pad hover:shadow-glow transition">
          <Smartphone className="h-5 w-5 text-brand-600" />
          <div className="mt-3 font-semibold">Buy a virtual number</div>
          <div className="text-sm text-ink-600 mt-1">Disposable numbers via 5sim & sms-activate.</div>
        </Link>
        <Link to="/wallet" className="card-pad hover:shadow-glow transition">
          <ArrowDownToLine className="h-5 w-5 text-brand-600" />
          <div className="mt-3 font-semibold">Top up wallet</div>
          <div className="text-sm text-ink-600 mt-1">Card via Flutterwave or crypto via NowPayments.</div>
        </Link>
        <Link to="/transactions" className="card-pad hover:shadow-glow transition">
          <Receipt className="h-5 w-5 text-brand-600" />
          <div className="mt-3 font-semibold">Transaction history</div>
          <div className="text-sm text-ink-600 mt-1">Every credit and debit, with full traceability.</div>
        </Link>
      </div>

      {/* Recent activity */}
      <div className="card-pad">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Recent activity</h2>
          <Link to="/transactions" className="text-sm text-brand-700 hover:underline inline-flex items-center gap-1">
            See all <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {recentTx.isLoading ? (
          <div className="text-sm text-ink-500">Loading…</div>
        ) : (recentTx.data?.items.length ?? 0) === 0 ? (
          <div className="text-sm text-ink-500 py-6 text-center">No transactions yet.</div>
        ) : (
          <ul className="divide-y divide-ink-100">
            {recentTx.data!.items.map((tx) => (
              <li key={tx.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{tx.description ?? tx.type}</div>
                  <div className="text-xs text-ink-500 mt-0.5">
                    {tx.reference} · {relativeTime(tx.created_at)}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-mono font-medium ${
                    tx.type === 'wallet_funding' || tx.type === 'refund' ? 'text-brand-700' : 'text-ink-900'
                  }`}>
                    {tx.type === 'wallet_funding' || tx.type === 'refund' ? '+' : '−'}
                    {formatMoney(tx.amount_minor, tx.currency)}
                  </div>
                  <div className="mt-0.5"><StatusBadge status={tx.status} /></div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
