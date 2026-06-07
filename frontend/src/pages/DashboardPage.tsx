import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiCall } from '@/lib/api';
import { useAuth } from '@/context/auth';
import { formatMoney, relativeTime } from '@/lib/format';
import type { Paginated, Transaction, Wallet } from '@/types/api';
import { StatusBadge } from '@/components/StatusBadge';
import {
  ArrowDownToLine, ArrowUpRight, Wallet as WalletIcon,
  Smartphone, Gift, Zap, TrendingUp, ShoppingBag,
  RefreshCw, Globe, MapPin,
} from 'lucide-react';
import { startTour } from '@/lib/tour';

const TX_ICON: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  wallet_funding:   { icon: ArrowDownToLine, color: 'text-brand-600',   bg: 'bg-brand-50 dark:bg-brand-900/30' },
  service_purchase: { icon: ShoppingBag,     color: 'text-violet-600',  bg: 'bg-violet-50 dark:bg-violet-900/30' },
  refund:           { icon: RefreshCw,       color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
  adjustment:       { icon: TrendingUp,      color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-900/30' },
};

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

  const QUICK_ACTIONS = [
    {
      to: '/services/virtual-numbers', icon: Smartphone, title: 'Virtual Numbers',
      desc: 'Disposable numbers via 5sim & SMS-Man.',
      iconColor: 'text-violet-600', iconBg: 'bg-violet-100 dark:bg-violet-900/40',
      border: 'hover:border-violet-300 dark:hover:border-violet-700',
    },
    {
      to: '/wallet', icon: ArrowDownToLine, title: 'Top up wallet',
      desc: 'Card via Flutterwave or crypto.',
      iconColor: 'text-brand-600', iconBg: 'bg-brand-100 dark:bg-brand-900/40',
      border: 'hover:border-brand-300 dark:hover:border-brand-700',
    },
    {
      to: '/services/gift-cards', icon: Gift, title: 'Gift Cards',
      desc: 'Amazon, Google Play, Netflix and more.',
      iconColor: 'text-pink-600', iconBg: 'bg-pink-100 dark:bg-pink-900/40',
      border: 'hover:border-pink-300 dark:hover:border-pink-700',
    },
    {
      to: '/services/utility', icon: Zap, title: 'Utility Bills',
      desc: 'Airtime, data, electricity, TV.',
      iconColor: 'text-amber-600', iconBg: 'bg-amber-100 dark:bg-amber-900/40',
      border: 'hover:border-amber-300 dark:hover:border-amber-700',
    },
    {
      to: '/proxy', icon: Globe, title: 'Proxies',
      desc: 'Residential & datacenter proxies.',
      iconColor: 'text-teal-600', iconBg: 'bg-teal-100 dark:bg-teal-900/40',
      border: 'hover:border-teal-300 dark:hover:border-teal-700',
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-white">
            Welcome back, <span className="text-brand-600">{user?.name?.split(' ')[0] ?? 'there'}</span>.
          </h1>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">Here's what's happening with your account.</p>
        </div>
        <button
          onClick={startTour}
          className="shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl border border-ink-200 dark:border-ink-700 text-sm font-medium text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 transition"
        >
          <MapPin className="h-4 w-4" /> Take a tour
        </button>
      </div>

      {/* Wallet card */}
      <div data-tour="wallet-card" className="relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-ink-950 via-ink-900 to-brand-950 text-white border border-ink-800 shadow-lg">
        {/* Decorative circle */}
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-brand-500/10 blur-2xl pointer-events-none" />
        <div className="absolute right-16 bottom-0 h-24 w-24 rounded-full bg-violet-500/10 blur-xl pointer-events-none" />

        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-ink-300 text-sm">
              <WalletIcon className="h-4 w-4" /> Available balance
            </div>
            <div className="mt-2 text-4xl font-semibold tracking-tight">
              {wallet.isLoading
                ? <span className="inline-block bg-ink-700 rounded-lg h-10 w-44 animate-pulse" />
                : formatMoney(wallet.data?.balance_minor ?? 0, wallet.data?.currency ?? 'USD')}
            </div>
            <div className="text-ink-400 text-xs mt-1.5 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
              {wallet.data?.currency ?? 'USD'} · Instantly available
            </div>
          </div>
          <Link to="/wallet"
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white text-sm font-medium border border-white/10 transition">
            <ArrowDownToLine className="h-4 w-4" /> Add funds
          </Link>
        </div>
      </div>

      {/* Quick actions */}
      <div data-tour="quick-actions">
        <h2 className="text-sm font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wide mb-3">Quick actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {QUICK_ACTIONS.map(({ to, icon: Icon, title, desc, iconColor, iconBg, border }) => (
            <Link key={title} to={to}
              className={`group flex flex-col gap-3 rounded-xl border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 transition hover:shadow-md ${border}`}>
              <div className={`h-9 w-9 rounded-lg ${iconBg} flex items-center justify-center`}>
                <Icon className={`h-4.5 w-4.5 ${iconColor}`} style={{ height: '18px', width: '18px' }} />
              </div>
              <div>
                <div className="font-semibold text-sm text-ink-900 dark:text-white leading-tight">{title}</div>
                <div className="text-xs text-ink-500 dark:text-ink-400 mt-0.5 leading-tight hidden sm:block">{desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div className="rounded-xl border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100 dark:border-ink-800">
          <h2 className="font-semibold text-ink-900 dark:text-white">Recent activity</h2>
          <Link to="/transactions"
            className="text-sm text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1 font-medium">
            See all <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {recentTx.isLoading ? (
          <div className="px-5 py-8 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="h-9 w-9 rounded-lg bg-ink-100 dark:bg-ink-800 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-ink-100 dark:bg-ink-800 rounded w-1/2" />
                  <div className="h-2.5 bg-ink-100 dark:bg-ink-800 rounded w-1/3" />
                </div>
                <div className="h-4 bg-ink-100 dark:bg-ink-800 rounded w-16" />
              </div>
            ))}
          </div>
        ) : (recentTx.data?.items.length ?? 0) === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-ink-100 dark:bg-ink-800 flex items-center justify-center mx-auto mb-3">
              <WalletIcon className="h-5 w-5 text-ink-400" />
            </div>
            <p className="text-sm font-medium text-ink-600 dark:text-ink-300">No transactions yet</p>
            <p className="text-xs text-ink-400 dark:text-ink-500 mt-1">Fund your wallet to get started.</p>
            <Link to="/wallet" className="mt-4 inline-flex items-center gap-1.5 text-sm text-brand-600 font-medium hover:underline">
              <ArrowDownToLine className="h-3.5 w-3.5" /> Add funds
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-ink-50 dark:divide-ink-800/60">
            {recentTx.data!.items.map((tx) => {
              const isCredit = tx.type === 'wallet_funding' || tx.type === 'refund';
              const txMeta = TX_ICON[tx.type] ?? TX_ICON.service_purchase;
              const TxIcon = txMeta.icon;
              return (
                <li key={tx.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-ink-50/50 dark:hover:bg-ink-800/30 transition">
                  <div className={`h-9 w-9 rounded-lg ${txMeta.bg} flex items-center justify-center shrink-0`}>
                    <TxIcon className={`h-4 w-4 ${txMeta.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate text-ink-900 dark:text-white">
                      {tx.description ?? tx.type.replace(/_/g, ' ')}
                    </div>
                    <div className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">
                      {tx.reference} · {relativeTime(tx.created_at)}
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <div className={`font-mono font-semibold text-sm ${
                      isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-900 dark:text-white'
                    }`}>
                      {isCredit ? '+' : '−'}{formatMoney(tx.amount_minor, tx.currency)}
                    </div>
                    <div><StatusBadge status={tx.status} /></div>
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
