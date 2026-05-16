import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiCall, newIdempotencyKey } from '@/lib/api';
import type { Paginated, Service, ServiceOrder } from '@/types/api';
import {
  Smartphone, Globe, CreditCard, Receipt, Phone,
  RefreshCw, Copy, Search, ChevronDown, ChevronUp,
  CheckCircle2, Clock, XCircle, Gift, Wifi, QrCode, ExternalLink,
  TrendingUp, Users, Server, ArrowRight,
} from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate, formatMoney } from '@/lib/format';
import { clsx } from 'clsx';

// ─── Service logo map (slug → clearbit domain) ───────────────────────────────

const SERVICE_LOGO: Record<string, string> = {
  telegram:    'telegram.org',
  whatsapp:    'whatsapp.com',
  facebook:    'facebook.com',
  instagram:   'instagram.com',
  twitter:     'x.com',
  tiktok:      'tiktok.com',
  snapchat:    'snapchat.com',
  discord:     'discord.com',
  viber:       'viber.com',
  wechat:      'wechat.com',
  linkedin:    'linkedin.com',
  line:        'line.me',
  google:      'google.com',
  apple:       'apple.com',
  microsoft:   'microsoft.com',
  amazon:      'amazon.com',
  netflix:     'netflix.com',
  spotify:     'spotify.com',
  uber:        'uber.com',
  airbnb:      'airbnb.com',
  steam:       'store.steampowered.com',
  yahoo:       'yahoo.com',
  tinder:      'tinder.com',
  bumble:      'bumble.com',
  badoo:       'badoo.com',
  hinge:       'hinge.co',
  match:       'match.com',
  pof:         'pof.com',
  okcupid:     'okcupid.com',
  happn:       'happn.com',
  lovoo:       'lovoo.com',
  zoosk:       'zoosk.com',
  meetic:      'meetic.com',
  grindr:      'grindr.com',
  tagged:      'tagged.com',
  meetme:      'meetme.com',
  skout:       'skout.com',
  mamba:       'mamba.ru',
  paypal:      'paypal.com',
  binance:     'binance.com',
  coinbase:    'coinbase.com',
  bybit:       'bybit.com',
  kucoin:      'kucoin.com',
  okx:         'okx.com',
  kraken:      'kraken.com',
  bitget:      'bitget.com',
  bolt:        'bolt.eu',
  jumia:       'jumia.com',
  doordash:    'doordash.com',
  lyft:        'lyft.com',
  openai:      'openai.com',
};

function ServiceLogo({ slug, size = 20 }: { slug: string; size?: number }) {
  const domain = SERVICE_LOGO[slug];
  if (!domain) return null;
  return (
    <img
      src={`https://logo.clearbit.com/${domain}`}
      alt={slug}
      width={size}
      height={size}
      className="rounded-sm object-contain flex-shrink-0"
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
    />
  );
}

// ─── Provider service list (for virtual numbers) ──────────────────────────────

const PROVIDER_SERVICES = [
  { group: 'Messaging & Social', items: [
    { value: 'telegram', label: 'Telegram' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'twitter', label: 'X (Twitter)' },
    { value: 'tiktok', label: 'TikTok' },
    { value: 'snapchat', label: 'Snapchat' },
    { value: 'discord', label: 'Discord' },
    { value: 'viber', label: 'Viber' },
    { value: 'wechat', label: 'WeChat' },
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'line', label: 'Line' },
  ]},
  { group: 'Tech & Streaming', items: [
    { value: 'google', label: 'Google' },
    { value: 'apple', label: 'Apple' },
    { value: 'microsoft', label: 'Microsoft' },
    { value: 'amazon', label: 'Amazon' },
    { value: 'netflix', label: 'Netflix' },
    { value: 'spotify', label: 'Spotify' },
    { value: 'uber', label: 'Uber' },
    { value: 'airbnb', label: 'Airbnb' },
    { value: 'steam', label: 'Steam' },
    { value: 'yahoo', label: 'Yahoo' },
  ]},
  { group: 'Dating Apps', items: [
    { value: 'tinder',    label: 'Tinder' },
    { value: 'bumble',    label: 'Bumble' },
    { value: 'badoo',     label: 'Badoo' },
    { value: 'hinge',     label: 'Hinge' },
    { value: 'match',     label: 'Match.com' },
    { value: 'pof',       label: 'Plenty of Fish (POF)' },
    { value: 'okcupid',   label: 'OkCupid' },
    { value: 'happn',     label: 'Happn' },
    { value: 'lovoo',     label: 'LOVOO' },
    { value: 'zoosk',     label: 'Zoosk' },
    { value: 'meetic',    label: 'Meetic' },
    { value: 'grindr',    label: 'Grindr' },
    { value: 'tagged',    label: 'Tagged' },
    { value: 'meetme',    label: 'MeetMe' },
    { value: 'skout',     label: 'Skout' },
    { value: 'mamba',     label: 'Mamba' },
  ]},
  { group: 'Finance & Crypto', items: [
    { value: 'paypal', label: 'PayPal' },
    { value: 'binance', label: 'Binance' },
    { value: 'coinbase', label: 'Coinbase' },
    { value: 'bybit', label: 'Bybit' },
    { value: 'kucoin', label: 'KuCoin' },
    { value: 'okx', label: 'OKX' },
    { value: 'kraken', label: 'Kraken' },
    { value: 'bitget', label: 'Bitget' },
  ]},
  { group: 'Delivery & Ride', items: [
    { value: 'uber', label: 'Uber' },
    { value: 'bolt', label: 'Bolt' },
    { value: 'jumia', label: 'Jumia Food' },
    { value: 'doordash', label: 'DoorDash' },
    { value: 'lyft', label: 'Lyft' },
  ]},
  { group: 'Other', items: [
    { value: 'any', label: 'Any / Other' },
  ]},
];

const ALL_PROVIDER_SERVICES = PROVIDER_SERVICES.flatMap((g) => g.items);

const PROVIDER_UNAVAILABLE: Record<string, string[]> = {
  smspool: ['whatsapp'],
};


// ─── Virtual number price row ─────────────────────────────────────────────────

type VNumberPriceRow = {
  country_code:  string;
  country_label: string;
  flag:          string;
  count:         number;
  price_usd:     number;
};

// ─── eSIM ─────────────────────────────────────────────────────────────────────

type EsimPackage = {
  package_id: string;
  title: string;
  data: string | null;
  days: number;
  price: number;
  operator: string | null;
  countries: string[];
};

const ESIM_COUNTRY_OPTIONS = [
  { code: 'US', label: '🇺🇸 United States' },
  { code: 'GB', label: '🇬🇧 United Kingdom' },
  { code: 'NG', label: '🇳🇬 Nigeria' },
  { code: 'GH', label: '🇬🇭 Ghana' },
  { code: 'KE', label: '🇰🇪 Kenya' },
  { code: 'ZA', label: '🇿🇦 South Africa' },
  { code: 'DE', label: '🇩🇪 Germany' },
  { code: 'FR', label: '🇫🇷 France' },
  { code: 'CA', label: '🇨🇦 Canada' },
  { code: 'AU', label: '🇦🇺 Australia' },
  { code: 'JP', label: '🇯🇵 Japan' },
  { code: 'IN', label: '🇮🇳 India' },
  { code: 'AE', label: '🇦🇪 UAE' },
  { code: 'SG', label: '🇸🇬 Singapore' },
  { code: 'TH', label: '🇹🇭 Thailand' },
  { code: 'BR', label: '🇧🇷 Brazil' },
  { code: 'MX', label: '🇲🇽 Mexico' },
  { code: 'TR', label: '🇹🇷 Turkey' },
  { code: 'EG', label: '🇪🇬 Egypt' },
  { code: 'PH', label: '🇵🇭 Philippines' },
];

// ─── Gift card denominations ──────────────────────────────────────────────────

// Gift card denominations
const GIFT_DENOMINATIONS = [5, 10, 15, 25, 50, 100, 200];

// Utility bill types
const UTILITY_NETWORKS: Record<string, string[]> = {
  utility_airtime_ng:    ['MTN', 'Airtel', 'Glo', '9mobile'],
  utility_data_ng:       ['MTN', 'Airtel', 'Glo', '9mobile'],
  utility_electricity:   ['EKEDC', 'IKEDC', 'AEDC', 'PHEDC', 'EEDC', 'BEDC', 'KEDCO'],
  utility_dstv:          ['DSTV', 'GOtv', 'Showmax'],
  utility_startimes:     ['StarTimes'],
};

type DataPlan = { item_code: string; biller_code: string; name: string; amount: number };

// Icons per category
const CAT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  virtual_number: Smartphone,
  esim:           Globe,
  giftcard:       Gift,
  utility:        Receipt,
  smm:            TrendingUp,
  smm_accounts:   Users,
  proxy:          Server,
};

const CAT_LABELS: Record<string, string> = {
  virtual_number: 'Virtual Numbers',
  esim:           'eSIM',
  giftcard:       'Gift Cards',
  utility:        'Utility Bills',
  smm:            'Social Media Boost',
  smm_accounts:   'Social Media Accounts',
  proxy:          'Proxy Services',
};

// SMM types
type SmmService = {
  service_id:   number;
  name:         string;
  category:     string;
  rate_per_1k:  number;
  price_per_1k: number;
  min:          number;
  max:          number;
  type:         string;
  refill:       boolean;
  cancel:       boolean;
};

const SMM_PLATFORMS_BOOST = [
  { value: 'instagram', label: '📸 Instagram' },
  { value: 'youtube',   label: '▶️ YouTube' },
  { value: 'tiktok',    label: '🎵 TikTok' },
  { value: 'twitter',   label: '🐦 Twitter/X' },
  { value: 'facebook',  label: '📘 Facebook' },
  { value: 'telegram',  label: '✈️ Telegram' },
  { value: 'snapchat',  label: '👻 Snapchat' },
  { value: 'spotify',   label: '🎧 Spotify' },
  { value: 'linkedin',  label: '💼 LinkedIn' },
  { value: 'threads',   label: '🧵 Threads' },
  { value: 'all',       label: '🌐 All' },
];

const SMM_PLATFORMS_ACCOUNTS = [
  { value: 'instagram', label: '📸 Instagram' },
  { value: 'facebook',  label: '📘 Facebook' },
  { value: 'twitter',   label: '🐦 Twitter/X' },
  { value: 'tiktok',    label: '🎵 TikTok' },
  { value: 'youtube',   label: '▶️ YouTube' },
  { value: 'telegram',  label: '✈️ Telegram' },
  { value: 'all',       label: '🌐 All' },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ServicesPage() {
  const qc = useQueryClient();
  const [selected, setSelected]           = useState<Service | null>(null);
  const [serviceSearch, setServiceSearch] = useState('');
  const [providerSvc, setProviderSvc]     = useState('telegram');
  const [country, setCountry]             = useState('nigeria');
  const [denomination, setDenomination]   = useState(25);
  const [network, setNetwork]             = useState('');
  const [meterNumber, setMeterNumber]     = useState('');
  const [phoneNumber, setPhoneNumber]     = useState('');
  const [smartcardNumber, setSmartcardNumber] = useState('');
  const [billAmount, setBillAmount]       = useState('500');
  const [dataPlan, setDataPlan]           = useState('');
  const [dataBillerCode, setDataBillerCode] = useState('');
  const [meterType, setMeterType]         = useState<'prepaid'|'postpaid'>('prepaid');
  const [esimPackageId, setEsimPackageId]   = useState('');
  const [smmServiceId, setSmmServiceId]     = useState<number | null>(null);
  const [smmLink, setSmmLink]               = useState('');
  const [smmQuantity, setSmmQuantity]       = useState(100);
  const [ordersExpanded, setOrdersExpanded] = useState(true);

  // Proxy purchase state
  const [proxyType, setProxyType]           = useState('residential_rotating');
  const [proxyProtocol, setProxyProtocol]   = useState('http');
  const [proxyCountry, setProxyCountry]     = useState('US');
  const [proxyBandwidth, setProxyBandwidth] = useState(1);
  const [proxyIpCount, setProxyIpCount]     = useState(1);
  const [proxyDuration, setProxyDuration]   = useState(30);
  const [proxySession, setProxySession]     = useState('rotating');

  const services = useQuery({
    queryKey: ['services'],
    queryFn: () => apiCall<Service[]>({ url: '/services' }),
  });

  const orders = useQuery({
    queryKey: ['orders'],
    queryFn: () => apiCall<Paginated<ServiceOrder>>({ url: '/orders', params: { per_page: 15 } }),
  });

  // Group active services by category
  const grouped = (services.data ?? []).reduce((acc: Record<string, Service[]>, s) => {
    acc[s.category] ??= [];
    acc[s.category].push(s);
    return acc;
  }, {});

  const purchase = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('No service selected.');

      // Build request payload based on service category
      const baseData: Record<string, unknown> = { service_code: selected.code };

      if (selected.category === 'virtual_number') {
        baseData.service = providerSvc;
        baseData.country = country;
      } else if (selected.category === 'utility') {
        baseData.amount = billAmount;
        baseData.network = network;
        if (phoneNumber) baseData.phone_number = phoneNumber;
        if (meterNumber) baseData.meter_number = meterNumber;
        if (smartcardNumber) baseData.smartcard_number = smartcardNumber;
        if (dataPlan) baseData.plan_code = dataPlan;
        if (dataBillerCode) baseData.biller_code = dataBillerCode;
        if (selected.code === 'utility_electricity') baseData.meter_type = meterType;
      } else if (selected.category === 'giftcard') {
        baseData.denomination = denomination;
      } else if (selected.category === 'esim') {
        baseData.package_id = esimPackageId;
      } else if (selected.category === 'smm' || selected.category === 'smm_accounts') {
        baseData.smm_service_id = smmServiceId;
        baseData.link           = smmLink;
        baseData.quantity       = smmQuantity;
      } else if (selected.category === 'proxy') {
        baseData.proxy_type    = proxyType;
        baseData.protocol      = proxyProtocol;
        baseData.country_code  = proxyCountry;
        baseData.duration_days = proxyDuration;
        baseData.session_type  = proxySession;
        if (['residential_rotating','residential_sticky','residential_static','mobile_rotating'].includes(proxyType)) {
          baseData.bandwidth_gb = proxyBandwidth;
        } else {
          baseData.ip_count = proxyIpCount;
        }
      }

      return apiCall<ServiceOrder>({
        url: '/services/purchase',
        method: 'POST',
        headers: { 'Idempotency-Key': newIdempotencyKey() },
        data: baseData,
      });
    },
    onSuccess(order) {
      const delivery = order.delivery as Record<string, unknown> | null;
      if (selected?.category === 'proxy') {
        toast.success('Proxy provisioned! View it in My Proxies.');
        qc.invalidateQueries({ queryKey: ['proxy', 'my'] });
      } else if (delivery?.phone_number) {
        toast.success(`Number assigned: ${delivery.phone_number}`);
      } else if (delivery?.token) {
        toast.success(`Token: ${delivery.token} — check your orders for details.`);
      } else if (delivery?.note) {
        toast.success(String(delivery.note));
      } else {
        toast.success('Order placed successfully!');
      }
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
    },
    onError(err) {
      const msg = (err as Error).message ?? 'Purchase failed.';
      if (msg.includes('Insufficient')) {
        toast.error('Insufficient wallet balance. Please top up first.');
      } else if (msg.includes('available') || msg.includes('stock')) {
        toast.error('Not available for this selection. Try a different country or service.');
      } else {
        toast.error(msg);
      }
    },
  });

  function selectService(svc: Service) {
    setSelected(svc === selected ? null : svc);
    // Set defaults based on category
    if (svc.category === 'giftcard') setDenomination(25);
    if (UTILITY_NETWORKS[svc.code]) setNetwork(UTILITY_NETWORKS[svc.code][0]);
  }

  const filteredServices = serviceSearch
    ? ALL_PROVIDER_SERVICES.filter((s) => s.label.toLowerCase().includes(serviceSearch.toLowerCase()))
    : null;

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight dark:text-white">Services</h1>
        <p className="text-sm text-ink-600 dark:text-ink-400 mt-1">
          Virtual numbers, eSIM, gift cards and utility bills — all from your wallet.
        </p>
      </div>

      {/* Service categories */}
      {Object.entries(grouped).map(([category, items]) => {
        const Icon = CAT_ICONS[category] ?? CreditCard;
        const label = CAT_LABELS[category] ?? category;
        const activeItems = items.filter((s) => s.is_active);
        const comingSoon  = items.filter((s) => !s.is_active);

        return (
          <section key={category}>
            <h2 className="font-semibold text-ink-800 dark:text-ink-200 mb-3 flex items-center gap-2">
              <Icon className="h-4 w-4 text-brand-600" /> {label}
            </h2>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeItems.map((svc) => (
                <button key={svc.code} onClick={() => selectService(svc)}
                  className={clsx(
                    'card-pad text-left transition border-2',
                    selected?.code === svc.code
                      ? 'border-brand-500 shadow-glow'
                      : 'border-ink-100 hover:border-brand-300 dark:border-ink-700 dark:hover:border-brand-600',
                  )}>
                  <div className="flex items-center justify-between">
                    <div className="font-semibold dark:text-white">{svc.name}</div>
                    <span className="badge-success">Active</span>
                  </div>
                  <p className="text-xs text-ink-600 dark:text-ink-400 mt-1.5">{svc.description}</p>
                </button>
              ))}
              {comingSoon.map((svc) => (
                <div key={svc.code}
                  className="card-pad opacity-60 border-2 border-dashed border-ink-200 dark:border-ink-700">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold dark:text-white">{svc.name}</div>
                    <span className="badge-muted">Coming soon</span>
                  </div>
                  <p className="text-xs text-ink-500 dark:text-ink-500 mt-1.5">{svc.description}</p>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/* Purchase form — rendered based on selected service category */}
      {selected && (
        <div className="card-pad dark:bg-ink-900">
          {/* Virtual Numbers */}
          {selected.category === 'virtual_number' && (
            <VirtualNumberForm
              service={selected}
              serviceSearch={serviceSearch}
              setServiceSearch={setServiceSearch}
              filteredServices={filteredServices}
              providerSvc={providerSvc}
              setProviderSvc={setProviderSvc}
              country={country}
              setCountry={setCountry}
              onPurchase={() => purchase.mutate()}
              isPending={purchase.isPending}
            />
          )}

          {/* Gift Cards */}
          {selected.category === 'giftcard' && (
            <GiftCardForm
              service={selected}
              denomination={denomination}
              setDenomination={setDenomination}
              onPurchase={() => purchase.mutate()}
              isPending={purchase.isPending}
            />
          )}

          {/* Utility Bills */}
          {selected.category === 'utility' && (
            <UtilityForm
              service={selected}
              billAmount={billAmount}
              setBillAmount={setBillAmount}
              network={network}
              setNetwork={(n) => { setNetwork(n); setDataPlan(''); setDataBillerCode(''); }}
              phoneNumber={phoneNumber}
              setPhoneNumber={setPhoneNumber}
              meterNumber={meterNumber}
              setMeterNumber={setMeterNumber}
              smartcardNumber={smartcardNumber}
              setSmartcardNumber={setSmartcardNumber}
              dataPlan={dataPlan}
              setDataPlan={setDataPlan}
              setDataBillerCode={setDataBillerCode}
              meterType={meterType}
              setMeterType={setMeterType}
              onPurchase={() => purchase.mutate()}
              isPending={purchase.isPending}
            />
          )}

          {/* eSIM */}
          {selected.category === 'esim' && (
            <EsimForm
              service={selected}
              packageId={esimPackageId}
              setPackageId={setEsimPackageId}
              onPurchase={() => purchase.mutate()}
              isPending={purchase.isPending}
            />
          )}

          {/* SMM Boost */}
          {selected.category === 'smm' && (
            <SmmBoostForm
              service={selected}
              smmServiceId={smmServiceId}
              setSmmServiceId={setSmmServiceId}
              link={smmLink}
              setLink={setSmmLink}
              quantity={smmQuantity}
              setQuantity={setSmmQuantity}
              onPurchase={() => purchase.mutate()}
              isPending={purchase.isPending}
            />
          )}

          {/* SMM Accounts */}
          {selected.category === 'smm_accounts' && (
            <SmmAccountsForm
              service={selected}
              smmServiceId={smmServiceId}
              setSmmServiceId={setSmmServiceId}
              quantity={smmQuantity}
              setQuantity={setSmmQuantity}
              onPurchase={() => purchase.mutate()}
              isPending={purchase.isPending}
            />
          )}

          {/* Proxy */}
          {selected.category === 'proxy' && (
            <ProxyPurchaseForm
              service={selected}
              proxyType={proxyType}           setProxyType={setProxyType}
              protocol={proxyProtocol}        setProtocol={setProxyProtocol}
              countryCode={proxyCountry}      setCountryCode={setProxyCountry}
              bandwidthGb={proxyBandwidth}    setBandwidthGb={setProxyBandwidth}
              ipCount={proxyIpCount}          setIpCount={setProxyIpCount}
              durationDays={proxyDuration}    setDurationDays={setProxyDuration}
              sessionType={proxySession}      setSessionType={setProxySession}
              onPurchase={() => purchase.mutate()}
              isPending={purchase.isPending}
            />
          )}
        </div>
      )}

      {/* Recent orders */}
      <div className="card-pad dark:bg-ink-900">
        <button
          onClick={() => setOrdersExpanded((v) => !v)}
          className="w-full flex items-center justify-between mb-4"
        >
          <h2 className="font-semibold dark:text-white">Recent orders</h2>
          <div className="flex items-center gap-2">
            <button onClick={(e) => { e.stopPropagation(); orders.refetch(); }} className="btn-ghost text-xs p-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            {ordersExpanded ? <ChevronUp className="h-4 w-4 text-ink-500" /> : <ChevronDown className="h-4 w-4 text-ink-500" />}
          </div>
        </button>

        {ordersExpanded && (
          <>
            {orders.isLoading ? (
              <div className="text-sm text-ink-500 py-4 text-center">Loading…</div>
            ) : (orders.data?.items ?? []).length === 0 ? (
              <div className="text-sm text-ink-500 dark:text-ink-400 py-6 text-center">
                No orders yet. Buy a service above to get started.
              </div>
            ) : (
              <ul className="divide-y divide-ink-100 dark:divide-ink-800">
                {orders.data!.items.map((o) => (
                  <OrderRow key={o.id} order={o} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Virtual Number Form ──────────────────────────────────────────────────────

function VirtualNumberForm({
  service, serviceSearch, setServiceSearch, filteredServices,
  providerSvc, setProviderSvc, country, setCountry, onPurchase, isPending,
}: {
  service: Service;
  serviceSearch: string;
  setServiceSearch: (v: string) => void;
  filteredServices: { value: string; label: string }[] | null;
  providerSvc: string;
  setProviderSvc: (v: string) => void;
  country: string;
  setCountry: (v: string) => void;
  onPurchase: () => void;
  isPending: boolean;
}) {
  const priceQuery = useQuery({
    queryKey: ['virtual-number-prices', service.provider, providerSvc],
    queryFn: () => apiCall<{ items: VNumberPriceRow[] }>({
      url: '/services/virtual-number-prices',
      params: { provider: service.provider, service: providerSvc },
    }),
    staleTime: 5 * 60 * 1000,
    enabled: providerSvc !== 'any',
  });

  const rows = priceQuery.data?.items ?? [];
  const selectedRow = rows.find((r) => r.country_code === country);

  function handleAppChange(value: string) {
    setProviderSvc(value);
    setCountry('');
  }

  return (
    <>
      <h3 className="font-semibold flex items-center gap-2 mb-5 dark:text-white">
        <Phone className="h-4 w-4 text-brand-600" /> {service.name}
      </h3>

      {/* App selector */}
      <div>
        <label className="label">Service / App</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
          <input
            className="input pl-9 mb-1"
            placeholder="Search (e.g. Telegram)…"
            value={serviceSearch}
            onChange={(e) => { setServiceSearch(e.target.value); setCountry(''); }}
          />
        </div>
        <div className="rounded-lg border border-ink-200 dark:border-ink-700 overflow-hidden max-h-52 overflow-y-auto bg-white dark:bg-ink-900">
          {filteredServices ? (
            filteredServices.map((s) => {
              const unavailable = PROVIDER_UNAVAILABLE[service.provider]?.includes(s.value);
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => !unavailable && handleAppChange(s.value)}
                  disabled={unavailable}
                  className={clsx(
                    'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition',
                    unavailable
                      ? 'opacity-40 cursor-not-allowed text-ink-500 dark:text-ink-500'
                      : providerSvc === s.value
                        ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 font-medium'
                        : 'hover:bg-ink-50 dark:hover:bg-ink-800 text-ink-800 dark:text-ink-200',
                  )}
                >
                  <ServiceLogo slug={s.value} size={18} />
                  {s.label}
                  {unavailable && <span className="ml-auto text-xs text-ink-400 dark:text-ink-500">Unavailable</span>}
                </button>
              );
            })
          ) : (
            PROVIDER_SERVICES.map((g) => (
              <div key={g.group}>
                <div className="px-3 py-1.5 text-xs font-semibold text-ink-400 dark:text-ink-500 uppercase tracking-wide bg-ink-50 dark:bg-ink-800/60 border-b border-ink-100 dark:border-ink-700">
                  {g.group}
                </div>
                {g.items.map((s) => {
                  const unavailable = PROVIDER_UNAVAILABLE[service.provider]?.includes(s.value);
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => !unavailable && handleAppChange(s.value)}
                      disabled={unavailable}
                      className={clsx(
                        'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition',
                        unavailable
                          ? 'opacity-40 cursor-not-allowed text-ink-500 dark:text-ink-500'
                          : providerSvc === s.value
                            ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 font-medium'
                            : 'hover:bg-ink-50 dark:hover:bg-ink-800 text-ink-800 dark:text-ink-200',
                      )}
                    >
                      <ServiceLogo slug={s.value} size={18} />
                      {s.label}
                      {unavailable && <span className="ml-auto text-xs text-ink-400 dark:text-ink-500">Unavailable</span>}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Country price chart */}
      <div className="mt-4">
        <label className="label">Select country</label>
        {providerSvc === 'any' ? (
          <p className="text-sm text-amber-600 dark:text-amber-400 mt-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
            "Any / Other" is not supported. Please select a specific app above.
          </p>
        ) : priceQuery.isLoading ? (
          <div className="mt-2 flex items-center justify-center py-8 text-sm text-ink-500">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-300 border-t-brand-500 mr-2" />
            Loading available countries…
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-2 text-sm text-amber-600 dark:text-amber-400 py-4 text-center">
            No numbers available for this service right now. Try another app.
          </div>
        ) : (
          <div className="mt-2 rounded-lg border border-ink-200 dark:border-ink-700 overflow-hidden">
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-ink-50 dark:bg-ink-800 border-b border-ink-200 dark:border-ink-700">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-medium text-ink-500 dark:text-ink-400">Country</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-ink-500 dark:text-ink-400">Available</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-ink-500 dark:text-ink-400">Price (USD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                  {rows.map((row) => (
                    <tr
                      key={row.country_code}
                      onClick={() => setCountry(row.country_code)}
                      className={clsx(
                        'cursor-pointer transition',
                        country === row.country_code
                          ? 'bg-brand-50 dark:bg-brand-950/40'
                          : 'hover:bg-ink-50 dark:hover:bg-ink-800/60',
                      )}
                    >
                      <td className="px-3 py-2 dark:text-ink-200">
                        <span className="mr-2 text-base">{row.flag}</span>
                        <span className={country === row.country_code ? 'font-medium text-brand-700 dark:text-brand-300' : ''}>
                          {row.country_label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-ink-500 dark:text-ink-400">{row.count.toLocaleString()}</td>
                      <td className={clsx(
                        'px-3 py-2 text-right font-medium',
                        country === row.country_code ? 'text-brand-600 dark:text-brand-400' : 'dark:text-ink-200',
                      )}>
                        ${row.price_usd.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Selection summary */}
      {selectedRow ? (
        <div className="mt-3 flex items-center gap-2 text-sm p-3 rounded-lg bg-brand-50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            Selected: <strong>{selectedRow.flag} {selectedRow.country_label}</strong> — ${selectedRow.price_usd.toFixed(4)} per number
          </span>
        </div>
      ) : rows.length > 0 ? (
        <div className="mt-3 text-sm text-ink-500 dark:text-ink-400 p-3 rounded-lg bg-ink-50 dark:bg-ink-800">
          Click a row above to select your country.
        </div>
      ) : null}

      <button
        onClick={onPurchase}
        disabled={isPending || !country}
        className="btn-brand mt-5"
      >
        {isPending ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-950/30 border-t-ink-950" />
            Getting your number…
          </span>
        ) : country && selectedRow
          ? `Buy number in ${selectedRow.country_label}`
          : 'Select a country above'}
      </button>
    </>
  );
}

// ─── Gift Card Form ───────────────────────────────────────────────────────────

function GiftCardForm({ service, denomination, setDenomination, onPurchase, isPending }: {
  service: Service; denomination: number;
  setDenomination: (v: number) => void; onPurchase: () => void; isPending: boolean;
}) {
  return (
    <>
      <h3 className="font-semibold flex items-center gap-2 mb-5 dark:text-white">
        <Gift className="h-4 w-4 text-brand-600" /> {service.name}
      </h3>
      <div>
        <label className="label">Amount</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {GIFT_DENOMINATIONS.map((d) => (
            <button key={d} onClick={() => setDenomination(d)}
              className={clsx(
                'px-4 py-2 rounded-lg border text-sm font-medium transition',
                denomination === d
                  ? 'bg-ink-900 text-white border-ink-900 dark:bg-white dark:text-ink-900'
                  : 'border-ink-200 text-ink-700 hover:border-ink-400 dark:border-ink-700 dark:text-ink-300',
              )}>
              ${d}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-sm text-amber-800 dark:text-amber-400">
        ⚠ Gift cards are delivered as digital codes. All sales are final once delivered.
      </div>
      <button onClick={onPurchase} disabled={isPending} className="btn-brand mt-5">
        {isPending ? 'Processing…' : `Buy $${denomination} gift card`}
      </button>
    </>
  );
}

// ─── Utility Bill Form ────────────────────────────────────────────────────────

function UtilityForm({ service, billAmount, setBillAmount, network, setNetwork, phoneNumber, setPhoneNumber, meterNumber, setMeterNumber, smartcardNumber, setSmartcardNumber, dataPlan, setDataPlan, setDataBillerCode, meterType, setMeterType, onPurchase, isPending }: {
  service: Service;
  billAmount: string; setBillAmount: (v: string) => void;
  network: string; setNetwork: (v: string) => void;
  phoneNumber: string; setPhoneNumber: (v: string) => void;
  meterNumber: string; setMeterNumber: (v: string) => void;
  smartcardNumber: string; setSmartcardNumber: (v: string) => void;
  dataPlan: string; setDataPlan: (v: string) => void;
  setDataBillerCode: (v: string) => void;
  meterType: 'prepaid'|'postpaid'; setMeterType: (v: 'prepaid'|'postpaid') => void;
  onPurchase: () => void; isPending: boolean;
}) {
  const [meterCustomer, setMeterCustomer] = useState<string | null>(null);
  const [validatingMeter, setValidatingMeter] = useState(false);

  const networks      = UTILITY_NETWORKS[service.code] ?? [];
  const isElectricity = service.code === 'utility_electricity';
  const isData        = service.code === 'utility_data_ng';
  const isAirtime     = service.code === 'utility_airtime_ng';
  const isTV          = service.code === 'utility_dstv' || service.code === 'utility_startimes';
  const QUICK_AMOUNTS = isAirtime ? ['100', '200', '500', '1000', '2000'] : isElectricity ? ['1000', '2000', '5000', '10000', '20000'] : [];

  const plansQuery = useQuery({
    queryKey: ['data-plans', network],
    queryFn:  () => apiCall<DataPlan[]>({ url: '/services/data-plans', params: { network } }),
    enabled:  isData && !!network,
    staleTime: 10 * 60 * 1000,
  });
  const plans = plansQuery.data ?? [];

  async function validateMeter() {
    if (!meterNumber || !network) return;
    setValidatingMeter(true);
    setMeterCustomer(null);
    try {
      const res = await apiCall<{ customer_name: string | null }>({
        method: 'POST',
        url: '/services/validate-meter',
        data: { meter_number: meterNumber, disco: network, meter_type: meterType },
      });
      if (res.customer_name) {
        setMeterCustomer(res.customer_name);
        toast.success('Meter validated: ' + res.customer_name);
      } else {
        toast.error('Could not find customer for this meter number.');
      }
    } catch (e) {
      toast.error((e as Error).message ?? 'Meter validation failed');
    } finally {
      setValidatingMeter(false);
    }
  }

  function selectPlan(plan: DataPlan) {
    setDataPlan(plan.item_code);
    setDataBillerCode(plan.biller_code);
    setBillAmount(String(plan.amount));
  }

  const canSubmit = !isPending &&
    (isData ? !!dataPlan : Number(billAmount) >= 50) &&
    (isAirtime ? !!phoneNumber : true) &&
    (isData    ? !!phoneNumber : true) &&
    (isElectricity ? !!meterNumber : true) &&
    (isTV ? !!smartcardNumber : true);

  return (
    <>
      <h3 className="font-semibold flex items-center gap-2 mb-5 dark:text-white">
        <Receipt className="h-4 w-4 text-brand-600" /> {service.name}
      </h3>
      <div className="space-y-4">

        {/* Network selector */}
        {networks.length > 0 && (
          <div>
            <label className="label">Provider / Network</label>
            <div className="flex flex-wrap gap-2">
              {networks.map((n) => (
                <button key={n} onClick={() => { setNetwork(n); setDataPlan(''); setMeterCustomer(null); }}
                  className={clsx(
                    'px-4 py-2 rounded-lg border text-sm font-medium transition',
                    network === n
                      ? 'bg-ink-900 text-white border-ink-900 dark:bg-white dark:text-ink-900'
                      : 'border-ink-200 text-ink-700 hover:border-ink-400 dark:border-ink-700 dark:text-ink-300',
                  )}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Electricity — prepaid / postpaid toggle */}
        {isElectricity && (
          <div>
            <label className="label">Meter type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['prepaid', 'postpaid'] as const).map((t) => (
                <button key={t} onClick={() => { setMeterType(t); setMeterCustomer(null); }}
                  className={clsx(
                    'py-2.5 rounded-lg border text-sm font-medium capitalize transition',
                    meterType === t
                      ? 'bg-ink-900 text-white border-ink-900 dark:bg-white dark:text-ink-900'
                      : 'border-ink-200 text-ink-700 hover:border-ink-400 dark:border-ink-700 dark:text-ink-300',
                  )}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Electricity — meter number with validation */}
        {isElectricity && (
          <div>
            <label className="label">Meter number</label>
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="Enter your meter number"
                value={meterNumber}
                onChange={(e) => { setMeterNumber(e.target.value); setMeterCustomer(null); }} />
              <button
                onClick={validateMeter}
                disabled={!meterNumber || !network || validatingMeter}
                className="btn-outline px-3 text-xs whitespace-nowrap">
                {validatingMeter
                  ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Checking…</>
                  : 'Verify'}
              </button>
            </div>
            {meterCustomer && (
              <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-brand-50 dark:bg-brand-950/30 rounded-lg border border-brand-200 dark:border-brand-800 text-sm">
                <CheckCircle2 className="h-4 w-4 text-brand-600 shrink-0" />
                <span className="text-brand-800 dark:text-brand-300 font-medium">{meterCustomer}</span>
              </div>
            )}
          </div>
        )}

        {/* Data bundles — plan selector */}
        {isData && network && (
          <div>
            <label className="label">Select data plan</label>
            {plansQuery.isLoading ? (
              <p className="text-sm text-ink-500">Loading plans…</p>
            ) : plans.length === 0 ? (
              <p className="text-sm text-ink-500">No plans available for {network} right now.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {plans.map((p) => (
                  <button key={p.item_code} onClick={() => selectPlan(p)}
                    className={clsx(
                      'p-3 rounded-lg border text-left transition',
                      dataPlan === p.item_code
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30'
                        : 'border-ink-200 hover:border-ink-400 dark:border-ink-700',
                    )}>
                    <div className="font-medium text-sm dark:text-white">{p.name}</div>
                    <div className="text-xs text-ink-500 dark:text-ink-400">₦{p.amount.toLocaleString()}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Amount — for airtime and electricity only */}
        {(isAirtime || isElectricity) && (
          <div>
            <label className="label">Amount (₦ NGN)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 font-medium">₦</span>
              <input type="number" min="50" step="50"
                className="input pl-7"
                value={billAmount}
                onChange={(e) => setBillAmount(e.target.value)}
                placeholder="Enter amount in Naira"
              />
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {QUICK_AMOUNTS.map((a) => (
                <button key={a} onClick={() => setBillAmount(a)}
                  className={clsx(
                    'px-3 py-1.5 text-xs rounded-full border transition',
                    billAmount === a
                      ? 'bg-ink-900 text-white border-ink-900'
                      : 'border-ink-200 text-ink-600 hover:border-ink-400 dark:border-ink-700 dark:text-ink-400',
                  )}>
                  ₦{Number(a).toLocaleString()}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Phone number for airtime and data */}
        {(isAirtime || isData) && (
          <div>
            <label className="label">Phone number</label>
            <input className="input" placeholder="e.g. 08012345678" type="tel"
              value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
          </div>
        )}

        {/* TV smartcard */}
        {isTV && (
          <div>
            <label className="label">Smartcard / IUC number</label>
            <input className="input" placeholder="Enter your smartcard number"
              value={smartcardNumber} onChange={(e) => setSmartcardNumber(e.target.value)} />
          </div>
        )}

        <div className="p-3 rounded-lg bg-ink-50 dark:bg-ink-800 text-sm text-ink-600 dark:text-ink-400">
          ℹ Powered by Flutterwave. Processed instantly. Wallet is in USD — amount converted at current NGN/USD rate.
        </div>

        <button onClick={onPurchase} disabled={!canSubmit} className="btn-brand">
          {isPending ? 'Processing…' : isData && dataPlan
            ? `Buy ${plans.find(p => p.item_code === dataPlan)?.name ?? 'data'}`
            : `Pay ₦${Number(billAmount || 0).toLocaleString()}`}
        </button>
      </div>
    </>
  );
}
// ─── eSIM Form ────────────────────────────────────────────────────────────────

function EsimForm({ service, packageId, setPackageId, onPurchase, isPending }: {
  service: Service;
  packageId: string;
  setPackageId: (v: string) => void;
  onPurchase: () => void;
  isPending: boolean;
}) {
  const [tab, setTab]         = useState<'global' | 'local'>('global');
  const [country, setCountry] = useState('US');

  const provider = service.provider ?? 'airalo';

  const queryKey = tab === 'global'
    ? ['esim-packages', 'global', provider]
    : ['esim-packages', 'local', country, provider];

  const packages = useQuery<EsimPackage[]>({
    queryKey,
    queryFn: () => apiCall<EsimPackage[]>({
      url: '/services/esim-packages',
      params: tab === 'global'
        ? { type: 'global', provider }
        : { type: 'local', country, provider },
    }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const selected = packages.data?.find((p) => p.package_id === packageId) ?? null;

  return (
    <>
      <h3 className="font-semibold flex items-center gap-2 mb-5 dark:text-white">
        <Wifi className="h-4 w-4 text-brand-600" /> {service.name}
      </h3>

      {/* Tab toggle */}
      <div className="flex gap-1 p-1 bg-ink-100 dark:bg-ink-800 rounded-xl mb-5 w-fit">
        {(['global', 'local'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setPackageId(''); }}
            className={clsx(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition capitalize',
              tab === t
                ? 'bg-white dark:bg-ink-700 text-ink-900 dark:text-white shadow-sm'
                : 'text-ink-500 dark:text-ink-400 hover:text-ink-700 dark:hover:text-ink-300',
            )}>
            {t === 'global' ? '🌍 Global' : '📍 By Country'}
          </button>
        ))}
      </div>

      {/* Country selector for local */}
      {tab === 'local' && (
        <div className="mb-4">
          <label className="label">Select destination country</label>
          <select
            className="input"
            value={country}
            onChange={(e) => { setCountry(e.target.value); setPackageId(''); }}>
            {ESIM_COUNTRY_OPTIONS.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Plan list */}
      {packages.isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-ink-100 dark:bg-ink-800 animate-pulse" />
          ))}
        </div>
      ) : packages.isError ? (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-sm text-rose-700 dark:text-rose-400">
          Could not load plans. Make sure Airalo credentials are configured, or try again.
        </div>
      ) : !packages.data?.length ? (
        <div className="text-sm text-ink-500 dark:text-ink-400 py-4 text-center">
          No plans available for this selection.
        </div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {packages.data.map((pkg) => (
            <button
              key={pkg.package_id}
              type="button"
              onClick={() => setPackageId(pkg.package_id)}
              className={clsx(
                'w-full flex items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition',
                packageId === pkg.package_id
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30 shadow-glow'
                  : 'border-ink-100 hover:border-ink-300 dark:border-ink-700 dark:hover:border-ink-500',
              )}>
              <div>
                <div className={clsx(
                  'font-semibold text-sm',
                  packageId === pkg.package_id ? 'text-brand-700 dark:text-brand-300' : 'dark:text-white',
                )}>
                  {pkg.data ?? pkg.title}
                  {pkg.days > 0 && (
                    <span className="ml-2 text-xs font-normal text-ink-500 dark:text-ink-400">
                      · {pkg.days} day{pkg.days !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {pkg.operator && (
                  <div className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">{pkg.operator}</div>
                )}
              </div>
              <div className={clsx(
                'text-base font-bold tabular-nums',
                packageId === pkg.package_id ? 'text-brand-600 dark:text-brand-400' : 'text-ink-900 dark:text-white',
              )}>
                ${pkg.price.toFixed(2)}
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="mt-3 flex items-center gap-2 p-3 rounded-lg bg-ink-50 dark:bg-ink-800 text-sm text-ink-600 dark:text-ink-400">
          <CheckCircle2 className="h-4 w-4 text-brand-500 shrink-0" />
          <span>
            <strong className="dark:text-white">{selected.data ?? selected.title}</strong>
            {' '}for {selected.days} days · <strong className="dark:text-white">${selected.price.toFixed(2)}</strong> from your wallet
          </span>
        </div>
      )}

      <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs text-blue-700 dark:text-blue-400">
        📲 After purchase you'll receive a QR code to scan in Settings → Cellular → Add eSIM. Compatible with iPhone XS+ and most Android phones.
      </div>

      <button
        onClick={onPurchase}
        disabled={isPending || !packageId}
        className="btn-brand mt-5">
        {isPending ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-950/30 border-t-ink-950" />
            Activating eSIM…
          </span>
        ) : selected
          ? `Buy ${selected.data ?? selected.title} — $${selected.price.toFixed(2)}`
          : 'Select a plan to continue'}
      </button>
    </>
  );
}

// ─── SMM Boost Form ───────────────────────────────────────────────────────────

function SmmBoostForm({ service, smmServiceId, setSmmServiceId, link, setLink, quantity, setQuantity, onPurchase, isPending }: {
  service: Service;
  smmServiceId: number | null;
  setSmmServiceId: (v: number | null) => void;
  link: string;
  setLink: (v: string) => void;
  quantity: number;
  setQuantity: (v: number) => void;
  onPurchase: () => void;
  isPending: boolean;
}) {
  const [platform, setPlatform]   = useState('instagram');
  const [search, setSearch]       = useState('');

  const catalog = useQuery<SmmService[]>({
    queryKey: ['smm-catalog', 'smm_boost', platform],
    queryFn:  () => apiCall<SmmService[]>({
      url: '/services/smm-catalog',
      params: { category: 'smm_boost', platform },
    }),
    staleTime: 5 * 60 * 1000,
  });

  const filtered = search.trim()
    ? (catalog.data ?? []).filter((s) =>
        s.name.toLowerCase().includes(search.trim().toLowerCase())
      )
    : (catalog.data ?? []);

  const selected = catalog.data?.find((s) => s.service_id === smmServiceId) ?? null;
  const totalPrice = selected ? ((quantity / 1000) * selected.price_per_1k) : 0;

  function pickService(svc: SmmService) {
    setSmmServiceId(svc.service_id);
    setQuantity(Math.max(svc.min, Math.min(quantity, svc.max)));
  }

  const needsLink = selected?.type !== 'Package';
  const canBuy = !isPending && !!smmServiceId && quantity >= (selected?.min ?? 1) && (!needsLink || link.trim().length > 0);

  return (
    <>
      <h3 className="font-semibold flex items-center gap-2 mb-5 dark:text-white">
        <TrendingUp className="h-4 w-4 text-brand-600" /> {service.name}
      </h3>

      {/* Platform tabs */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {SMM_PLATFORMS_BOOST.map((p) => (
          <button key={p.value}
            onClick={() => { setPlatform(p.value); setSmmServiceId(null); setSearch(''); }}
            className={clsx(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition',
              platform === p.value
                ? 'bg-ink-900 text-white border-ink-900 dark:bg-white dark:text-ink-900'
                : 'border-ink-200 text-ink-600 hover:border-ink-400 dark:border-ink-700 dark:text-ink-400',
            )}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-3 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-400" />
        <input
          className="input pl-9 text-sm"
          placeholder="Search services…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setSmmServiceId(null); }}
        />
      </div>

      {/* Service list */}
      <div className="mb-4">
        <label className="label">
          Select service
          {search.trim() && (
            <span className="ml-1 font-normal text-ink-400">({filtered.length} result{filtered.length !== 1 ? 's' : ''})</span>
          )}
        </label>
        {catalog.isLoading ? (
          <div className="space-y-2 mt-2">
            {[1,2,3].map((i) => <div key={i} className="h-14 rounded-lg bg-ink-100 dark:bg-ink-800 animate-pulse" />)}
          </div>
        ) : !filtered.length ? (
          <div className="mt-2 py-6 text-center text-sm text-ink-500 dark:text-ink-400">
            {search.trim() ? `No services match "${search}"` : 'No services available for this platform right now.'}
          </div>
        ) : (
          <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-ink-200 dark:border-ink-700 divide-y divide-ink-100 dark:divide-ink-800">
            {filtered.map((svc) => (
              <button key={svc.service_id}
                onClick={() => pickService(svc)}
                className={clsx(
                  'w-full flex items-center justify-between px-3 py-2.5 text-left text-sm transition',
                  smmServiceId === svc.service_id
                    ? 'bg-brand-50 dark:bg-brand-950/40'
                    : 'hover:bg-ink-50 dark:hover:bg-ink-800/60',
                )}>
                <div className="min-w-0 flex-1 pr-3">
                  <div className={clsx('truncate', smmServiceId === svc.service_id ? 'font-medium text-brand-700 dark:text-brand-300' : 'dark:text-ink-200')}>
                    {svc.name}
                  </div>
                  <div className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">
                    Min {svc.min.toLocaleString()} · Max {svc.max.toLocaleString()}
                    {svc.refill && ' · Refill'}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className={clsx('font-medium tabular-nums', smmServiceId === svc.service_id ? 'text-brand-600 dark:text-brand-400' : 'dark:text-ink-200')}>
                    ${svc.price_per_1k.toFixed(3)}<span className="text-xs font-normal text-ink-400">/1K</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <>
          {/* Link input */}
          {needsLink && (
            <div className="mb-4">
              <label className="label">Profile / Post URL</label>
              <input
                className="input"
                placeholder="https://instagram.com/yourprofile"
                value={link}
                onChange={(e) => setLink(e.target.value)}
              />
              <p className="text-xs text-ink-400 dark:text-ink-500 mt-1">
                Paste the full URL of the profile or post you want to boost.
              </p>
            </div>
          )}

          {/* Quantity */}
          <div className="mb-4">
            <label className="label flex items-center justify-between">
              <span>Quantity</span>
              <span className="text-xs text-ink-400">{selected.min.toLocaleString()} – {selected.max.toLocaleString()}</span>
            </label>
            <input
              type="number"
              className="input"
              min={selected.min}
              max={selected.max}
              step={selected.min}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(selected.min, Math.min(selected.max, parseInt(e.target.value) || selected.min)))}
            />
            {/* Quick picks */}
            <div className="flex flex-wrap gap-2 mt-2">
              {[selected.min, 500, 1000, 5000, 10000].filter((v) => v >= selected.min && v <= selected.max).map((v) => (
                <button key={v} onClick={() => setQuantity(v)}
                  className={clsx(
                    'px-3 py-1 text-xs rounded-full border transition',
                    quantity === v
                      ? 'bg-ink-900 text-white border-ink-900'
                      : 'border-ink-200 text-ink-600 hover:border-ink-400 dark:border-ink-700 dark:text-ink-400',
                  )}>
                  {v.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Price summary */}
          <div className="mb-4 p-3 rounded-lg bg-brand-50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-800 text-sm flex items-center justify-between">
            <span className="text-brand-700 dark:text-brand-300">
              {quantity.toLocaleString()} × {selected.name.split(' ').slice(0,3).join(' ')}
            </span>
            <span className="font-bold text-brand-700 dark:text-brand-300">${totalPrice.toFixed(4)}</span>
          </div>
        </>
      )}

      <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-700 dark:text-amber-400">
        ⚠ Delivery typically starts within minutes and completes in 1–72 hours depending on quantity. Results are non-refundable once delivery begins.
      </div>

      <button onClick={onPurchase} disabled={!canBuy} className="btn-brand">
        {isPending ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-950/30 border-t-ink-950" />
            Placing order…
          </span>
        ) : selected && canBuy
          ? `Buy ${quantity.toLocaleString()} — $${totalPrice.toFixed(4)}`
          : 'Select a service above'}
      </button>
    </>
  );
}

// ─── SMM Accounts Form ────────────────────────────────────────────────────────

function SmmAccountsForm({ service, smmServiceId, setSmmServiceId, quantity, setQuantity, onPurchase, isPending }: {
  service: Service;
  smmServiceId: number | null;
  setSmmServiceId: (v: number | null) => void;
  quantity: number;
  setQuantity: (v: number) => void;
  onPurchase: () => void;
  isPending: boolean;
}) {
  const [platform, setPlatform] = useState('instagram');

  const catalog = useQuery<SmmService[]>({
    queryKey: ['smm-catalog', 'smm_accounts', platform],
    queryFn:  () => apiCall<SmmService[]>({
      url: '/services/smm-catalog',
      params: { category: 'smm_accounts', platform },
    }),
    staleTime: 5 * 60 * 1000,
  });

  const selected = catalog.data?.find((s) => s.service_id === smmServiceId) ?? null;
  const totalPrice = selected ? ((quantity / 1000) * selected.price_per_1k) : 0;

  function pickService(svc: SmmService) {
    setSmmServiceId(svc.service_id);
    setQuantity(Math.max(svc.min, Math.min(quantity, svc.max)));
  }

  const canBuy = !isPending && !!smmServiceId && quantity >= (selected?.min ?? 1);

  return (
    <>
      <h3 className="font-semibold flex items-center gap-2 mb-5 dark:text-white">
        <Users className="h-4 w-4 text-brand-600" /> {service.name}
      </h3>

      {/* Platform tabs */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {SMM_PLATFORMS_ACCOUNTS.map((p) => (
          <button key={p.value}
            onClick={() => { setPlatform(p.value); setSmmServiceId(null); }}
            className={clsx(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition',
              platform === p.value
                ? 'bg-ink-900 text-white border-ink-900 dark:bg-white dark:text-ink-900'
                : 'border-ink-200 text-ink-600 hover:border-ink-400 dark:border-ink-700 dark:text-ink-400',
            )}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Service list */}
      <div className="mb-4">
        <label className="label">Select account type</label>
        {catalog.isLoading ? (
          <div className="space-y-2 mt-2">
            {[1,2,3].map((i) => <div key={i} className="h-14 rounded-lg bg-ink-100 dark:bg-ink-800 animate-pulse" />)}
          </div>
        ) : !catalog.data?.length ? (
          <div className="mt-2 py-6 text-center text-sm text-ink-500 dark:text-ink-400">
            No accounts available for this platform right now.
          </div>
        ) : (
          <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-ink-200 dark:border-ink-700 divide-y divide-ink-100 dark:divide-ink-800">
            {catalog.data.map((svc) => (
              <button key={svc.service_id}
                onClick={() => pickService(svc)}
                className={clsx(
                  'w-full flex items-center justify-between px-3 py-2.5 text-left text-sm transition',
                  smmServiceId === svc.service_id
                    ? 'bg-brand-50 dark:bg-brand-950/40'
                    : 'hover:bg-ink-50 dark:hover:bg-ink-800/60',
                )}>
                <div className="min-w-0 flex-1 pr-3">
                  <div className={clsx('truncate', smmServiceId === svc.service_id ? 'font-medium text-brand-700 dark:text-brand-300' : 'dark:text-ink-200')}>
                    {svc.name}
                  </div>
                  <div className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">
                    Min {svc.min.toLocaleString()} · Max {svc.max.toLocaleString()}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className={clsx('font-medium tabular-nums', smmServiceId === svc.service_id ? 'text-brand-600 dark:text-brand-400' : 'dark:text-ink-200')}>
                    ${svc.price_per_1k.toFixed(3)}<span className="text-xs font-normal text-ink-400">/1K</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <>
          <div className="mb-4">
            <label className="label flex items-center justify-between">
              <span>Quantity</span>
              <span className="text-xs text-ink-400">{selected.min.toLocaleString()} – {selected.max.toLocaleString()}</span>
            </label>
            <input
              type="number"
              className="input"
              min={selected.min}
              max={selected.max}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(selected.min, Math.min(selected.max, parseInt(e.target.value) || selected.min)))}
            />
          </div>

          <div className="mb-4 p-3 rounded-lg bg-brand-50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-800 text-sm flex items-center justify-between">
            <span className="text-brand-700 dark:text-brand-300">
              {quantity.toLocaleString()} × {selected.name.split(' ').slice(0,4).join(' ')}
            </span>
            <span className="font-bold text-brand-700 dark:text-brand-300">${totalPrice.toFixed(4)}</span>
          </div>
        </>
      )}

      <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-700 dark:text-amber-400">
        ⚠ Account credentials are delivered via your order details. All sales are final. Use responsibly and in accordance with each platform's terms of service.
      </div>

      <button onClick={onPurchase} disabled={!canBuy} className="btn-brand">
        {isPending ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-950/30 border-t-ink-950" />
            Placing order…
          </span>
        ) : selected && canBuy
          ? `Buy ${quantity.toLocaleString()} account${quantity !== 1 ? 's' : ''} — $${totalPrice.toFixed(4)}`
          : 'Select an account type above'}
      </button>
    </>
  );
}

// ─── SMM Order Status ─────────────────────────────────────────────────────────

function SmmOrderStatus({ order }: { order: ServiceOrder }) {
  const qc = useQueryClient();
  const [checking, setChecking] = useState(false);
  const delivery    = order.delivery as Record<string, unknown> | null;
  const smmStatus   = delivery?.smm_status as string | null;
  const notes       = delivery?.notes as string | null;
  const panelOrder  = delivery?.panel_order as string | number | null;

  async function checkStatus() {
    setChecking(true);
    try {
      await apiCall({ url: `/orders/${order.id}/smm-status`, method: 'POST' });
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Status updated');
    } catch (e) {
      toast.error((e as Error).message ?? 'Could not check status');
    } finally {
      setChecking(false);
    }
  }

  const isDone = smmStatus === 'Completed' || smmStatus === 'Partial';

  return (
    <div className="mt-2 space-y-1.5">
      {panelOrder && (
        <div className="text-xs text-ink-400 dark:text-ink-500">Panel order #{panelOrder}</div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        {smmStatus && (
          <span className={clsx(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
            smmStatus === 'Completed' ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
              : smmStatus === 'Partial' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
              : smmStatus === 'Canceled' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
              : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-400',
          )}>
            <Clock className="h-3 w-3" /> {smmStatus}
          </span>
        )}
        {!isDone && (
          <button onClick={checkStatus} disabled={checking}
            className="inline-flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline disabled:opacity-50">
            <RefreshCw className={clsx('h-3 w-3', checking && 'animate-spin')} />
            {checking ? 'Checking…' : 'Check status'}
          </button>
        )}
      </div>
      {/* Account credentials / notes */}
      {notes && (
        <div className="mt-1 p-2.5 rounded-lg bg-ink-50 dark:bg-ink-800 border border-ink-200 dark:border-ink-700">
          <div className="text-xs font-medium text-ink-500 dark:text-ink-400 mb-1">Delivery notes</div>
          <pre className="text-xs text-ink-800 dark:text-ink-200 whitespace-pre-wrap break-all font-mono leading-relaxed">
            {notes}
          </pre>
          <button
            onClick={() => { navigator.clipboard.writeText(notes); toast.success('Copied!'); }}
            className="mt-1.5 flex items-center gap-1 text-xs text-ink-400 hover:text-brand-600 dark:hover:text-brand-400">
            <Copy className="h-3 w-3" /> Copy credentials
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Order Row ────────────────────────────────────────────────────────────────

function OrderRow({ order }: { order: ServiceOrder }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const delivery        = order.delivery as Record<string, unknown> | null;
  const phoneNumber     = delivery?.phone_number as string | null;
  const smsCode         = delivery?.sms_code as string | null;
  const isEsim          = delivery?.type === 'esim';
  const isSmm           = delivery?.type === 'smm';
  const esimCode        = delivery?.activation_code as string | null;
  const esimQrUrl       = delivery?.qrcode_url as string | null;
  const esimInstUrl     = delivery?.instructions_url as string | null;

  return (
    <li className="py-3.5 flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <button onClick={() => navigate(`/orders/${order.id}`)}
          className="flex items-center gap-2 hover:text-brand-600 transition text-left">
          <div className="font-medium text-sm dark:text-white truncate">
            {order.service?.name ?? 'Service'}
          </div>
          <StatusBadge status={order.status} />
        </button>
        <div className="text-xs text-ink-500 dark:text-ink-400 mt-0.5 flex items-center gap-1">
          <Clock className="h-3 w-3" /> {formatDate(order.created_at)}
        </div>

        {/* Phone number */}
        {phoneNumber && (
          <div className="mt-2 flex items-center gap-2">
            <span className="font-mono text-sm font-semibold dark:text-white">{phoneNumber}</span>
            <button onClick={() => { navigator.clipboard.writeText(phoneNumber); setCopied(true); toast.success('Copied!'); setTimeout(() => setCopied(false), 2000); }}
              className={clsx('p-1 rounded transition', copied ? 'text-brand-600' : 'text-ink-400 hover:text-ink-700')}>
              {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        )}

        {/* SMS Code */}
        {smsCode && (
          <div className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-brand-50 dark:bg-brand-950/30 rounded-lg border border-brand-200 dark:border-brand-900">
            <CheckCircle2 className="h-4 w-4 text-brand-600 shrink-0" />
            <span className="font-mono font-bold text-brand-700 dark:text-brand-300 text-lg tracking-widest">{smsCode}</span>
          </div>
        )}

        {/* Waiting for code */}
        {phoneNumber && !smsCode && order.status === 'completed' && (
          <button onClick={() => navigate(`/orders/${order.id}`)}
            className="mt-2 text-xs text-ink-500 dark:text-ink-400 hover:text-brand-600 flex items-center gap-1">
            <Clock className="h-3 w-3" /> Tap to check for SMS code →
          </button>
        )}

        {/* eSIM delivery */}
        {isEsim && order.status === 'completed' && (
          <div className="mt-2 space-y-1.5">
            {esimQrUrl && (
              <a href={esimQrUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-brand-600 dark:text-brand-400 hover:underline">
                <QrCode className="h-3.5 w-3.5" /> View QR Code
              </a>
            )}
            {esimCode && (
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-ink-600 dark:text-ink-300 truncate max-w-[200px]">{esimCode}</span>
                <button onClick={() => { navigator.clipboard.writeText(esimCode); setCopied(true); toast.success('Copied!'); setTimeout(() => setCopied(false), 2000); }}
                  className={clsx('p-1 rounded transition shrink-0', copied ? 'text-brand-600' : 'text-ink-400 hover:text-ink-700')}>
                  {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            )}
            {esimInstUrl && (
              <a href={esimInstUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-ink-500 dark:text-ink-400 hover:text-brand-600 hover:underline">
                <ExternalLink className="h-3 w-3" /> Installation guide
              </a>
            )}
          </div>
        )}

        {/* SMM order delivery */}
        {isSmm && <SmmOrderStatus order={order} />}

        {order.failure_reason && (
          <div className="mt-1.5 flex items-start gap-1 text-xs text-rose-600 dark:text-rose-400">
            <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{order.failure_reason}</span>
          </div>
        )}
      </div>

      <div className="text-right shrink-0">
        <div className="font-mono font-medium text-sm dark:text-white">
          {formatMoney(order.amount_minor, order.currency)}
        </div>
        {order.refunded_at && <div className="text-xs text-brand-600 mt-0.5">Refunded</div>}
      </div>
    </li>
  );
}

// ─── Proxy Purchase Form ──────────────────────────────────────────────────────

const PROXY_TYPES = [
  { value: 'residential_rotating',  label: 'Residential Rotating',  bandwidth: true },
  { value: 'residential_sticky',    label: 'Residential Sticky',    bandwidth: true },
  { value: 'residential_static',    label: 'Residential Static',    bandwidth: true },
  { value: 'datacenter_shared',     label: 'Datacenter Shared',     bandwidth: false },
  { value: 'datacenter_dedicated',  label: 'Datacenter Dedicated',  bandwidth: false },
  { value: 'isp_static',            label: 'ISP Static',            bandwidth: false },
  { value: 'isp_rotating',          label: 'ISP Rotating',          bandwidth: false },
  { value: 'mobile_rotating',       label: 'Mobile Rotating',       bandwidth: true },
];

const PROXY_COUNTRIES = [
  { code: 'US', label: '🇺🇸 United States' }, { code: 'GB', label: '🇬🇧 United Kingdom' },
  { code: 'DE', label: '🇩🇪 Germany' },       { code: 'FR', label: '🇫🇷 France' },
  { code: 'CA', label: '🇨🇦 Canada' },        { code: 'AU', label: '🇦🇺 Australia' },
  { code: 'JP', label: '🇯🇵 Japan' },         { code: 'IN', label: '🇮🇳 India' },
  { code: 'BR', label: '🇧🇷 Brazil' },        { code: 'SG', label: '🇸🇬 Singapore' },
  { code: 'NL', label: '🇳🇱 Netherlands' },   { code: 'SE', label: '🇸🇪 Sweden' },
  { code: 'NG', label: '🇳🇬 Nigeria' },       { code: 'ZA', label: '🇿🇦 South Africa' },
  { code: 'AE', label: '🇦🇪 UAE' },           { code: 'TR', label: '🇹🇷 Turkey' },
];

function ProxyPurchaseForm({
  service, proxyType, setProxyType, protocol, setProtocol,
  countryCode, setCountryCode, bandwidthGb, setBandwidthGb,
  ipCount, setIpCount, durationDays, setDurationDays,
  sessionType, setSessionType,
  onPurchase, isPending,
}: {
  service: Service;
  proxyType: string;    setProxyType: (v: string) => void;
  protocol: string;     setProtocol: (v: string) => void;
  countryCode: string;  setCountryCode: (v: string) => void;
  bandwidthGb: number;  setBandwidthGb: (v: number) => void;
  ipCount: number;      setIpCount: (v: number) => void;
  durationDays: number; setDurationDays: (v: number) => void;
  sessionType: string;  setSessionType: (v: string) => void;
  onPurchase: () => void;
  isPending: boolean;
}) {
  const isBandwidthBased = PROXY_TYPES.find((t) => t.value === proxyType)?.bandwidth ?? true;
  const isResidential    = proxyType.startsWith('residential');

  const priceQuery = useQuery({
    queryKey: ['proxy', 'price-estimate', proxyType, bandwidthGb, ipCount, durationDays],
    queryFn: () => apiCall<{ amount: string; amount_minor: number; currency: string }>({
      url: '/proxy/price-estimate',
      params: {
        proxy_type:    proxyType,
        bandwidth_gb:  isBandwidthBased ? bandwidthGb : undefined,
        ip_count:      !isBandwidthBased ? ipCount : undefined,
        duration_days: durationDays,
      },
    }),
    staleTime: 30_000,
  });

  const price = priceQuery.data;

  return (
    <>
      <h3 className="font-semibold flex items-center gap-2 mb-5 dark:text-white">
        <Server className="h-4 w-4 text-brand-600" /> {service.name}
      </h3>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Proxy Type */}
        <div>
          <label className="label">Proxy Type</label>
          <select className="input" value={proxyType} onChange={(e) => setProxyType(e.target.value)}>
            {PROXY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Protocol */}
        <div>
          <label className="label">Protocol</label>
          <select className="input" value={protocol} onChange={(e) => setProtocol(e.target.value)}>
            <option value="http">HTTP/HTTPS</option>
            <option value="socks5">SOCKS5</option>
          </select>
        </div>

        {/* Country */}
        <div>
          <label className="label">Country</label>
          <select className="input" value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
            {PROXY_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Duration */}
        <div>
          <label className="label">Duration</label>
          <select className="input" value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))}>
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>

        {/* Bandwidth (residential / mobile) */}
        {isBandwidthBased && (
          <div>
            <label className="label">Bandwidth (GB)</label>
            <input type="number" className="input" min={0.1} step={0.5}
              value={bandwidthGb} onChange={(e) => setBandwidthGb(parseFloat(e.target.value) || 1)} />
          </div>
        )}

        {/* IP Count (datacenter / ISP) */}
        {!isBandwidthBased && (
          <div>
            <label className="label">IP Count</label>
            <input type="number" className="input" min={1} max={100}
              value={ipCount} onChange={(e) => setIpCount(Math.max(1, parseInt(e.target.value) || 1))} />
          </div>
        )}

        {/* Session type (residential only) */}
        {isResidential && (
          <div>
            <label className="label">Session Type</label>
            <select className="input" value={sessionType} onChange={(e) => setSessionType(e.target.value)}>
              <option value="rotating">Rotating (new IP per request)</option>
              <option value="sticky">Sticky (same IP per session)</option>
            </select>
          </div>
        )}
      </div>

      {/* Price estimate */}
      <div className="mt-4 p-4 bg-ink-50 dark:bg-ink-800 rounded-lg flex items-center justify-between">
        <div>
          {priceQuery.isLoading && <span className="text-sm text-ink-500">Calculating price…</span>}
          {price && !priceQuery.isLoading && (
            <div>
              <p className="text-xs text-ink-500 uppercase tracking-wide">Estimated cost</p>
              <p className="text-xl font-bold dark:text-white">{price.amount} {price.currency}</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-500">
          <Server className="h-4 w-4 text-brand-500" />
          <span>Charged from wallet</span>
        </div>
      </div>

      {/* My Proxies link */}
      <div className="mt-2 flex items-center justify-between">
        <a href="/proxy" className="text-xs text-ink-500 hover:text-brand-600 flex items-center gap-1">
          View My Proxies <ArrowRight className="h-3 w-3" />
        </a>
      </div>

      <button
        onClick={onPurchase}
        disabled={isPending || priceQuery.isLoading}
        className="btn-primary w-full mt-4"
      >
        {isPending ? 'Provisioning proxy…' : `Buy Proxy${price ? ` — ${price.amount}` : ''}`}
      </button>
    </>
  );
}
