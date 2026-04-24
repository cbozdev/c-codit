import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiCall, newIdempotencyKey } from '@/lib/api';
import type { Paginated, Service, ServiceOrder } from '@/types/api';
import {
  Smartphone, Globe, CreditCard, Receipt, Phone,
  RefreshCw, Copy, Search, ChevronDown, ChevronUp,
  CheckCircle2, Clock, XCircle, Gift,
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
  { group: 'Finance & Crypto', items: [
    { value: 'paypal', label: 'PayPal' },
    { value: 'binance', label: 'Binance' },
    { value: 'coinbase', label: 'Coinbase' },
    { value: 'bybit', label: 'Bybit' },
    { value: 'kucoin', label: 'KuCoin' },
    { value: 'okx', label: 'OKX' },
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
      return apiCall<ServiceOrder>({
        url: '/services/virtual-number/purchase',
        method: 'POST',
        headers: { 'Idempotency-Key': newIdempotencyKey() },
        data: {
          service_code: selected.code,
          service: providerSvc,
          country,
          ...(denomination ? { denomination } : {}),
          ...(network ? { network } : {}),
          ...(meterNumber ? { meter_number: meterNumber } : {}),
          ...(phoneNumber ? { phone_number: phoneNumber } : {}),
        },
      });
    },
    onSuccess(order) {
      const delivery = order.delivery;
      if (delivery?.phone_number) {
        toast.success(`Number: ${delivery.phone_number}`);
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
              network={network}
              setNetwork={setNetwork}
              phoneNumber={phoneNumber}
              setPhoneNumber={setPhoneNumber}
              meterNumber={meterNumber}
              setMeterNumber={setMeterNumber}
              onPurchase={() => purchase.mutate()}
              isPending={purchase.isPending}
            />
          )}

          {/* eSIM */}
          {selected.category === 'esim' && (
            <div className="text-center py-6">
              <Globe className="h-12 w-12 text-ink-300 mx-auto mb-3" />
              <p className="font-medium dark:text-white">eSIM coming soon</p>
              <p className="text-sm text-ink-500 mt-1">We're integrating eSIM providers. Check back soon.</p>
            </div>
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

function UtilityForm({ service, network, setNetwork, phoneNumber, setPhoneNumber, meterNumber, setMeterNumber, onPurchase, isPending }: {
  service: Service; network: string; setNetwork: (v: string) => void;
  phoneNumber: string; setPhoneNumber: (v: string) => void;
  meterNumber: string; setMeterNumber: (v: string) => void;
  onPurchase: () => void; isPending: boolean;
}) {
  const networks = UTILITY_NETWORKS[service.code] ?? [];
  const isElectricity = service.code === 'utility_electricity';
  const isAirtimeOrData = service.code === 'utility_airtime_ng' || service.code === 'utility_data_ng';

  return (
    <>
      <h3 className="font-semibold flex items-center gap-2 mb-5 dark:text-white">
        <Receipt className="h-4 w-4 text-brand-600" /> {service.name}
      </h3>
      <div className="space-y-4">
        {networks.length > 0 && (
          <div>
            <label className="label">Provider / Network</label>
            <div className="flex flex-wrap gap-2">
              {networks.map((n) => (
                <button key={n} onClick={() => setNetwork(n)}
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

        {isAirtimeOrData && (
          <div>
            <label className="label">Phone number</label>
            <input className="input" placeholder="e.g. 08012345678"
              value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
          </div>
        )}

        {isElectricity && (
          <div>
            <label className="label">Meter number</label>
            <input className="input" placeholder="Enter your meter number"
              value={meterNumber} onChange={(e) => setMeterNumber(e.target.value)} />
          </div>
        )}

        <div className="p-3 rounded-lg bg-ink-50 dark:bg-ink-800 text-sm text-ink-600 dark:text-ink-400">
          ℹ Utility bill payments are powered by Flutterwave and processed instantly.
        </div>

        <button onClick={onPurchase} disabled={isPending} className="btn-brand">
          {isPending ? 'Processing…' : 'Pay bill'}
        </button>
      </div>
    </>
  );
}

// ─── Order Row ────────────────────────────────────────────────────────────────

function OrderRow({ order }: { order: ServiceOrder }) {
  const [copied, setCopied] = useState(false);

  function copyNumber(num: string) {
    navigator.clipboard.writeText(num);
    setCopied(true);
    toast.success('Copied!');
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <li className="py-3.5 flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="font-medium text-sm dark:text-white truncate">
            {order.service?.name ?? 'Service'}
          </div>
          <StatusBadge status={order.status} />
        </div>
        <div className="text-xs text-ink-500 dark:text-ink-400 mt-0.5 flex items-center gap-1">
          <Clock className="h-3 w-3" /> {formatDate(order.created_at)}
        </div>

        {/* Delivery */}
        {order.delivery?.phone_number && (
          <div className="mt-2 flex items-center gap-2">
            <span className="font-mono text-sm font-semibold dark:text-white">
              {order.delivery.phone_number}
            </span>
            <button onClick={() => copyNumber(order.delivery!.phone_number!)}
              className={clsx(
                'p-1 rounded transition',
                copied ? 'text-brand-600' : 'text-ink-400 hover:text-ink-700 dark:hover:text-ink-200',
              )}>
              {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        )}

        {/* Failure reason */}
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
        {order.refunded_at && (
          <div className="text-xs text-brand-600 mt-0.5">Refunded</div>
        )}
      </div>
    </li>
  );
}
