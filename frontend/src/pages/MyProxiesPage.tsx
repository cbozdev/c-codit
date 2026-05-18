import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiCall } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type {
  MarketplaceCountries,
  MarketplacePage,
  ProxyListing,
  ProxySubscription,
  ProxyTrialStatus,
  Wallet,
} from '@/types/api';
import {
  Globe, Copy, Eye, EyeOff, RotateCcw,
  Wifi, WifiOff, Smartphone, ChevronLeft, ChevronRight,
  CheckCircle2, AlertCircle, X, Shield, Zap,
  ArrowRight,
} from 'lucide-react';
import { clsx } from 'clsx';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function copyText(text: string, label = 'Copied') {
  navigator.clipboard.writeText(text).then(() => toast.success(label));
}

function speedColor(ms: number) {
  if (ms < 100) return 'text-emerald-600';
  if (ms < 200) return 'text-amber-500';
  return 'text-rose-500';
}

// ─── IP Update Modal ──────────────────────────────────────────────────────────

function IpWhitelistModal({ currentIps, onClose }: { currentIps: string[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [ips, setIps] = useState<string[]>([...currentIps, '', '', '', ''].slice(0, 5));

  const save = useMutation({
    mutationFn: () => apiCall<{ ips: string[] }>({
      method: 'PUT',
      url: '/proxy/whitelist',
      data: { ips: ips.filter(Boolean) },
    }),
    onSuccess: () => {
      toast.success('IP whitelist updated.');
      qc.invalidateQueries({ queryKey: ['proxy', 'whitelist'] });
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-ink-900 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-ink-100 dark:border-ink-800">
          <div>
            <h2 className="font-semibold dark:text-white text-lg">Your IPs</h2>
            <p className="text-xs text-ink-500 mt-0.5">Up to 5 device IPs for IP authentication</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 text-ink-400"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          {ips.map((ip, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs font-medium text-ink-400 w-4 text-right shrink-0">{i + 1}</span>
              <input
                type="text"
                className="input flex-1 font-mono text-sm"
                placeholder="e.g. 192.168.1.1"
                value={ip}
                onChange={(e) => {
                  const next = [...ips];
                  next[i] = e.target.value.trim();
                  setIps(next);
                }}
              />
            </div>
          ))}
          <p className="text-xs text-ink-400 pt-1">
            These IPs can authenticate with your proxies without a username/password.
          </p>
        </div>
        <div className="flex gap-3 p-5 pt-0">
          <button onClick={onClose} className="btn-outline flex-1">Cancel</button>
          <button onClick={() => save.mutate()} disabled={save.isPending} className="btn-primary flex-1">
            {save.isPending ? 'Saving…' : 'Save IPs'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Credentials Modal ────────────────────────────────────────────────────────

type TestResult = { success: boolean; ip?: string; country?: string; city?: string | null; speed_ms?: number; error?: string };

function CredentialsModal({ sub, onClose }: { sub: ProxySubscription; onClose: () => void }) {
  const [showPw, setShowPw] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['proxy', sub.id, 'credentials'],
    queryFn:  () => apiCall<ProxySubscription>({ url: `/proxy/my/${sub.id}`, params: { with_credentials: true } }),
  });

  const testProxy = useMutation({
    mutationFn: () => apiCall<TestResult>({ method: 'POST', url: `/proxy/my/${sub.id}/test` }),
    onSuccess:  (r) => setTestResult(r),
    onError:    () => setTestResult({ success: false, error: 'Test failed' }),
  });

  const creds    = data ?? sub;
  const proxyUrl = data?.proxy_url ?? `${creds.protocol}://${creds.username}:***@${creds.host}:${creds.port}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-ink-900 rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-ink-100 dark:border-ink-800">
          <div>
            <h2 className="font-semibold dark:text-white">{sub.location_country} Proxy</h2>
            <p className="text-xs text-ink-500 mt-0.5">{sub.protocol.toUpperCase()} · {sub.provider}</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 text-ink-400"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          {isLoading && <p className="text-sm text-ink-500">Loading credentials…</p>}
          <CredRow label="Host"     value={creds.host ?? ''} />
          <CredRow label="Port"     value={String(creds.port)} />
          <CredRow label="Protocol" value={creds.protocol.toUpperCase()} noCopy />
          <CredRow label="Username" value={creds.username ?? ''} />
          {data?.password && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-ink-500 uppercase tracking-wide">Password</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 font-mono text-sm bg-ink-50 dark:bg-ink-800 rounded-lg px-3 py-2 break-all">
                  {showPw ? data.password : '••••••••••••'}
                </div>
                <button onClick={() => setShowPw(!showPw)} className="btn-ghost p-2">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button onClick={() => copyText(data.password!, 'Password copied')} className="btn-ghost p-2">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
          <div className="space-y-1">
            <p className="text-xs font-medium text-ink-500 uppercase tracking-wide">Proxy URL</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 font-mono text-xs bg-ink-50 dark:bg-ink-800 rounded-lg px-3 py-2 break-all">{proxyUrl}</div>
              {data?.proxy_url && (
                <button onClick={() => copyText(data.proxy_url!, 'Proxy URL copied')} className="btn-ghost p-2">
                  <Copy className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <button
            onClick={() => testProxy.mutate()}
            disabled={testProxy.isPending}
            className="btn-outline text-xs w-full flex items-center justify-center gap-2"
          >
            <Wifi className="h-3.5 w-3.5" />
            {testProxy.isPending ? 'Checking IP…' : 'Check Exit IP'}
          </button>
          {testResult && (
            <div className={clsx(
              'rounded-lg px-4 py-3 text-sm',
              testResult.success
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                : 'bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800',
            )}>
              {testResult.success ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    <span className="font-mono font-semibold text-green-700 dark:text-green-300 text-base">{testResult.ip}</span>
                    <button onClick={() => copyText(testResult.ip!, 'IP copied')} className="btn-ghost p-1">
                      <Copy className="h-3 w-3 text-green-600" />
                    </button>
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-400 pl-6">
                    {testResult.country}{testResult.city ? `, ${testResult.city}` : ''} · {testResult.speed_ms}ms
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span className="text-xs">{testResult.error ?? 'Could not reach proxy'}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CredRow({ label, value, noCopy = false }: { label: string; value: string; noCopy?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-ink-500 uppercase tracking-wide">{label}</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 font-mono text-sm bg-ink-50 dark:bg-ink-800 rounded-lg px-3 py-2 break-all">{value}</div>
        {!noCopy && (
          <button onClick={() => copyText(value, `${label} copied`)} className="btn-ghost p-2">
            <Copy className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Buy Confirm Modal ────────────────────────────────────────────────────────

function BuyModal({
  listing,
  walletBalance,
  onClose,
}: {
  listing: ProxyListing;
  walletBalance: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  const buy = useMutation({
    mutationFn: () => apiCall<ProxySubscription>({
      method: 'POST',
      url: `/proxy/marketplace/${listing.id}/buy`,
    }),
    onSuccess: () => {
      toast.success('Proxy activated! Check your Active tab.');
      qc.invalidateQueries({ queryKey: ['proxy', 'my'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const insufficient = parseFloat(walletBalance.replace(/[^0-9.]/g, '')) < listing.price_minor / 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-ink-900 rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="p-5 border-b border-ink-100 dark:border-ink-800 flex items-center justify-between">
          <h2 className="font-semibold dark:text-white">Confirm Purchase</h2>
          <button onClick={onClose} className="btn-ghost p-1.5 text-ink-400"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="rounded-xl bg-ink-50 dark:bg-ink-800 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-500">Location</span>
              <span className="font-medium dark:text-white">
                {listing.country_name}{listing.state_code ? ` (${listing.state_code})` : ''}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-500">Type</span>
              <span className="font-medium dark:text-white capitalize">{listing.connection_type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-500">Protocol</span>
              <span className="font-medium dark:text-white uppercase">{listing.protocol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-500">Duration</span>
              <span className="font-medium dark:text-white">30 days</span>
            </div>
            <div className="border-t border-ink-200 dark:border-ink-700 pt-2 flex justify-between">
              <span className="font-semibold dark:text-white">Total</span>
              <span className="font-bold text-brand-600 text-base">{listing.price}</span>
            </div>
          </div>
          <div className="flex justify-between text-xs text-ink-500">
            <span>Wallet balance</span>
            <span className={clsx(insufficient ? 'text-rose-600 font-medium' : '')}>{walletBalance}</span>
          </div>
          {insufficient && (
            <p className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-900/20 rounded-lg px-3 py-2">
              Insufficient balance. Please top up your wallet first.
            </p>
          )}
        </div>
        <div className="flex gap-3 p-5 pt-0">
          <button onClick={onClose} className="btn-outline flex-1">Cancel</button>
          <button
            onClick={() => buy.mutate()}
            disabled={buy.isPending || insufficient}
            className="btn-primary flex-1"
          >
            {buy.isPending ? 'Processing…' : `Buy for ${listing.price}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Active Proxy Card ────────────────────────────────────────────────────────

function ActiveProxyCard({ sub, onViewCreds }: { sub: ProxySubscription; onViewCreds: () => void }) {
  const qc = useQueryClient();
  const config = (sub as any).config as Record<string, string> | null;

  const rotate = useMutation({
    mutationFn: () => apiCall<ProxySubscription>({ method: 'POST', url: `/proxy/my/${sub.id}/rotate` }),
    onSuccess: () => { toast.success('Session rotated.'); qc.invalidateQueries({ queryKey: ['proxy', 'my'] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const cancel = useMutation({
    mutationFn: () => apiCall<null>({ method: 'POST', url: `/proxy/my/${sub.id}/cancel` }),
    onSuccess: () => { toast.success('Proxy cancelled.'); qc.invalidateQueries({ queryKey: ['proxy', 'my'] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const isExpired   = sub.status !== 'active';
  const isMobile    = config?.connection_type === 'cell';
  const stateLabel  = config?.state_code ? ` · ${config.state_code}` : '';
  const expires     = new Date(sub.expires_at);
  const daysLeft    = Math.max(0, Math.ceil((expires.getTime() - Date.now()) / 86400000));

  return (
    <div className={clsx(
      'rounded-xl border-2 p-4 space-y-3 transition',
      isExpired
        ? 'border-ink-200 dark:border-ink-700 opacity-75'
        : 'border-brand-200 dark:border-brand-800 bg-brand-50/30 dark:bg-brand-900/10',
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={clsx(
            'h-10 w-10 rounded-xl flex items-center justify-center shrink-0',
            isMobile ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-blue-100 dark:bg-blue-900/30',
          )}>
            {isMobile
              ? <Smartphone className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              : <Wifi className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            }
          </div>
          <div>
            <p className="font-semibold dark:text-white text-sm">
              {sub.location_country}{stateLabel}
              {config?.state_name ? ` · ${config.state_name}` : ''}
            </p>
            <p className="text-xs text-ink-500">
              {sub.protocol.toUpperCase()} · {config?.isp ?? sub.provider}
            </p>
          </div>
        </div>
        <span className={clsx(
          'text-xs px-2 py-0.5 rounded-full font-medium shrink-0',
          isExpired ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
        )}>
          {isExpired ? sub.status : `${daysLeft}d left`}
        </span>
      </div>

      <div className="flex items-center gap-4 text-xs text-ink-500">
        <span>Exp: {formatDate(sub.expires_at)}</span>
        {sub.last_synced_at && <span>Synced: {formatDate(sub.last_synced_at)}</span>}
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <button onClick={onViewCreds} className="btn-outline text-xs flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5" /> Credentials
        </button>
        {!isExpired && (
          <>
            <button onClick={() => rotate.mutate()} disabled={rotate.isPending} className="btn-ghost text-xs px-3 py-2">
              <RotateCcw className="h-3.5 w-3.5" />
              {rotate.isPending ? '…' : 'Rotate'}
            </button>
            <button
              onClick={() => { if (confirm('Cancel this proxy?')) cancel.mutate(); }}
              disabled={cancel.isPending}
              className="btn-ghost text-xs px-3 py-2 text-rose-600"
            >
              {cancel.isPending ? '…' : 'Cancel'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Marketplace Table ────────────────────────────────────────────────────────

function MarketplaceTable({
  items,
  onBuy,
}: {
  items: ProxyListing[];
  walletBalance?: string;
  onBuy: (l: ProxyListing) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-ink-400">
        <Globe className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No proxies match your filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-ink-400 uppercase tracking-wide border-b border-ink-100 dark:border-ink-800">
            <th className="pb-2 pr-4 font-medium">IP</th>
            <th className="pb-2 pr-4 font-medium">Type</th>
            <th className="pb-2 pr-4 font-medium">Protocol</th>
            <th className="pb-2 pr-4 font-medium">Region</th>
            <th className="pb-2 pr-4 font-medium">City</th>
            <th className="pb-2 pr-4 font-medium">ISP</th>
            <th className="pb-2 pr-4 font-medium">Speed</th>
            <th className="pb-2 pr-4 font-medium">Price/30d</th>
            <th className="pb-2 font-medium"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-50 dark:divide-ink-800">
          {items.map((l) => (
            <tr key={l.id} className="hover:bg-ink-50 dark:hover:bg-ink-800/50 transition-colors">
              <td className="py-2.5 pr-4 font-mono text-xs text-ink-500">{l.ip_display ?? '–'}</td>
              <td className="py-2.5 pr-4">
                <div className="flex items-center gap-1.5">
                  {l.connection_type === 'cell'
                    ? <Smartphone className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                    : <Wifi className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  }
                  <span className="capitalize text-xs dark:text-ink-300">{l.connection_type}</span>
                </div>
              </td>
              <td className="py-2.5 pr-4">
                <span className={clsx(
                  'text-xs px-1.5 py-0.5 rounded font-mono font-medium uppercase',
                  l.protocol === 'socks5'
                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
                    : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
                )}>
                  {l.protocol === 'socks5' ? 'SOCKS' : 'HTTP'}
                </span>
              </td>
              <td className="py-2.5 pr-4 text-xs dark:text-ink-300">
                {l.state_code ?? l.country_code}
              </td>
              <td className="py-2.5 pr-4 text-xs dark:text-ink-300">{l.city ?? '–'}</td>
              <td className="py-2.5 pr-4 text-xs text-ink-500 max-w-[140px] truncate">{l.isp ?? '–'}</td>
              <td className="py-2.5 pr-4">
                <div className="flex items-center gap-1">
                  <Zap className={clsx('h-3 w-3 shrink-0', speedColor(l.speed_ms))} />
                  <span className={clsx('text-xs font-medium', speedColor(l.speed_ms))}>{l.speed_ms}ms</span>
                </div>
              </td>
              <td className="py-2.5 pr-4 font-semibold text-ink-900 dark:text-white text-sm">{l.price}</td>
              <td className="py-2.5">
                <button
                  onClick={() => onBuy(l)}
                  className="btn-primary text-xs px-3 py-1.5 whitespace-nowrap"
                >
                  Buy <ArrowRight className="h-3 w-3 ml-1 inline" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Country / State Tab Bar ──────────────────────────────────────────────────

function CountryTabs({
  countries,
  activeCountry,
  activeState,
  onSelect,
}: {
  countries: MarketplaceCountries;
  activeCountry: string;
  activeState: string;
  onSelect: (country: string, state: string) => void;
}) {
  const [showAllStates, setShowAllStates] = useState(false);
  const states      = countries.us_states;
  const visibleStates = showAllStates ? states : states.slice(0, 12);

  return (
    <div className="space-y-2">
      {/* Top-level: US / World */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => onSelect('US', '')}
          className={clsx(
            'px-3 py-1.5 rounded-lg text-xs font-medium border transition',
            activeCountry === 'US'
              ? 'bg-ink-900 dark:bg-white text-white dark:text-ink-900 border-transparent'
              : 'border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300 hover:border-ink-400',
          )}
        >
          US Mix <span className="text-ink-400 dark:text-ink-500 ml-1">{countries.us_total}</span>
        </button>

        {countries.world.map((c) => (
          <button
            key={c.code}
            onClick={() => onSelect(c.code, '')}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-medium border transition',
              activeCountry === c.code && !activeState
                ? 'bg-ink-900 dark:bg-white text-white dark:text-ink-900 border-transparent'
                : 'border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300 hover:border-ink-400',
            )}
          >
            {c.name} <span className="text-ink-400 dark:text-ink-500 ml-1">{c.count}</span>
          </button>
        ))}
      </div>

      {/* US State breakdown */}
      {activeCountry === 'US' && states.length > 0 && (
        <div className="flex gap-1.5 flex-wrap pt-1">
          <button
            onClick={() => onSelect('US', '')}
            className={clsx(
              'px-2.5 py-1 rounded text-xs font-medium transition',
              !activeState
                ? 'bg-brand-500 text-white'
                : 'text-ink-500 hover:text-ink-700 dark:hover:text-ink-300',
            )}
          >
            All
          </button>
          {visibleStates.map((s) => (
            <button
              key={s.code}
              onClick={() => onSelect('US', s.code)}
              className={clsx(
                'px-2.5 py-1 rounded text-xs font-medium transition',
                activeState === s.code
                  ? 'bg-brand-500 text-white'
                  : 'text-ink-500 hover:text-ink-700 dark:hover:text-ink-300',
              )}
            >
              {s.code}
              <span className="text-ink-400 ml-0.5 text-[10px]">-{s.count}</span>
            </button>
          ))}
          {states.length > 12 && (
            <button
              onClick={() => setShowAllStates(!showAllStates)}
              className="px-2.5 py-1 rounded text-xs text-brand-600 dark:text-brand-400 hover:underline"
            >
              {showAllStates ? 'Less' : `+${states.length - 12} more`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type PageTab = 'active' | 'history';

export default function MyProxiesPage() {
  const qc = useQueryClient();
  const [pageTab, setPageTab]         = useState<PageTab>('active');
  const [credsSub, setCredsSub]       = useState<ProxySubscription | null>(null);
  const [buyListing, setBuyListing]   = useState<ProxyListing | null>(null);
  const [showIpModal, setShowIpModal] = useState(false);

  // Marketplace filters
  const [filterCountry, setFilterCountry] = useState('US');
  const [filterState, setFilterState]     = useState('');
  const [filterType, setFilterType]       = useState('');
  const [filterProtocol, setFilterProtocol] = useState('');
  const [page, setPage]                   = useState(1);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [filterCountry, filterState, filterType, filterProtocol]);

  const wallet = useQuery({
    queryKey: ['wallet'],
    queryFn:  () => apiCall<Wallet>({ url: '/wallet' }),
  });

  const whitelist = useQuery({
    queryKey: ['proxy', 'whitelist'],
    queryFn:  () => apiCall<{ ips: string[] }>({ url: '/proxy/whitelist' }),
  });

  const active = useQuery({
    queryKey: ['proxy', 'my'],
    queryFn:  () => apiCall<{ items: ProxySubscription[] }>({ url: '/proxy/my' }),
  });

  const history = useQuery({
    queryKey: ['proxy', 'history'],
    queryFn:  () => apiCall<{ items: ProxySubscription[] }>({ url: '/proxy/my/history' }),
    enabled:  pageTab === 'history',
  });

  const marketplaceCountries = useQuery({
    queryKey: ['proxy', 'marketplace', 'countries'],
    queryFn:  () => apiCall<MarketplaceCountries>({ url: '/proxy/marketplace/countries' }),
  });

  const marketplace = useQuery({
    queryKey: ['proxy', 'marketplace', filterCountry, filterState, filterType, filterProtocol, page],
    queryFn:  () => apiCall<MarketplacePage>({
      url:    '/proxy/marketplace',
      params: {
        country:  filterCountry || undefined,
        state:    filterState   || undefined,
        type:     filterType    || undefined,
        protocol: filterProtocol || undefined,
        per_page: 20,
        page,
      },
    }),
    placeholderData: (prev) => prev,
  });

  const trialStatus = useQuery({
    queryKey: ['proxy', 'trial-status'],
    queryFn:  () => apiCall<ProxyTrialStatus>({ url: '/proxy/trial-status' }),
  });

  const claimTrial = useMutation({
    mutationFn: () => apiCall<ProxySubscription>({ method: 'POST', url: '/proxy/claim-trial' }),
    onSuccess: () => {
      toast.success('Trial proxy activated!');
      qc.invalidateQueries({ queryKey: ['proxy', 'my'] });
      qc.invalidateQueries({ queryKey: ['proxy', 'trial-status'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const activeItems  = active.data?.items ?? [];
  const historyItems = history.data?.items ?? [];
  const mktPage      = marketplace.data;
  const countries    = marketplaceCountries.data;
  const ips          = whitelist.data?.ips ?? [];
  const walletBal    = wallet.data?.balance ?? '$0.00';
  const trial        = trialStatus.data;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight dark:text-white flex items-center gap-2">
            <Globe className="h-6 w-6 text-brand-500" /> My Proxies
          </h1>
          <p className="text-sm text-ink-500 mt-0.5">
            {countries ? `${(countries.us_total + countries.world_total).toLocaleString()} proxies available` : 'Loading…'}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Balance */}
          <div className="flex items-center gap-2 rounded-xl border border-ink-200 dark:border-ink-700 px-3 py-2 text-sm">
            <Shield className="h-4 w-4 text-brand-500" />
            <span className="text-ink-500">Balance:</span>
            <span className="font-semibold dark:text-white">{walletBal}</span>
          </div>

          {/* Your IPs */}
          <button
            onClick={() => setShowIpModal(true)}
            className="flex items-center gap-2 rounded-xl border border-ink-200 dark:border-ink-700 px-3 py-2 text-sm hover:border-brand-400 transition"
          >
            <Wifi className="h-4 w-4 text-ink-400" />
            <span className="text-ink-500">Your IPs:</span>
            <span className="font-medium dark:text-white">{ips[0] ?? 'None'}</span>
            {ips.length > 1 && <span className="text-ink-400 text-xs">+{ips.length - 1}</span>}
            <span className="text-xs text-brand-600 dark:text-brand-400 font-medium">Update</span>
          </button>
        </div>
      </div>

      {/* ── Active / History tabs ──────────────────────────────────── */}
      <div className="flex gap-1 border-b border-ink-200 dark:border-ink-700">
        {([
          ['active',  `Active (${activeItems.filter(s => s.status === 'active').length})`],
          ['history', `History (${historyItems.length})`],
        ] as const).map(([t, label]) => (
          <button key={t} onClick={() => setPageTab(t)}
            className={clsx(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition',
              pageTab === t
                ? 'border-ink-900 dark:border-white text-ink-900 dark:text-white'
                : 'border-transparent text-ink-500',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Active tab ────────────────────────────────────────────── */}
      {pageTab === 'active' && (
        <div className="space-y-6">
          {/* Trial banner */}
          {trial && !trial.claimed && (
            <div className="rounded-xl bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-700 flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                <Zap className="h-4 w-4 text-brand-500 shrink-0" />
                <span className="font-medium text-brand-700 dark:text-brand-300">Try a free 24h proxy</span>
              </div>
              <button onClick={() => claimTrial.mutate()} disabled={claimTrial.isPending}
                className="btn-outline text-brand-600 border-brand-300 text-xs">
                {claimTrial.isPending ? 'Activating…' : 'Claim Free Trial'}
              </button>
            </div>
          )}

          {/* Active proxy list */}
          {active.isLoading && <p className="text-sm text-ink-500">Loading…</p>}

          {activeItems.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3">
                Your Proxies ({activeItems.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {activeItems.map((s) => (
                  <ActiveProxyCard key={s.id} sub={s} onViewCreds={() => setCredsSub(s)} />
                ))}
              </div>
            </div>
          )}

          {/* ── Marketplace ────────────────────────────────────────── */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-sm font-semibold text-ink-700 dark:text-ink-300">
                Available Proxies
                {mktPage && <span className="text-ink-400 font-normal ml-2">({mktPage.meta.total.toLocaleString()} found)</span>}
              </h2>
              {/* Type + Protocol filters */}
              <div className="flex gap-2 flex-wrap">
                <select
                  className="input text-xs py-1.5 pr-7"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="">All Types</option>
                  <option value="wifi">WiFi</option>
                  <option value="cell">Cell</option>
                </select>
                <select
                  className="input text-xs py-1.5 pr-7"
                  value={filterProtocol}
                  onChange={(e) => setFilterProtocol(e.target.value)}
                >
                  <option value="">All Protocols</option>
                  <option value="http">HTTP</option>
                  <option value="socks5">SOCKS5</option>
                </select>
              </div>
            </div>

            {/* Country / State tabs */}
            {countries && (
              <CountryTabs
                countries={countries}
                activeCountry={filterCountry}
                activeState={filterState}
                onSelect={(c, s) => { setFilterCountry(c); setFilterState(s); }}
              />
            )}

            {/* Table */}
            <div className="rounded-xl border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-4">
              {marketplace.isLoading && !mktPage && (
                <p className="text-sm text-ink-400 py-8 text-center">Loading proxies…</p>
              )}
              {mktPage && (
                <MarketplaceTable
                  items={mktPage.items}
                  walletBalance={walletBal}
                  onBuy={(l) => setBuyListing(l)}
                />
              )}

              {/* Pagination */}
              {mktPage && mktPage.meta.last_page > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-ink-100 dark:border-ink-800">
                  <span className="text-xs text-ink-400">
                    Page {mktPage.meta.current_page} of {mktPage.meta.last_page}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={mktPage.meta.current_page === 1}
                      className="btn-ghost p-2 disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(mktPage.meta.last_page, p + 1))}
                      disabled={mktPage.meta.current_page === mktPage.meta.last_page}
                      className="btn-ghost p-2 disabled:opacity-40"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── History tab ───────────────────────────────────────────── */}
      {pageTab === 'history' && (
        <div className="space-y-3">
          {history.isLoading && <p className="text-sm text-ink-400">Loading history…</p>}
          {!history.isLoading && historyItems.length === 0 && (
            <div className="text-center py-12 text-ink-400">
              <WifiOff className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No proxy history yet.</p>
            </div>
          )}
          {historyItems.map((s) => (
            <div key={s.id} className="rounded-xl border border-ink-100 dark:border-ink-800 p-4 flex items-center justify-between gap-4 opacity-75">
              <div>
                <p className="font-medium text-sm dark:text-white">{s.location_country} · {s.protocol.toUpperCase()}</p>
                <p className="text-xs text-ink-500">
                  {s.status} · Expired {formatDate(s.expires_at)}
                </p>
              </div>
              <button onClick={() => setCredsSub(s)} className="btn-ghost text-xs px-3 py-2">
                <Eye className="h-3.5 w-3.5" /> View
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────────────── */}
      {showIpModal && (
        <IpWhitelistModal currentIps={ips} onClose={() => setShowIpModal(false)} />
      )}
      {credsSub && (
        <CredentialsModal sub={credsSub} onClose={() => setCredsSub(null)} />
      )}
      {buyListing && (
        <BuyModal
          listing={buyListing}
          walletBalance={walletBal}
          onClose={() => setBuyListing(null)}
        />
      )}
    </div>
  );
}
