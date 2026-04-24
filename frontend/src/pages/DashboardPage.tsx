import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiCall } from '@/lib/api';
import { useAuth } from '@/context/auth';
import { formatMoney, relativeTime } from '@/lib/format';
import type { Paginated, Transaction, Wallet } from '@/types/api';
import { StatusBadge } from '@/components/StatusBadge';
import {
  ArrowDownToLine, ArrowUpRight, Wallet as WalletIcon,
  Smartphone, Receipt, Gift, Phone,
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();

  const wallet = useQuery({
    queryKey: ['wallet'],
    queryFn: () => apiCall<Wallet>({ url: '/wallet' }),
  });

  const recentTx = useQuery({
    queryKey: ['transactions', { per_page: 5 }],
    queryFn: () => apiCall<Paginated<Transaction>>({
      url: '/wallet/transactions',
      params: { per_page: 5 },
    }),
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-white">
          Welcome, {user?.name?.split(' ')[0] ?? 'there'}.
        </h1>
        <p className="text-sm text-ink-600 dark:text-ink-400 mt-1">Here's your wallet at a glance.</p>
      </div>

      {/* Wallet card — always dark gradient */}
      <div className="rounded-2xl p-6 bg-gradient-to-br from-ink-950 to-ink-900 text-white border border-ink-900">
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
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { to: '/services', icon: Smartphone, title: 'Virtual Numbers',  desc: 'Disposable numbers via 5sim & SMS-Activate.' },
          { to: '/wallet',   icon: ArrowDownToLine, title: 'Top up wallet', desc: 'Card via Flutterwave or crypto.' },
          { to: '/services', icon: Gift,        title: 'Gift Cards',      desc: 'Amazon, Google Play, Netflix and more.' },
          { to: '/services', icon: Phone,        title: 'Utility Bills',  desc: 'Airtime, data, electricity, TV.' },
        ].map(({ to, icon: Icon, title, desc }) => (
          <Link key={title} to={to}
            className="card-pad hover:shadow-glow transition group">
            <Icon className="h-5 w-5 text-brand-600" />
            <div className="mt-3 font-semibold text-ink-900 dark:text-white group-hover:text-brand-700 dark:group-hover:text-brand-400 transition">
              {title}
            </div>
            <div className="text-sm text-ink-600 dark:text-ink-400 mt-1">{desc}</div>
          </Link>
        ))}
      </div>

      {/* Recent activity */}
      <div className="card-pad">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-ink-900 dark:text-white">Recent activity</h2>
          <Link to="/transactions"
            className="text-sm text-brand-700 dark:text-brand-400 hover:underline inline-flex items-center gap-1">
            See all <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {recentTx.isLoading ? (
          <div className="text-sm text-ink-500">Loading…</div>
        ) : (recentTx.data?.items.length ?? 0) === 0 ? (
          <div className="text-sm text-ink-500 dark:text-ink-400 py-6 text-center">
            No transactions yet. Fund your wallet to get started.
          </div>
        ) : (
          <ul className="divide-y divide-ink-100 dark:divide-ink-800">
            {recentTx.data!.items.map((tx) => {
              const isCredit = tx.type === 'wallet_funding' || tx.type === 'refund';
              return (
                <li key={tx.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate text-ink-900 dark:text-white">
                      {tx.description ?? tx.type.replace('_', ' ')}
                    </div>
                    <div className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">
                      {tx.reference} · {relativeTime(tx.created_at)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`font-mono font-medium text-sm ${
                      isCredit ? 'text-brand-600 dark:text-brand-400' : 'text-ink-900 dark:text-white'
                    }`}>
                      {isCredit ? '+' : '−'}{formatMoney(tx.amount_minor, tx.currency)}
                    </div>
                    <div className="mt-0.5"><StatusBadge status={tx.status} /></div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
