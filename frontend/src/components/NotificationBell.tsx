import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, X, CheckCheck, ShoppingBag, Wallet, Shield, Gift, Zap } from 'lucide-react';
import { apiCall } from '@/lib/api';
import { clsx } from 'clsx';

type Notif = {
  id: number;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
};

type NotifData = { items: Notif[]; unread: number };

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  order_completed: ShoppingBag,
  order_failed:    ShoppingBag,
  wallet_funded:   Wallet,
  security:        Shield,
  referral_bonus:  Gift,
};

const TYPE_COLOR: Record<string, string> = {
  order_completed: 'text-emerald-500',
  order_failed:    'text-red-500',
  wallet_funded:   'text-blue-500',
  security:        'text-orange-500',
  referral_bonus:  'text-purple-500',
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref  = useRef<HTMLDivElement>(null);
  const qc   = useQueryClient();

  const { data } = useQuery<NotifData>({
    queryKey: ['notifications'],
    queryFn: () => apiCall<NotifData>({ method: 'GET', url: '/notifications' }),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const markAll = useMutation({
    mutationFn: () => apiCall({ method: 'POST', url: '/notifications/read-all' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markOne = useMutation({
    mutationFn: (id: number) => apiCall({ method: 'POST', url: `/notifications/${id}/read` }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unread = data?.unread ?? 0;
  const items  = data?.items ?? [];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800 transition"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[10px] text-white font-bold flex items-center justify-center leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-ink-900 rounded-2xl shadow-2xl border border-ink-100 dark:border-ink-800 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-ink-100 dark:border-ink-800">
            <span className="font-semibold text-sm dark:text-white">Notifications</span>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={() => markAll.mutate()}
                  className="flex items-center gap-1 text-xs text-ink-500 hover:text-ink-700 dark:hover:text-ink-300 px-2 py-1 rounded-lg hover:bg-ink-50 dark:hover:bg-ink-800 transition"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 text-ink-400 hover:text-ink-600 rounded-lg transition">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-ink-50 dark:divide-ink-800">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-ink-400">
                <Zap className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              items.map(n => {
                const Icon  = TYPE_ICON[n.type] ?? Bell;
                const color = TYPE_COLOR[n.type] ?? 'text-ink-400';
                return (
                  <button
                    key={n.id}
                    onClick={() => { if (!n.read) markOne.mutate(n.id); }}
                    className={clsx(
                      'w-full flex items-start gap-3 px-4 py-3 text-left transition hover:bg-ink-50 dark:hover:bg-ink-800',
                      !n.read && 'bg-blue-50/50 dark:bg-blue-900/10',
                    )}
                  >
                    <div className={clsx('mt-0.5 shrink-0', color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={clsx('text-sm leading-snug', !n.read ? 'font-semibold text-ink-900 dark:text-white' : 'text-ink-700 dark:text-ink-300')}>
                        {n.title}
                      </p>
                      {n.body && <p className="text-xs text-ink-500 mt-0.5 line-clamp-2">{n.body}</p>}
                      <p className="text-[10px] text-ink-400 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.read && <div className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
