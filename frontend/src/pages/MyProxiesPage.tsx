import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiCall } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type {
  ProxySubscription, ProxyTrialStatus, Wallet,
} from '@/types/api';
import {
  Copy, Eye, EyeOff, RotateCcw, Wifi, WifiOff,
  CheckCircle2, AlertCircle, X,
  Zap,
} from 'lucide-react';
import { clsx } from 'clsx';

// States with very few residential IPs in Decodo's pool — targeting may fall back to any US IP
const LOW_COVERAGE_STATES = new Set(['HI', 'AK', 'WY', 'ND', 'SD', 'VT', 'MT', 'RI', 'DE', 'DC']);

// ─── Static residential geo data (Decodo residential gateway) ─────────────────

const US_STATES: { code: string; name: string }[] = [
  { code: 'AL', name: 'Alabama' },       { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },       { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },    { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },   { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },       { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },        { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },      { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },          { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },      { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },         { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },     { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },      { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },      { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },    { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },{ code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },          { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },        { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },         { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },       { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },    { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },     { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'D.C.' },
];

const WORLD_COUNTRIES: { code: string; name: string }[] = [
  { code: 'GB', name: '🇬🇧 United Kingdom' },
  { code: 'CA', name: '🇨🇦 Canada' },
  { code: 'AU', name: '🇦🇺 Australia' },
  { code: 'DE', name: '🇩🇪 Germany' },
  { code: 'FR', name: '🇫🇷 France' },
  { code: 'NL', name: '🇳🇱 Netherlands' },
  { code: 'JP', name: '🇯🇵 Japan' },
  { code: 'SG', name: '🇸🇬 Singapore' },
  { code: 'IN', name: '🇮🇳 India' },
  { code: 'BR', name: '🇧🇷 Brazil' },
  { code: 'NG', name: '🇳🇬 Nigeria' },
  { code: 'ZA', name: '🇿🇦 South Africa' },
  { code: 'KE', name: '🇰🇪 Kenya' },
  { code: 'GH', name: '🇬🇭 Ghana' },
  { code: 'IT', name: '🇮🇹 Italy' },
  { code: 'ES', name: '🇪🇸 Spain' },
  { code: 'PL', name: '🇵🇱 Poland' },
  { code: 'SE', name: '🇸🇪 Sweden' },
  { code: 'NO', name: '🇳🇴 Norway' },
  { code: 'CH', name: '🇨🇭 Switzerland' },
  { code: 'MX', name: '🇲🇽 Mexico' },
  { code: 'AR', name: '🇦🇷 Argentina' },
  { code: 'KR', name: '🇰🇷 South Korea' },
  { code: 'ID', name: '🇮🇩 Indonesia' },
  { code: 'TR', name: '🇹🇷 Turkey' },
  { code: 'UA', name: '🇺🇦 Ukraine' },
  { code: 'RU', name: '🇷🇺 Russia' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DURATIONS: { days: number; label: string }[] = [
  { days: 1,  label: '1 Day'    },
  { days: 7,  label: '1 Week'   },
  { days: 14, label: '2 Weeks'  },
  { days: 21, label: '3 Weeks'  },
  { days: 30, label: '1 Month'  },
];

const BASE_30D: Record<string, number> = {
  'wifi-http':   1650, 'wifi-socks5':  1950,
  'cell-http':   2250, 'cell-socks5':  2550,
};

function calcPrice(connection: string, protocol: string, days: number, speedUpgrade: boolean): number {
  const daily = Math.ceil((BASE_30D[`${connection}-${protocol}`] ?? 1650) / 30);
  const base  = Math.round(daily * days);
  return speedUpgrade ? Math.round(base * 1.5) : base;
}

function fmt(minor: number): string {
  return '$' + (minor / 100).toFixed(2);
}

function ConfigGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-2">{label}</p>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

function ConfigBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className={clsx('flex-1 py-2 rounded-lg border text-xs font-medium transition',
        active
          ? 'bg-ink-900 dark:bg-white border-ink-900 dark:border-white text-white dark:text-ink-900'
          : 'border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300 hover:border-ink-400',
      )}>
      {label}
    </button>
  );
}

function copyText(text: string, label = 'Copied') {
  navigator.clipboard.writeText(text).then(() => toast.success(label));
}

// ─── IP Whitelist Modal ───────────────────────────────────────────────────────

function IpWhitelistModal({ currentIps, onClose }: { currentIps: string[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [ips, setIps] = useState<string[]>([...currentIps, '', '', '', ''].slice(0, 5));

  const save = useMutation({
    mutationFn: () => apiCall<{ ips: string[] }>({
      method: 'PUT', url: '/proxy/whitelist', data: { ips: ips.filter(Boolean) },
    }),
    onSuccess: () => { toast.success('IP whitelist updated.'); qc.invalidateQueries({ queryKey: ['proxy', 'whitelist'] }); onClose(); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-ink-900 rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-ink-100 dark:border-ink-800">
          <div>
            <h2 className="font-semibold dark:text-white">Your IPs</h2>
            <p className="text-xs text-ink-500 mt-0.5">Up to 5 IPs for authentication</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 text-ink-400"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-2.5">
          {ips.map((ip, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-ink-400 w-4 text-right shrink-0">{i + 1}</span>
              <input
                className="input flex-1 font-mono text-sm"
                placeholder="e.g. 98.97.77.172"
                value={ip}
                onChange={(e) => { const n = [...ips]; n[i] = e.target.value.trim(); setIps(n); }}
              />
            </div>
          ))}
          <p className="text-xs text-ink-400 pt-1">Access is limited to these IPs. You can update them at any time.</p>
        </div>
        <div className="flex gap-3 p-5 pt-0">
          <button onClick={onClose} className="btn-outline flex-1">Cancel</button>
          <button onClick={() => save.mutate()} disabled={save.isPending} className="btn-primary flex-1">
            {save.isPending ? 'Saving…' : 'Update'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Credentials Modal ────────────────────────────────────────────────────────

type TestResult = { success: boolean; ip?: string; country?: string; city?: string | null; speed_ms?: number; error?: string };

function CredentialsModal({ sub, onClose, onSetupIpAuth }: {
  sub: ProxySubscription; onClose: () => void; onSetupIpAuth?: () => void;
}) {
  const [showPw, setShowPw] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['proxy', sub.id, 'credentials'],
    queryFn: () => apiCall<ProxySubscription>({ url: `/proxy/my/${sub.id}`, params: { with_credentials: true } }),
  });

  const testProxy = useMutation({
    mutationFn: () => apiCall<TestResult>({ method: 'POST', url: `/proxy/my/${sub.id}/test` }),
    onSuccess: (r) => setTestResult(r),
    onError: () => setTestResult({ success: false, error: 'Test failed' }),
  });

  const creds = data ?? sub;
  const ipAuthEnabled = data?.ip_auth_enabled ?? sub.ip_auth_enabled;
  const noCredUrl = `${creds.host}:${creds.port}`;
  const proxyUrl = data?.proxy_url ?? `${creds.protocol}://${creds.username}:***@${creds.host}:${creds.port}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-ink-900 rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-ink-100 dark:border-ink-800">
          <div>
            <h2 className="font-semibold dark:text-white">{sub.location_country} Proxy Credentials</h2>
            <p className="text-xs text-ink-500 mt-0.5">{sub.protocol.toUpperCase()} · {sub.provider}</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 text-ink-400"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          {isLoading && <p className="text-sm text-ink-400">Loading…</p>}

          {/* IP Auth banner */}
          {ipAuthEnabled ? (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 p-3">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-1">✓ IP Auth Active — No credentials needed</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-2">Connect from your whitelisted IP using only the host and port below.</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 font-mono text-sm bg-white dark:bg-ink-900 rounded-lg px-3 py-2 border border-emerald-200 dark:border-emerald-700">{noCredUrl}</div>
                <button onClick={() => copyText(noCredUrl, 'Host:Port copied')} className="btn-ghost p-2 text-emerald-600">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <p className="text-[10px] text-emerald-500 mt-1.5">If your IP changes, update "Your IPs" in the header to re-enable this.</p>
            </div>
          ) : (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-3 space-y-2">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                Credentials required — IP Auth not active
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Save your IP address once and connect without username &amp; password from that IP.
              </p>
              {onSetupIpAuth && (
                <button onClick={onSetupIpAuth}
                  className="w-full px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition text-center">
                  Add Your IP Address →
                </button>
              )}
            </div>
          )}

          <CredRow label="Protocol" value={creds.protocol.toUpperCase()} noCopy />
          <CredRow label="IP Address" value={creds.ip ?? creds.host} />
          <CredRow label="Port" value={String(creds.port)} noCopy />
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
                <button onClick={() => copyText(data.proxy_url!, 'URL copied')} className="btn-ghost p-2">
                  <Copy className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          {data?.proxy_url_ip && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-ink-500 uppercase tracking-wide">Proxy URL (IP format)</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 font-mono text-xs bg-ink-50 dark:bg-ink-800 rounded-lg px-3 py-2 break-all">{data.proxy_url_ip}</div>
                <button onClick={() => copyText(data.proxy_url_ip!, 'URL copied')} className="btn-ghost p-2">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-ink-400">Gateway IP — may change every few hours as Decodo rotates servers.</p>
            </div>
          )}
          <p className="text-xs text-ink-400 bg-ink-50 dark:bg-ink-800 rounded-lg px-3 py-2">
            <strong>Exit IP:</strong> Residential proxies route each request through a different IP in the selected region. Use "Check Exit IP" below to see your current exit IP.
          </p>
          <button
            onClick={() => testProxy.mutate()} disabled={testProxy.isPending}
            className="btn-outline text-xs w-full flex items-center justify-center gap-2"
          >
            <Wifi className="h-3.5 w-3.5" />
            {testProxy.isPending ? 'Checking…' : 'Check Exit IP'}
          </button>
          {testResult && (
            <div className={clsx('rounded-lg px-4 py-3 text-sm border',
              testResult.success
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800',
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
        {!noCopy && <button onClick={() => copyText(value, `${label} copied`)} className="btn-ghost p-2"><Copy className="h-4 w-4" /></button>}
      </div>
    </div>
  );
}

// ─── 1 By 1 Modal ────────────────────────────────────────────────────────────

function OneByOneModal({ walletMinor, ips, onClose }: {
  walletMinor: number; ips: string[]; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [connection, setConnection]   = useState<'wifi' | 'cell'>('wifi');
  const [protocol, setProtocol]       = useState<'http' | 'socks5'>('http');
  const [durationIdx, setDurationIdx] = useState(0);
  const [speedUpgrade, setSpeed]      = useState(false);
  const [accessIp, setAccessIp]       = useState(ips[0] ?? '');
  const [country, setCountry]         = useState('US');
  const [state, setState]             = useState('');

  const { data: stateAvailData } = useQuery({
    queryKey: ['proxy', 'us-state-availability'],
    queryFn: () => apiCall<{ states: string[]; from_api: boolean }>({ url: '/proxy/us-state-availability' }),
    staleTime: 10 * 60 * 1000,
  });

  const unavailableState = country === 'US' && state
    ? (stateAvailData?.from_api
        ? !stateAvailData.states.includes(state.toLowerCase())
        : LOW_COVERAGE_STATES.has(state))
    : false;

  const days       = DURATIONS[durationIdx]?.days ?? 1;
  const priceMinor = calcPrice(connection, protocol, days, speedUpgrade);
  const insufficient = walletMinor < priceMinor;

  const buy = useMutation({
    mutationFn: () => apiCall<ProxySubscription[]>({
      method: 'POST', url: '/proxy/social-buy',
      data: {
        connection_type:  connection,
        protocol,
        duration_days:    days,
        quantity:         1,
        country_code:     country || undefined,
        state_code:       state   || undefined,
        speed_upgrade:    speedUpgrade,
        session_type:     'sticky',
        rotation_minutes: 30,
        access_ip:        accessIp || undefined,
      },
    }),
    onSuccess: () => {
      toast.success('Proxy activated!');
      qc.invalidateQueries({ queryKey: ['proxy', 'my'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-ink-900 rounded-2xl shadow-2xl w-full max-w-lg my-auto">
        <div className="p-5 border-b border-ink-100 dark:border-ink-800 flex items-center justify-between">
          <div>
            <h2 className="font-semibold dark:text-white">1 By 1 — Select Location</h2>
            <p className="text-xs text-ink-500 mt-0.5">1 sticky residential proxy · fixed IP per session</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 text-ink-400"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <p className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-1.5">Country</p>
            <select className="input text-sm w-full" value={country} onChange={(e) => { setCountry(e.target.value); setState(''); }}>
              <option value="US">🇺🇸 United States</option>
              {WORLD_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>

          {country === 'US' && (
            <div>
              <p className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-1.5">State</p>
              <select
                className={clsx('input text-sm w-full', unavailableState && 'border-rose-400 dark:border-rose-500')}
                value={state}
                onChange={(e) => setState(e.target.value)}
              >
                <option value="">Any state</option>
                {US_STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select>
              {state && unavailableState && (
                <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400 flex items-start gap-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  No residential IPs available in {US_STATES.find(s2 => s2.code === state)?.name} right now. Please select a different state or choose "Any state".
                </p>
              )}
            </div>
          )}

          <ConfigGroup label="Connection">
            {(['wifi', 'cell'] as const).map((v) => (
              <ConfigBtn key={v} active={connection === v} onClick={() => setConnection(v)} label={v === 'wifi' ? 'WiFi' : 'Cellular'} />
            ))}
          </ConfigGroup>

          <ConfigGroup label="Protocol">
            {(['http', 'socks5'] as const).map((v) => (
              <ConfigBtn key={v} active={protocol === v} onClick={() => setProtocol(v)} label={v === 'socks5' ? 'SOCKS5' : 'HTTPS'} />
            ))}
          </ConfigGroup>

          <div>
            <p className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-2">
              Period · <span className="text-ink-900 dark:text-white">{DURATIONS[durationIdx]?.label}</span>
            </p>
            <input type="range" min={0} max={4} step={1} value={durationIdx}
              onChange={(e) => setDurationIdx(Number(e.target.value))} className="w-full accent-brand-500" />
            <div className="flex justify-between text-[10px] text-ink-400 mt-1">
              {DURATIONS.map(({ days: d, label }, i) => (
                <span key={d} className={clsx(durationIdx === i && 'text-brand-600 font-semibold')}>
                  {label}<br />{fmt(calcPrice(connection, protocol, d, speedUpgrade))}
                </span>
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between rounded-xl border border-ink-200 dark:border-ink-700 p-3 cursor-pointer hover:border-brand-400 transition">
            <div>
              <p className="text-sm font-medium dark:text-white">Double the speed limit</p>
              <p className="text-xs text-ink-500">Upgrade to high speed (+50%)</p>
            </div>
            <input type="checkbox" className="sr-only" checked={speedUpgrade} onChange={(e) => setSpeed(e.target.checked)} />
            <div className={clsx('h-5 w-10 rounded-full transition-colors relative shrink-0',
              speedUpgrade ? 'bg-brand-500' : 'bg-ink-200 dark:bg-ink-700')}>
              <span className={clsx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                speedUpgrade ? 'translate-x-5' : 'translate-x-0.5')} />
            </div>
          </label>

          <div>
            <p className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-1.5">Your Access IP (optional)</p>
            <input className="input font-mono text-sm w-full" placeholder="Your device IP"
              value={accessIp} onChange={(e) => setAccessIp(e.target.value.trim())} />
          </div>

          <div className="rounded-xl bg-ink-50 dark:bg-ink-800 p-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-ink-500">
              <span>1 proxy · {DURATIONS[durationIdx]?.label} · {country}{state ? `-${state}` : ''}</span>
              <span>{connection === 'cell' ? 'Cellular' : 'WiFi'} · {protocol.toUpperCase()}</span>
            </div>
            <div className="flex justify-between font-bold dark:text-white border-t border-ink-200 dark:border-ink-700 pt-1.5">
              <span>Total</span><span>{fmt(priceMinor)}</span>
            </div>
            <div className="flex justify-between text-xs text-ink-400">
              <span>Wallet</span>
              <span className={insufficient ? 'text-rose-600 font-medium' : ''}>{fmt(walletMinor)}</span>
            </div>
          </div>

          {insufficient && (
            <p className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-900/20 rounded-lg px-3 py-2">
              Insufficient balance. Please top up your wallet.
            </p>
          )}
          <p className="text-[11px] text-ink-400">
            Refund within 1 hour if the proxy doesn't work.
          </p>
        </div>

        <div className="flex gap-3 p-5 pt-0">
          <button onClick={onClose} className="btn-outline flex-1">Cancel</button>
          <button onClick={() => buy.mutate()} disabled={buy.isPending || insufficient || unavailableState} className="btn-primary flex-1">
            {buy.isPending ? 'Processing…' : `Buy Now · ${fmt(priceMinor)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Active Proxy Row ─────────────────────────────────────────────────────────

function ActiveProxyRow({ sub, onViewCreds }: { sub: ProxySubscription; onViewCreds: () => void }) {
  const qc     = useQueryClient();
  const [showRefundConfirm, setShowRefundConfirm] = useState(false);

  const toggleAR = useMutation({
    mutationFn: () => apiCall<{ auto_renew: boolean }>({ method: 'POST', url: `/proxy/my/${sub.id}/toggle-renew` }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proxy', 'my'] }),
    onError: (e) => toast.error((e as Error).message),
  });

  const rotate = useMutation({
    mutationFn: () => apiCall<ProxySubscription>({ method: 'POST', url: `/proxy/my/${sub.id}/rotate` }),
    onSuccess: () => { toast.success('Session rotated.'); qc.invalidateQueries({ queryKey: ['proxy', 'my'] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const refund = useMutation({
    mutationFn: () => apiCall<null>({ method: 'POST', url: `/proxy/my/${sub.id}/refund` }),
    onSuccess: () => { toast.success('Refund processed. Funds returned to wallet.'); qc.invalidateQueries({ queryKey: ['proxy', 'my'] }); qc.invalidateQueries({ queryKey: ['wallet'] }); },
    onError: (e) => { toast.error((e as Error).message); setShowRefundConfirm(false); },
  });

  const expires     = new Date(sub.expires_at);
  const daysLeft    = Math.max(0, Math.ceil((expires.getTime() - Date.now()) / 86400000));
  const hoursLeft   = Math.max(0, Math.ceil((expires.getTime() - Date.now()) / 3600000));
  const provisioned = sub.provisioned_at ? new Date(sub.provisioned_at) : null;
  const canRefund   = provisioned && (Date.now() - provisioned.getTime()) < 3600000;
  const stateCode   = sub.state_code;

  return (
    <>
      <tr className="border-b border-ink-50 dark:border-ink-800 hover:bg-ink-50/50 dark:hover:bg-ink-800/30 transition-colors">
        {/* Status dot + IP */}
        <td className="py-3 pr-4">
          <div className="flex items-center gap-2">
            <span className={clsx('h-2 w-2 rounded-full shrink-0 inline-block',
              sub.status === 'active' ? 'bg-emerald-500' : 'bg-rose-400')} />
            <span className="font-mono text-xs dark:text-ink-200">
              {sub.ip ?? sub.host}:{sub.port}
            </span>
          </div>
        </td>
        {/* Protocol */}
        <td className="py-3 pr-4">
          <span className={clsx('text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold uppercase',
            sub.protocol === 'socks5'
              ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
              : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400')}>
            {sub.protocol.toUpperCase()}
          </span>
        </td>
        {/* Location */}
        <td className="py-3 pr-4 text-xs dark:text-ink-300">
          {sub.location_country}{stateCode ? `, ${stateCode}` : ''}{sub.location_city ? `, ${sub.location_city}` : ''}
        </td>
        {/* ISP */}
        <td className="py-3 pr-4 text-xs text-ink-500 max-w-[120px] truncate">
          {sub.isp ?? sub.provider}
        </td>
        {/* Expires */}
        <td className="py-3 pr-4 text-xs">
          <span className={clsx(daysLeft < 2 ? 'text-rose-500 font-medium' : 'text-ink-500')}>
            {hoursLeft < 48 ? `${hoursLeft}h left` : `${daysLeft}d left`}
          </span>
        </td>
        {/* Actions */}
        <td className="py-3 pr-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={onViewCreds} className="text-xs text-brand-600 dark:text-brand-400 hover:underline whitespace-nowrap">
              Credentials
            </button>
            <button onClick={() => rotate.mutate()} disabled={rotate.isPending}
              className="text-xs text-ink-500 hover:text-ink-700 dark:hover:text-ink-300" title="Rotate session">
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            {canRefund && (
              <button onClick={() => setShowRefundConfirm(true)}
                className="text-xs text-rose-600 hover:text-rose-700 font-medium whitespace-nowrap">
                Refund
              </button>
            )}
          </div>
        </td>
        {/* Auto-renew */}
        <td className="py-3">
          <button onClick={() => toggleAR.mutate()} disabled={toggleAR.isPending}
            className="flex items-center gap-1 text-xs font-medium"
            title={sub.auto_renew ? 'Auto-renew ON' : 'Auto-renew OFF'}>
            <div className={clsx('h-4 w-8 rounded-full transition-colors relative',
              sub.auto_renew ? 'bg-emerald-500' : 'bg-ink-200 dark:bg-ink-700')}>
              <span className={clsx('absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform',
                sub.auto_renew ? 'translate-x-4' : 'translate-x-0.5')} />
            </div>
            <span className={clsx('text-[10px]', sub.auto_renew ? 'text-emerald-600' : 'text-ink-400')}>
              AR: {sub.auto_renew ? 'ON' : 'OFF'}
            </span>
          </button>
        </td>
      </tr>
      {/* Refund confirm */}
      {showRefundConfirm && (
        <tr>
          <td colSpan={7} className="p-0">
            <div className="mx-4 mb-2 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 px-4 py-3 flex items-center justify-between gap-4">
              <p className="text-xs text-rose-700 dark:text-rose-300">
                Refund this proxy? Funds will be returned to your wallet immediately.
              </p>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setShowRefundConfirm(false)} className="text-xs text-ink-500 hover:underline">Cancel</button>
                <button onClick={() => refund.mutate()} disabled={refund.isPending}
                  className="btn-primary text-xs px-3 py-1.5 bg-rose-600 hover:bg-rose-700 border-rose-600">
                  {refund.isPending ? '…' : 'Confirm Refund'}
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Country flag emoji helper ─────────────────────────────────────────────────
// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MyProxiesPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab]       = useState<'active' | 'history'>('active');
  const [credsSub, setCredsSub]         = useState<ProxySubscription | null>(null);
  const [showIpModal, setShowIpModal]   = useState(false);
  const [showOneByOne, setShowOneByOne] = useState(false);

  const wallet = useQuery({
    queryKey: ['wallet'],
    queryFn:  () => apiCall<Wallet>({ url: '/wallet' }),
    staleTime: 30_000,
  });

  const whitelist = useQuery({
    queryKey: ['proxy', 'whitelist'],
    queryFn:  () => apiCall<{ ips: string[] }>({ url: '/proxy/whitelist' }),
    staleTime: 60_000,
  });

  const active = useQuery({
    queryKey: ['proxy', 'my'],
    queryFn:  () => apiCall<{ items: ProxySubscription[] }>({ url: '/proxy/my' }),
    staleTime: 15_000,
  });

  const history = useQuery({
    queryKey: ['proxy', 'history'],
    queryFn:  () => apiCall<{ items: ProxySubscription[] }>({ url: '/proxy/my/history' }),
    enabled:  activeTab === 'history',
    staleTime: 60_000,
  });

  const trialStatus = useQuery({
    queryKey: ['proxy', 'trial-status'],
    queryFn:  () => apiCall<ProxyTrialStatus>({ url: '/proxy/trial-status' }),
    staleTime: 300_000,
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

  const now          = Date.now();
  const activeItems  = (active.data?.items ?? []).filter(s => s.status === 'active' && (!s.expires_at || new Date(s.expires_at).getTime() > now));
  const historyItems = history.data?.items ?? [];
  const ips         = whitelist.data?.ips ?? [];
  const walletMinor = wallet.data?.balance_minor ?? 0;
  const walletBal   = wallet.data?.balance ?? '$0.00';
  const trial       = trialStatus.data;

  return (
    <div className="max-w-5xl">

      {/* ── Balance warning ──────────────────────────────────────── */}
      {wallet.data && wallet.data.balance_minor < 5500 && (
        <div className="mb-4 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 text-violet-700 dark:text-violet-300 text-sm text-center py-2.5 px-4">
          Fund your wallet to purchase proxies — current balance: {walletBal}
        </div>
      )}


      {/* ── Plan Card ────────────────────────────────────────────── */}
      <div className="mb-6">
        <button onClick={() => setShowOneByOne(true)}
          className="rounded-xl border border-ink-200 dark:border-ink-700 p-4 text-left hover:border-brand-400 hover:shadow-sm transition bg-white dark:bg-ink-900 w-full sm:w-64">
          <p className="font-semibold text-sm dark:text-white">1 By 1</p>
          <p className="text-xs text-ink-500 mt-0.5">Socks5 / Https · choose location</p>
          <p className="text-[11px] text-ink-400 mt-3">as low as</p>
          <p className="text-lg font-bold dark:text-white leading-tight">$ 0.55</p>
          <p className="text-[11px] text-ink-400">per proxy / day</p>
        </button>
      </div>

      {/* ── Active / History nav ─────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-1 text-sm">
          <button onClick={() => setActiveTab('active')}
            className={clsx('font-medium transition', activeTab === 'active' ? 'text-ink-900 dark:text-white' : 'text-ink-400 hover:text-ink-600 dark:hover:text-ink-300')}>
            Active proxies ({activeItems.length})
          </button>
          <span className="text-ink-300 mx-1">·</span>
          <button onClick={() => setActiveTab('history')}
            className={clsx('font-medium transition', activeTab === 'history' ? 'text-ink-900 dark:text-white' : 'text-ink-400 hover:text-ink-600 dark:hover:text-ink-300')}>
            History ({historyItems.length})
          </button>
        </div>
        <button onClick={() => setShowIpModal(true)}
          className="flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800 dark:hover:text-ink-200 transition">
          <Wifi className="h-3.5 w-3.5 text-ink-400 shrink-0" />
          <span>Your IPs:</span>
          <span className="font-mono text-ink-700 dark:text-ink-300">{ips[0] ?? 'None'}</span>
          {ips.length > 1 && <span className="text-ink-400 text-xs">+{ips.length - 1}</span>}
          <span className="text-brand-500 font-medium ml-0.5">Update</span>
        </button>
      </div>

      {/* ── Trial banner ─────────────────────────────────────────── */}
      {activeTab === 'active' && trial && !trial.claimed && (
        <div className="mb-4 rounded-xl bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-700 flex items-center justify-between gap-3 px-4 py-3">
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

      {/* ── Active proxy table ───────────────────────────────────── */}
      {activeTab === 'active' && activeItems.length > 0 && (
        <div className="mb-5 rounded-xl border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[10px] text-ink-400 uppercase tracking-wide border-b border-ink-100 dark:border-ink-800">
                <th className="px-4 py-2.5 font-medium">Host:Port</th>
                <th className="px-2 py-2.5 font-medium">Protocol</th>
                <th className="px-2 py-2.5 font-medium">Location</th>
                <th className="px-2 py-2.5 font-medium">ISP</th>
                <th className="px-2 py-2.5 font-medium">Expires</th>
                <th className="px-2 py-2.5 font-medium">Actions</th>
                <th className="px-2 py-2.5 font-medium">Auto Renew</th>
              </tr>
            </thead>
            <tbody>
              {activeItems.map((s) => (
                <ActiveProxyRow key={s.id} sub={s} onViewCreds={() => setCredsSub(s)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'active' && active.isLoading && (
        <p className="text-sm text-ink-400 mb-4">Loading…</p>
      )}


      {/* ── History ──────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="space-y-2">
          {history.isLoading && <p className="text-sm text-ink-400">Loading…</p>}
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
                <p className="text-xs text-ink-500 mt-0.5">{s.status} · {formatDate(s.expires_at)}</p>
              </div>
              <button onClick={() => setCredsSub(s)} className="btn-ghost text-xs px-3 py-2">
                <Eye className="h-3.5 w-3.5 mr-1 inline" /> View
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────── */}
      {showIpModal  && <IpWhitelistModal currentIps={ips} onClose={() => setShowIpModal(false)} />}
      {credsSub     && <CredentialsModal sub={credsSub} onClose={() => setCredsSub(null)} onSetupIpAuth={() => { setCredsSub(null); setShowIpModal(true); }} />}
{showOneByOne && <OneByOneModal walletMinor={walletMinor} ips={ips} onClose={() => setShowOneByOne(false)} />}
    </div>
  );
}
