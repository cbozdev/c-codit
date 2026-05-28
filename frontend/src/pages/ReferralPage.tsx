import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Copy, Share2, Users, Wallet, Link2, CreditCard, Gift, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { apiCall } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReferralEntry {
  name: string;
  joined_at: string;
}

interface ReferralInfo {
  code: string;
  link: string;
  reward_amount: string;
  min_fund_amount: string;
  total_earned: string;
  total_invitees: number;
  pending: ReferralEntry[];
  completed: ReferralEntry[];
  cancelled: ReferralEntry[];
}

type Tab = 'pending' | 'completed' | 'cancelled';

// ─── Step visual ──────────────────────────────────────────────────────────────

function Step({
  icon,
  label,
  last = false,
}: {
  icon: React.ReactNode;
  label: string;
  last?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3 flex-1">
      <div className="relative flex items-center w-full justify-center">
        <div className="h-14 w-14 rounded-full bg-brand-50 dark:bg-brand-950/40 border-2 border-brand-200 dark:border-brand-800 flex items-center justify-center text-brand-600 dark:text-brand-400 shrink-0 z-10">
          {icon}
        </div>
        {!last && (
          <div className="absolute left-[calc(50%+28px)] right-0 top-1/2 -translate-y-1/2 h-0 border-t-2 border-dashed border-brand-300 dark:border-brand-700" />
        )}
      </div>
      <p className="text-xs text-center text-ink-600 dark:text-ink-400 leading-snug px-1">{label}</p>
    </div>
  );
}

// ─── Referral list row ────────────────────────────────────────────────────────

function ReferralRow({ entry, type }: { entry: ReferralEntry; type: Tab }) {
  const icon =
    type === 'completed' ? (
      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
    ) : type === 'pending' ? (
      <Clock className="h-4 w-4 text-amber-500 shrink-0" />
    ) : (
      <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
    );

  return (
    <div className="flex items-center justify-between py-3 border-b border-ink-100 dark:border-ink-800 last:border-0">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-sm font-medium dark:text-white">{entry.name}</p>
          <p className="text-xs text-ink-500">{entry.joined_at}</p>
        </div>
      </div>
      {type === 'completed' && (
        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-full">
          +$1.00
        </span>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReferralPage() {
  const [activeTab, setActiveTab] = useState<Tab>('pending');

  const { data, isLoading } = useQuery<ReferralInfo>({
    queryKey: ['referral-info'],
    queryFn: () => apiCall({ method: 'GET', url: '/auth/referral' }),
    staleTime: 60_000,
  });

  function copyLink() {
    if (!data) return;
    navigator.clipboard.writeText(data.link).then(() => toast.success('Referral link copied!'));
  }

  async function shareLink() {
    if (!data) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join me on C-Codit',
          text: `Sign up with my referral link and get started!`,
          url: data.link,
        });
      } catch {
        copyLink();
      }
    } else {
      copyLink();
    }
  }

  const tabEntries: ReferralEntry[] = data ? data[activeTab] : [];

  const tabs: { key: Tab; label: string; count: number }[] = data
    ? [
        { key: 'pending',   label: 'Pending',   count: data.pending.length   },
        { key: 'completed', label: 'Completed',  count: data.completed.length },
        { key: 'cancelled', label: 'Cancelled',  count: data.cancelled.length },
      ]
    : [];

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">

      {/* ── Header card ─────────────────────────────────────────────────────── */}
      <div className="card-pad text-center space-y-6">
        <h1 className="text-lg font-bold dark:text-white">How to use invitation code</h1>

        {/* 3-step visual */}
        <div className="flex items-start gap-0">
          <Step
            icon={<Link2 className="h-6 w-6" />}
            label={`Share invitation link/code with friends`}
          />
          <Step
            icon={<CreditCard className="h-6 w-6" />}
            label={`Let friends sign up and fund wallet (min $${data?.min_fund_amount ?? '1'})`}
          />
          <Step
            icon={<Gift className="h-6 w-6" />}
            label={`Receive $${data?.reward_amount ?? '1.00'} reward instantly`}
            last
          />
        </div>

        {/* Referral link box */}
        <div className="rounded-xl border border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-800 px-4 py-3 text-left space-y-1">
          <p className="text-xs text-ink-500 dark:text-ink-400">Your Referral link:</p>
          {isLoading ? (
            <div className="h-4 w-48 bg-ink-200 dark:bg-ink-700 rounded animate-pulse" />
          ) : (
            <div className="flex items-center gap-2">
              <p className="flex-1 text-sm font-medium text-ink-800 dark:text-white truncate">
                {data?.link ?? '—'}
              </p>
              <button
                onClick={copyLink}
                className="shrink-0 p-1.5 rounded-lg hover:bg-ink-200 dark:hover:bg-ink-600 transition text-ink-500 dark:text-ink-300"
                title="Copy link"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Referral code pill */}
        {data?.code && (
          <div className="flex items-center justify-center gap-3">
            <span className="text-xs text-ink-500 dark:text-ink-400">Code:</span>
            <code
              onClick={copyLink}
              className="cursor-pointer font-mono font-bold tracking-widest text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40 px-3 py-1 rounded-lg text-sm select-all"
              title="Click to copy link"
            >
              {data.code}
            </code>
          </div>
        )}

        {/* Share button */}
        <button
          onClick={shareLink}
          disabled={!data}
          className="w-full btn-brand flex items-center justify-center gap-2 text-base py-3"
        >
          <Share2 className="h-4 w-4" />
          Share Invitation link
        </button>
      </div>

      {/* ── Referral Record card ─────────────────────────────────────────────── */}
      <div className="card-pad space-y-5">
        <h2 className="text-base font-bold dark:text-white">Referral Record</h2>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-ink-50 dark:bg-ink-800 border border-ink-200 dark:border-ink-700 p-4 space-y-1">
            <div className="flex items-center gap-2 text-ink-500 dark:text-ink-400 text-xs">
              <Wallet className="h-3.5 w-3.5" /> Total Earned
            </div>
            {isLoading ? (
              <div className="h-7 w-20 bg-ink-200 dark:bg-ink-700 rounded animate-pulse" />
            ) : (
              <p className="text-2xl font-bold dark:text-white">${data?.total_earned ?? '0.00'}</p>
            )}
          </div>

          <div className="rounded-xl bg-ink-50 dark:bg-ink-800 border border-ink-200 dark:border-ink-700 p-4 space-y-1">
            <div className="flex items-center gap-2 text-ink-500 dark:text-ink-400 text-xs">
              <Users className="h-3.5 w-3.5" /> Invitees
            </div>
            {isLoading ? (
              <div className="h-7 w-10 bg-ink-200 dark:bg-ink-700 rounded animate-pulse" />
            ) : (
              <p className="text-2xl font-bold dark:text-white">{data?.total_invitees ?? 0}</p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-ink-200 dark:border-ink-700">
          {tabs.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={clsx(
                'flex-1 py-2.5 text-sm font-medium transition border-b-2 -mb-px',
                activeTab === key
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-ink-500 dark:text-ink-400 hover:text-ink-700 dark:hover:text-ink-200',
              )}
            >
              {label}
              {count > 0 && (
                <span className={clsx(
                  'ml-1.5 text-xs rounded-full px-1.5 py-0.5',
                  activeTab === key
                    ? 'bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300'
                    : 'bg-ink-100 dark:bg-ink-700 text-ink-500 dark:text-ink-400',
                )}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="min-h-[120px]">
          {isLoading ? (
            <div className="space-y-3 py-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-10 bg-ink-100 dark:bg-ink-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : tabEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-ink-400 dark:text-ink-500 gap-3">
              <Users className="h-8 w-8 opacity-40" />
              <p className="text-sm">
                {activeTab === 'pending'
                  ? 'No pending referrals yet. Share your link!'
                  : activeTab === 'completed'
                  ? 'No completed referrals yet.'
                  : 'No cancelled referrals.'}
              </p>
            </div>
          ) : (
            <div>
              {tabEntries.map((entry, i) => (
                <ReferralRow key={i} entry={entry} type={activeTab} />
              ))}
            </div>
          )}
        </div>

        {/* Info box */}
        <div className="rounded-xl bg-brand-50 dark:bg-brand-950/30 border border-brand-100 dark:border-brand-900 p-3 text-xs text-brand-700 dark:text-brand-300 leading-relaxed">
          💡 Earn <strong>${data?.reward_amount ?? '1.00'} USD</strong> for every friend who signs up with your code and completes their first purchase. Rewards are credited instantly to your wallet.
        </div>
      </div>
    </div>
  );
}
