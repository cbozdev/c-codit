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
} from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate, formatMoney } from '@/lib/format';
import { clsx } from 'clsx';

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

const COUNTRIES = [
  { group: 'Africa', items: [
    { value: 'nigeria',      label: '🇳🇬 Nigeria' },
    { value: 'ghana',        label: '🇬🇭 Ghana' },
    { value: 'kenya',        label: '🇰🇪 Kenya' },
    { value: 'southafrica',  label: '🇿🇦 South Africa' },
    { value: 'ethiopia',     label: '🇪🇹 Ethiopia' },
    { value: 'tanzania',     label: '🇹🇿 Tanzania' },
    { value: 'uganda',       label: '🇺🇬 Uganda' },
    { value: 'cameroon',     label: '🇨🇲 Cameroon' },
    { value: 'senegal',      label: '🇸🇳 Senegal' },
    { value: 'egypt',        label: '🇪🇬 Egypt' },
  ]},
  { group: 'Americas', items: [
    { value: 'usa',          label: '🇺🇸 United States' },
    { value: 'canada',       label: '🇨🇦 Canada' },
    { value: 'brazil',       label: '🇧🇷 Brazil' },
    { value: 'mexico',       label: '🇲🇽 Mexico' },
    { value: 'colombia',     label: '🇨🇴 Colombia' },
  ]},
  { group: 'Europe', items: [
    { value: 'uk',           label: '🇬🇧 United Kingdom' },
    { value: 'germany',      label: '🇩🇪 Germany' },
    { value: 'france',       label: '🇫🇷 France' },
    { value: 'ukraine',      label: '🇺🇦 Ukraine' },
    { value: 'netherlands',  label: '🇳🇱 Netherlands' },
    { value: 'sweden',       label: '🇸🇪 Sweden' },
    { value: 'poland',       label: '🇵🇱 Poland' },
  ]},
  { group: 'Asia', items: [
    { value: 'india',        label: '🇮🇳 India' },
    { value: 'indonesia',    label: '🇮🇩 Indonesia' },
    { value: 'russia',       label: '🇷🇺 Russia' },
    { value: 'philippines',  label: '🇵🇭 Philippines' },
    { value: 'vietnam',      label: '🇻🇳 Vietnam' },
    { value: 'kazakhstan',   label: '🇰🇿 Kazakhstan' },
    { value: 'china',        label: '🇨🇳 China' },
    { value: 'thailand',     label: '🇹🇭 Thailand' },
  ]},
];

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

// Data bundle plans per network (in NGN)
const DATA_PLANS: Record<string, { label: string; code: string; amount: string }[]> = {
  MTN: [
    { label: '100MB - ₦100',    code: 'MTN100MB',   amount: '100' },
    { label: '200MB - ₦200',    code: 'MTN200MB',   amount: '200' },
    { label: '500MB - ₦300',    code: 'MTN500MB',   amount: '300' },
    { label: '1GB - ₦500',      code: 'MTN1GB',     amount: '500' },
    { label: '2GB - ₦1,000',    code: 'MTN2GB',     amount: '1000' },
    { label: '5GB - ₦2,000',    code: 'MTN5GB',     amount: '2000' },
    { label: '10GB - ₦3,000',   code: 'MTN10GB',    amount: '3000' },
  ],
  Airtel: [
    { label: '100MB - ₦100',    code: 'AIR100MB',   amount: '100' },
    { label: '500MB - ₦300',    code: 'AIR500MB',   amount: '300' },
    { label: '1GB - ₦500',      code: 'AIR1GB',     amount: '500' },
    { label: '2GB - ₦1,000',    code: 'AIR2GB',     amount: '1000' },
    { label: '5GB - ₦2,000',    code: 'AIR5GB',     amount: '2000' },
    { label: '10GB - ₦3,000',   code: 'AIR10GB',    amount: '3000' },
  ],
  Glo: [
    { label: '100MB - ₦50',     code: 'GLO100MB',   amount: '50' },
    { label: '1GB - ₦500',      code: 'GLO1GB',     amount: '500' },
    { label: '2GB - ₦1,000',    code: 'GLO2GB',     amount: '1000' },
    { label: '5GB - ₦2,000',    code: 'GLO5GB',     amount: '2000' },
    { label: '10GB - ₦2,500',   code: 'GLO10GB',    amount: '2500' },
  ],
  '9mobile': [
    { label: '500MB - ₦200',    code: '9M500MB',    amount: '200' },
    { label: '1.5GB - ₦1,000',  code: '9M15GB',     amount: '1000' },
    { label: '3GB - ₦2,000',    code: '9M3GB',      amount: '2000' },
    { label: '5GB - ₦3,000',    code: '9M5GB',      amount: '3000' },
  ],
};

// Icons per category
const CAT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  virtual_number: Smartphone,
  esim:           Globe,
  giftcard:       Gift,
  utility:        Receipt,
};

const CAT_LABELS: Record<string, string> = {
  virtual_number: 'Virtual Numbers',
  esim:           'eSIM',
  giftcard:       'Gift Cards',
  utility:        'Utility Bills',
};

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
  const [meterType, setMeterType]         = useState<'prepaid'|'postpaid'>('prepaid');
  const [esimPackageId, setEsimPackageId]   = useState('');
  const [ordersExpanded, setOrdersExpanded] = useState(true);

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
        if (selected.code === 'utility_electricity') baseData.meter_type = meterType;
      } else if (selected.category === 'giftcard') {
        baseData.denomination = denomination;
      } else if (selected.category === 'esim') {
        baseData.package_id = esimPackageId;
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
      if (delivery?.phone_number) {
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
              setNetwork={(n) => { setNetwork(n); setDataPlan(''); }}
              phoneNumber={phoneNumber}
              setPhoneNumber={setPhoneNumber}
              meterNumber={meterNumber}
              setMeterNumber={setMeterNumber}
              smartcardNumber={smartcardNumber}
              setSmartcardNumber={setSmartcardNumber}
              dataPlan={dataPlan}
              setDataPlan={setDataPlan}
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
  return (
    <>
      <h3 className="font-semibold flex items-center gap-2 mb-5 dark:text-white">
        <Phone className="h-4 w-4 text-brand-600" /> {service.name}
      </h3>
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Service search */}
        <div>
          <label className="label">Service / App</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
            <input
              className="input pl-9 mb-1"
              placeholder="Search (e.g. Telegram)…"
              value={serviceSearch}
              onChange={(e) => setServiceSearch(e.target.value)}
            />
          </div>
          <select className="input" value={providerSvc} onChange={(e) => setProviderSvc(e.target.value)} size={1}>
            {filteredServices ? (
              filteredServices.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)
            ) : (
              PROVIDER_SERVICES.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.items.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </optgroup>
              ))
            )}
          </select>
        </div>

        {/* Country */}
        <div>
          <label className="label">Country</label>
          <select className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
            {COUNTRIES.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.items.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-3 p-3 rounded-lg bg-ink-50 dark:bg-ink-800 text-sm text-ink-600 dark:text-ink-400">
        <CheckCircle2 className="h-4 w-4 text-brand-500 mt-0.5 shrink-0" />
        <span>Price is checked at the time of purchase. If the number can't be delivered, your wallet is automatically refunded.</span>
      </div>

      <button onClick={onPurchase} disabled={isPending} className="btn-brand mt-5">
        {isPending ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-950/30 border-t-ink-950" />
            Getting your number…
          </span>
        ) : 'Buy number'}
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

function UtilityForm({ service, billAmount, setBillAmount, network, setNetwork, phoneNumber, setPhoneNumber, meterNumber, setMeterNumber, smartcardNumber, setSmartcardNumber, dataPlan, setDataPlan, meterType, setMeterType, onPurchase, isPending }: {
  service: Service;
  billAmount: string; setBillAmount: (v: string) => void;
  network: string; setNetwork: (v: string) => void;
  phoneNumber: string; setPhoneNumber: (v: string) => void;
  meterNumber: string; setMeterNumber: (v: string) => void;
  smartcardNumber: string; setSmartcardNumber: (v: string) => void;
  dataPlan: string; setDataPlan: (v: string) => void;
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
  const plans         = isData ? (DATA_PLANS[network] ?? []) : [];
  const QUICK_AMOUNTS = isAirtime ? ['100', '200', '500', '1000', '2000'] : isElectricity ? ['1000', '2000', '5000', '10000', '20000'] : [];

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

  function selectPlan(plan: { code: string; amount: string }) {
    setDataPlan(plan.code);
    setBillAmount(plan.amount);
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
            {plans.length === 0 ? (
              <p className="text-sm text-ink-500">No plans available for this network.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {plans.map((p) => (
                  <button key={p.code} onClick={() => selectPlan(p)}
                    className={clsx(
                      'p-3 rounded-lg border text-left transition',
                      dataPlan === p.code
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30'
                        : 'border-ink-200 hover:border-ink-400 dark:border-ink-700',
                    )}>
                    <div className="font-medium text-sm dark:text-white">{p.label.split(' - ')[0]}</div>
                    <div className="text-xs text-ink-500 dark:text-ink-400">₦{Number(p.amount).toLocaleString()}</div>
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
            ? `Buy ${plans.find(p => p.code === dataPlan)?.label ?? 'data'}`
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

  const queryKey = tab === 'global'
    ? ['esim-packages', 'global']
    : ['esim-packages', 'local', country];

  const packages = useQuery<EsimPackage[]>({
    queryKey,
    queryFn: () => apiCall<EsimPackage[]>({
      url: '/services/esim-packages',
      params: tab === 'global' ? { type: 'global' } : { type: 'local', country },
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

// ─── Order Row ────────────────────────────────────────────────────────────────

function OrderRow({ order }: { order: ServiceOrder }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const delivery        = order.delivery as Record<string, unknown> | null;
  const phoneNumber     = delivery?.phone_number as string | null;
  const smsCode         = delivery?.sms_code as string | null;
  const isEsim          = delivery?.type === 'esim';
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
