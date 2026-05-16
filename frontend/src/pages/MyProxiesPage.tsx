import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiCall } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { ProxyApiKey, ProxySubscription, ProxyTrialStatus } from '@/types/api';
import {
  Globe, RefreshCw, Copy, Eye, EyeOff, RotateCcw,
  PlusCircle, Ban, Wifi, Key, ChevronDown, ChevronUp,
  Code, AlertCircle, CheckCircle2, Clock,
} from 'lucide-react';
import { clsx } from 'clsx';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  active:    'badge-success',
  expired:   'badge-warning',
  cancelled: 'badge-danger',
  suspended: 'badge-danger',
};

const PROXY_TYPE_LABELS: Record<string, string> = {
  residential_rotating:  'Residential Rotating',
  residential_sticky:    'Residential Sticky',
  residential_static:    'Residential Static',
  datacenter_shared:     'Datacenter Shared',
  datacenter_dedicated:  'Datacenter Dedicated',
  isp_static:            'ISP Static',
  isp_rotating:          'ISP Rotating',
  mobile_rotating:       'Mobile Rotating',
};

function copyToClipboard(text: string, label = 'Copied') {
  navigator.clipboard.writeText(text).then(() => toast.success(label));
}

function BandwidthBar({ used, total }: { used: number; total: number }) {
  if (!total) return null;
  const pct = Math.min(100, (used / total) * 100);
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-ink-500 mb-1">
        <span>{used.toFixed(2)} GB used</span>
        <span>{total} GB total</span>
      </div>
      <div className="h-1.5 rounded-full bg-ink-100 dark:bg-ink-700">
        <div
          className={clsx('h-1.5 rounded-full transition-all', pct > 80 ? 'bg-rose-500' : 'bg-brand-500')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Credentials Modal ────────────────────────────────────────────────────────

function CredentialsModal({ sub, onClose }: { sub: ProxySubscription; onClose: () => void }) {
  const [showPw, setShowPw] = useState(false);
  const [tab, setTab]       = useState<'credentials' | 'examples'>('credentials');

  const { data, isLoading } = useQuery({
    queryKey: ['proxy', sub.id, 'credentials'],
    queryFn:  () => apiCall<ProxySubscription>({
      url: `/proxy/my/${sub.id}`,
      params: { with_credentials: true },
    }),
  });

  const creds  = data ?? sub;
  const proxyUrl = data?.proxy_url ?? `${creds.protocol}://${creds.username}:***@${creds.host}:${creds.port}`;

  const examples = data ? {
    curl: `curl --proxy "${data.proxy_url}" https://httpbin.org/ip`,
    python: `import requests\n\nproxies = {\n    'http': '${data.proxy_url}',\n    'https': '${data.proxy_url}',\n}\nresponse = requests.get('https://httpbin.org/ip', proxies=proxies)\nprint(response.json())`,
    nodejs: `const axios = require('axios');\nconst { HttpsProxyAgent } = require('https-proxy-agent');\n\nconst agent = new HttpsProxyAgent('${data.proxy_url}');\nconst res = await axios.get('https://httpbin.org/ip', { httpsAgent: agent });\nconsole.log(res.data);`,
    php: `$ch = curl_init('https://httpbin.org/ip');\ncurl_setopt($ch, CURLOPT_PROXY, '${data.proxy_url}');\ncurl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\n$result = curl_exec($ch);`,
  } : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-ink-900 rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-ink-100 dark:border-ink-800">
          <div>
            <h2 className="font-semibold dark:text-white">
              {PROXY_TYPE_LABELS[sub.proxy_type] ?? sub.proxy_type}
            </h2>
            <p className="text-xs text-ink-500 mt-0.5">{sub.location_country} · {sub.provider}</p>
          </div>
          <button onClick={onClose} className="btn-ghost text-ink-500 p-1.5">✕</button>
        </div>

        <div className="flex border-b border-ink-100 dark:border-ink-800">
          {(['credentials', 'examples'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={clsx(
                'px-4 py-2.5 text-sm font-medium capitalize border-b-2 -mb-px transition',
                tab === t ? 'border-ink-900 dark:border-white text-ink-900 dark:text-white' : 'border-transparent text-ink-500',
              )}>
              {t}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4">
          {isLoading && <p className="text-sm text-ink-500">Loading credentials…</p>}

          {tab === 'credentials' && (
            <>
              <CredRow label="Host"     value={creds.host}       />
              <CredRow label="Port"     value={String(creds.port)} />
              <CredRow label="Protocol" value={creds.protocol.toUpperCase()} noCopy />
              <CredRow label="Username" value={creds.username}   />
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
                    <button onClick={() => copyToClipboard(data.password!, 'Password copied')} className="btn-ghost p-2">
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <p className="text-xs font-medium text-ink-500 uppercase tracking-wide">Proxy URL</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 font-mono text-xs bg-ink-50 dark:bg-ink-800 rounded-lg px-3 py-2 break-all">
                    {proxyUrl}
                  </div>
                  {data?.proxy_url && (
                    <button onClick={() => copyToClipboard(data.proxy_url!, 'Proxy URL copied')} className="btn-ghost p-2">
                      <Copy className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {tab === 'examples' && examples && (
            <div className="space-y-3">
              {(['curl', 'python', 'nodejs', 'php'] as const).map((lang) => (
                <details key={lang} className="rounded-lg border border-ink-100 dark:border-ink-700">
                  <summary className="flex items-center justify-between px-4 py-2.5 cursor-pointer text-sm font-medium capitalize select-none">
                    <span className="flex items-center gap-2"><Code className="h-4 w-4 text-ink-400" />{lang}</span>
                    <Copy className="h-3.5 w-3.5 text-ink-400" onClick={(e) => { e.preventDefault(); copyToClipboard(examples[lang], `${lang} snippet copied`); }} />
                  </summary>
                  <div className="px-4 pb-4">
                    <pre className="text-xs font-mono bg-ink-50 dark:bg-ink-800 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
                      {examples[lang]}
                    </pre>
                  </div>
                </details>
              ))}
            </div>
          )}

          {tab === 'examples' && !examples && !isLoading && (
            <p className="text-sm text-ink-500">Load credentials first to see examples.</p>
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
        <div className="flex-1 font-mono text-sm bg-ink-50 dark:bg-ink-800 rounded-lg px-3 py-2">{value}</div>
        {!noCopy && (
          <button onClick={() => copyToClipboard(value, `${label} copied`)} className="btn-ghost p-2">
            <Copy className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Renew Modal ──────────────────────────────────────────────────────────────

function RenewModal({ sub, onClose }: { sub: ProxySubscription; onClose: () => void }) {
  const qc     = useQueryClient();
  const [days, setDays] = useState(30);

  const renew = useMutation({
    mutationFn: () => apiCall<ProxySubscription>({
      method: 'POST',
      url:    `/proxy/my/${sub.id}/renew`,
      data:   { duration_days: days },
    }),
    onSuccess: () => {
      toast.success('Proxy renewed successfully.');
      qc.invalidateQueries({ queryKey: ['proxy', 'my'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-ink-900 rounded-xl shadow-xl w-full max-w-sm p-6 space-y-5">
        <h2 className="font-semibold dark:text-white">Renew Proxy</h2>
        <div>
          <label className="label">Duration</label>
          <select className="input" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-outline flex-1">Cancel</button>
          <button onClick={() => renew.mutate()} disabled={renew.isPending} className="btn-primary flex-1">
            {renew.isPending ? 'Processing…' : 'Renew'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── API Keys Tab ─────────────────────────────────────────────────────────────

function ApiKeysTab() {
  const qc             = useQueryClient();
  const [name, setName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);

  const keys = useQuery({
    queryKey: ['proxy', 'api-keys'],
    queryFn:  () => apiCall<ProxyApiKey[]>({ url: '/proxy-keys' }),
  });

  const create = useMutation({
    mutationFn: () => apiCall<{ api_key: ProxyApiKey; raw_key: string }>({
      method: 'POST', url: '/proxy-keys', data: { name },
    }),
    onSuccess: (data) => {
      setNewKey(data.raw_key);
      setName('');
      qc.invalidateQueries({ queryKey: ['proxy', 'api-keys'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => apiCall<null>({ method: 'DELETE', url: `/proxy-keys/${id}` }),
    onSuccess: () => { toast.success('Key revoked.'); qc.invalidateQueries({ queryKey: ['proxy', 'api-keys'] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const rotate = useMutation({
    mutationFn: (id: string) => apiCall<{ raw_key: string }>({ method: 'POST', url: `/proxy-keys/${id}/rotate` }),
    onSuccess: (data) => { setNewKey(data.raw_key); qc.invalidateQueries({ queryKey: ['proxy', 'api-keys'] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-4">
      {newKey && (
        <div className="card-pad border-brand-300 bg-brand-50 dark:bg-brand-900/20 border">
          <p className="text-sm font-medium text-brand-700 dark:text-brand-300 mb-2">
            Save this key — it won't be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono bg-white dark:bg-ink-900 rounded px-3 py-2 break-all">{newKey}</code>
            <button onClick={() => copyToClipboard(newKey, 'API key copied')} className="btn-ghost p-2">
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <button onClick={() => setNewKey(null)} className="text-xs text-ink-500 mt-2">Dismiss</button>
        </div>
      )}

      <div className="flex gap-2">
        <input className="input flex-1" placeholder="Key name (e.g. my-app)" value={name} onChange={(e) => setName(e.target.value)} />
        <button onClick={() => create.mutate()} disabled={!name || create.isPending} className="btn-primary">
          <PlusCircle className="h-4 w-4" /> Create
        </button>
      </div>

      {(keys.data ?? []).length === 0 && !keys.isLoading && (
        <p className="text-sm text-ink-500">No API keys yet.</p>
      )}

      <div className="space-y-3">
        {(keys.data ?? []).map((k) => (
          <div key={k.id} className="card-pad flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-sm dark:text-white">{k.name}</p>
              <p className="text-xs font-mono text-ink-500">{k.key_prefix}…</p>
              <p className="text-xs text-ink-400 mt-0.5">
                Last used: {k.last_used_at ? formatDate(k.last_used_at) : 'Never'}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => rotate.mutate(k.id)} disabled={rotate.isPending} className="btn-outline text-xs">
                <RotateCcw className="h-3.5 w-3.5" /> Rotate
              </button>
              <button onClick={() => revoke.mutate(k.id)} disabled={revoke.isPending} className="btn-ghost text-xs text-rose-600">
                <Ban className="h-3.5 w-3.5" /> Revoke
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Subscription Card ────────────────────────────────────────────────────────

function ProxyCard({
  sub,
  onViewCreds,
  onRenew,
}: {
  sub: ProxySubscription;
  onViewCreds: () => void;
  onRenew: () => void;
}) {
  const qc        = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const rotate = useMutation({
    mutationFn: () => apiCall<ProxySubscription>({ method: 'POST', url: `/proxy/my/${sub.id}/rotate` }),
    onSuccess:  () => { toast.success('Credentials rotated.'); qc.invalidateQueries({ queryKey: ['proxy', 'my'] }); },
    onError:    (e) => toast.error((e as Error).message),
  });

  const cancel = useMutation({
    mutationFn: () => apiCall<null>({ method: 'POST', url: `/proxy/my/${sub.id}/cancel` }),
    onSuccess:  () => { toast.success('Proxy cancelled.'); qc.invalidateQueries({ queryKey: ['proxy', 'my'] }); },
    onError:    (e) => toast.error((e as Error).message),
  });

  const isBandwidthBased = ['residential_rotating', 'residential_sticky', 'residential_static', 'mobile_rotating'].includes(sub.proxy_type);
  const isExpired        = sub.status === 'expired' || sub.status === 'cancelled';

  return (
    <div className={clsx('card-pad space-y-3 border-2', isExpired ? 'border-ink-200 dark:border-ink-700 opacity-75' : 'border-ink-100 dark:border-ink-800')}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm dark:text-white">
              {PROXY_TYPE_LABELS[sub.proxy_type] ?? sub.proxy_type}
            </span>
            {sub.is_trial && <span className="badge-warning text-xs">Trial</span>}
            <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_BADGE[sub.status] ?? 'badge-muted')}>
              {sub.status}
            </span>
          </div>
          <p className="text-xs text-ink-500 mt-0.5">
            {sub.location_country}{sub.location_city ? `, ${sub.location_city}` : ''} · {sub.protocol.toUpperCase()} · {sub.provider}
          </p>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="btn-ghost p-1.5 text-ink-400">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Bandwidth / IP info */}
      {isBandwidthBased ? (
        <BandwidthBar used={sub.bandwidth_gb_used} total={sub.bandwidth_gb_total} />
      ) : (
        <p className="text-xs text-ink-500">{sub.ip_count} IP{sub.ip_count > 1 ? 's' : ''} · {sub.threads} threads</p>
      )}

      {/* Expiry */}
      <p className="text-xs text-ink-500">
        Expires: <span className={clsx('font-medium', new Date(sub.expires_at) < new Date() ? 'text-rose-500' : 'dark:text-ink-300')}>
          {formatDate(sub.expires_at)}
        </span>
      </p>

      {/* Expanded details */}
      {expanded && (
        <div className="pt-2 border-t border-ink-100 dark:border-ink-800 space-y-2">
          <div className="grid grid-cols-2 gap-2 text-xs text-ink-600 dark:text-ink-400">
            <div>Host: <span className="font-mono text-ink-900 dark:text-ink-200">{sub.host}</span></div>
            <div>Port: <span className="font-mono text-ink-900 dark:text-ink-200">{sub.port}</span></div>
            <div>User: <span className="font-mono text-ink-900 dark:text-ink-200 break-all">{sub.username}</span></div>
            {sub.last_synced_at && (
              <div>Synced: {formatDate(sub.last_synced_at)}</div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-1">
        <button onClick={onViewCreds} className="btn-outline text-xs flex-1 min-w-[90px]">
          <Eye className="h-3.5 w-3.5" /> Credentials
        </button>
        {!isExpired && (
          <>
            <button onClick={() => rotate.mutate()} disabled={rotate.isPending} className="btn-ghost text-xs px-3 py-2">
              <RotateCcw className="h-3.5 w-3.5" />
              {rotate.isPending ? '…' : 'Rotate'}
            </button>
            {!sub.is_trial && (
              <button onClick={onRenew} className="btn-ghost text-xs px-3 py-2 text-brand-600">
                <RefreshCw className="h-3.5 w-3.5" /> Renew
              </button>
            )}
            <button onClick={() => { if (confirm('Cancel this proxy?')) cancel.mutate(); }}
              disabled={cancel.isPending} className="btn-ghost text-xs px-3 py-2 text-rose-600">
              <Ban className="h-3.5 w-3.5" />
              {cancel.isPending ? '…' : 'Cancel'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type PageTab = 'proxies' | 'api-keys';

export default function MyProxiesPage() {
  const navigate               = useNavigate();
  const qc                     = useQueryClient();
  const [tab, setTab]          = useState<PageTab>('proxies');
  const [credsSub, setCredsSub] = useState<ProxySubscription | null>(null);
  const [renewSub, setRenewSub] = useState<ProxySubscription | null>(null);

  const subscriptions = useQuery({
    queryKey: ['proxy', 'my'],
    queryFn:  () => apiCall<{ items: ProxySubscription[] }>({ url: '/proxy/my' }),
  });

  const trialStatus = useQuery({
    queryKey: ['proxy', 'trial-status'],
    queryFn:  () => apiCall<ProxyTrialStatus>({ url: '/proxy/trial-status' }),
  });

  const claimTrial = useMutation({
    mutationFn: () => apiCall<ProxySubscription>({ method: 'POST', url: '/proxy/claim-trial' }),
    onSuccess:  () => {
      toast.success('Trial proxy activated! Check your proxy list.');
      qc.invalidateQueries({ queryKey: ['proxy', 'my'] });
      qc.invalidateQueries({ queryKey: ['proxy', 'trial-status'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const items   = subscriptions.data?.items ?? [];
  const active  = items.filter((s) => s.status === 'active');
  const expired = items.filter((s) => s.status !== 'active');
  const trial   = trialStatus.data;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight dark:text-white flex items-center gap-2">
            <Globe className="h-6 w-6 text-brand-500" /> My Proxies
          </h1>
          <p className="text-sm text-ink-600 dark:text-ink-400 mt-1">Manage your active proxy subscriptions.</p>
        </div>
        <div className="flex gap-3">
          {trial && !trial.claimed && trial.eligible && (
            <button onClick={() => claimTrial.mutate()} disabled={claimTrial.isPending}
              className="btn-outline text-brand-600 border-brand-300">
              <Wifi className="h-4 w-4" />
              {claimTrial.isPending ? 'Activating…' : 'Free Trial'}
            </button>
          )}
          <button onClick={() => navigate('/services')} className="btn-primary">
            <PlusCircle className="h-4 w-4" /> Buy Proxy
          </button>
        </div>
      </div>

      {/* Trial banner */}
      {trial?.claimed && trial.expires_at && new Date(trial.expires_at) > new Date() && (
        <div className="card-pad bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-brand-500 flex-shrink-0" />
          <div className="text-sm">
            <span className="font-medium text-brand-700 dark:text-brand-300">Trial active</span>
            <span className="text-brand-600 dark:text-brand-400 ml-2">Expires {formatDate(trial.expires_at)}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-ink-200 dark:border-ink-700">
        {([['proxies', 'Proxies', Globe], ['api-keys', 'API Keys', Key]] as const).map(([t, label, Icon]) => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition',
              tab === t ? 'border-ink-900 dark:border-white text-ink-900 dark:text-white' : 'border-transparent text-ink-500',
            )}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'proxies' && (
        <div className="space-y-6">
          {subscriptions.isLoading && (
            <p className="text-sm text-ink-500">Loading your proxies…</p>
          )}

          {!subscriptions.isLoading && items.length === 0 && (
            <div className="card-pad text-center py-12">
              <Globe className="h-10 w-10 text-ink-300 mx-auto mb-3" />
              <p className="font-medium dark:text-white">No proxies yet</p>
              <p className="text-sm text-ink-500 mt-1">Purchase a proxy or claim your free trial to get started.</p>
              <div className="flex justify-center gap-3 mt-4">
                {trial && !trial.claimed && trial.eligible && (
                  <button onClick={() => claimTrial.mutate()} disabled={claimTrial.isPending}
                    className="btn-outline border-brand-300 text-brand-600">
                    Free Trial
                  </button>
                )}
                <button onClick={() => navigate('/services')} className="btn-primary">Buy Proxy</button>
              </div>
            </div>
          )}

          {active.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" /> Active ({active.length})
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {active.map((sub) => (
                  <ProxyCard key={sub.id} sub={sub}
                    onViewCreds={() => setCredsSub(sub)}
                    onRenew={() => setRenewSub(sub)}
                  />
                ))}
              </div>
            </section>
          )}

          {expired.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-ink-700 dark:text-ink-300 mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-ink-400" /> Inactive ({expired.length})
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {expired.map((sub) => (
                  <ProxyCard key={sub.id} sub={sub}
                    onViewCreds={() => setCredsSub(sub)}
                    onRenew={() => setRenewSub(sub)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {tab === 'api-keys' && (
        <div className="space-y-4">
          <div className="card-pad bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              API keys grant programmatic access to your proxies. Keep them secret and rotate them if compromised.
            </p>
          </div>
          <ApiKeysTab />
        </div>
      )}

      {/* Credentials modal */}
      {credsSub && <CredentialsModal sub={credsSub} onClose={() => setCredsSub(null)} />}

      {/* Renew modal */}
      {renewSub && <RenewModal sub={renewSub} onClose={() => setRenewSub(null)} />}
    </div>
  );
}
