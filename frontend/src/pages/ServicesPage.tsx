import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiCall, newIdempotencyKey } from '@/lib/api';
import type { Paginated, Service, ServiceOrder } from '@/types/api';
import { Smartphone, Globe, CreditCard, Receipt, Phone, Sparkles, RefreshCw, Copy } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate, formatMoney } from '@/lib/format';
import { clsx } from 'clsx';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  virtual_number: Smartphone,
  esim:           Globe,
  giftcard:       CreditCard,
  utility:        Receipt,
};

const COMMON_PROVIDER_SERVICES = [
  { value: 'telegram',  label: 'Telegram' },
  { value: 'whatsapp',  label: 'WhatsApp' },
  { value: 'google',    label: 'Google' },
  { value: 'facebook',  label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'twitter',   label: 'X (Twitter)' },
  { value: 'discord',   label: 'Discord' },
  { value: 'tiktok',    label: 'TikTok' },
];

const COMMON_COUNTRIES = [
  { value: 'usa',     label: 'United States' },
  { value: 'russia',  label: 'Russia' },
  { value: 'india',   label: 'India' },
  { value: 'nigeria', label: 'Nigeria' },
  { value: 'ukraine', label: 'Ukraine' },
  { value: 'uk',      label: 'United Kingdom' },
];

export default function ServicesPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Service | null>(null);
  const [providerService, setProviderService] = useState('telegram');
  const [country, setCountry] = useState('usa');

  const services = useQuery({
    queryKey: ['services'],
    queryFn: () => apiCall<Service[]>({ url: '/services' }),
  });

  const orders = useQuery({
    queryKey: ['orders'],
    queryFn: () => apiCall<Paginated<ServiceOrder>>({ url: '/orders', params: { per_page: 10 } }),
  });

  const grouped = useMemo(() => {
    const out: Record<string, Service[]> = {};
    (services.data ?? []).forEach((s) => {
      out[s.category] ??= [];
      out[s.category].push(s);
    });
    return out;
  }, [services.data]);

  const purchase = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Select a service first.');
      return apiCall<ServiceOrder>({
        url: '/services/virtual-number/purchase',
        method: 'POST',
        headers: { 'Idempotency-Key': newIdempotencyKey() },
        data: { service_code: selected.code, service: providerService, country },
      });
    },
    onSuccess(order) {
      toast.success(
        order.delivery?.phone_number
          ? `Number assigned: ${order.delivery.phone_number}`
          : 'Order placed.',
      );
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
    },
    onError(err) {
      toast.error((err as Error).message ?? 'Purchase failed.');
    },
  });

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Services</h1>
        <p className="text-sm text-ink-600 mt-1">All your digital services on one wallet.</p>
      </div>

      {Object.entries(grouped).map(([category, items]) => {
        const Icon = ICONS[category] ?? Sparkles;
        return (
          <section key={category}>
            <h2 className="font-semibold text-ink-800 capitalize mb-3 flex items-center gap-2">
              <Icon className="h-4 w-4" /> {category.replace('_', ' ')}
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((svc) => (
                <button
                  key={svc.code}
                  onClick={() => setSelected(svc)}
                  disabled={!svc.is_active}
                  className={clsx(
                    'card-pad text-left transition border-2',
                    selected?.code === svc.code ? 'border-brand-500 shadow-glow' : 'border-ink-100 hover:border-ink-200',
                    !svc.is_active && 'opacity-60 cursor-not-allowed',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{svc.name}</div>
                    {!svc.is_active && <span className="badge-muted">Soon</span>}
                  </div>
                  <p className="text-xs text-ink-600 mt-1.5">{svc.description}</p>
                </button>
              ))}
            </div>
          </section>
        );
      })}

      {selected && selected.category === 'virtual_number' && (
        <div className="card-pad">
          <h2 className="font-semibold flex items-center gap-2">
            <Phone className="h-4 w-4 text-brand-600" /> Buy a number — {selected.name}
          </h2>
          <div className="mt-4 grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Service</label>
              <select className="input" value={providerService} onChange={(e) => setProviderService(e.target.value)}>
                {COMMON_PROVIDER_SERVICES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Country</label>
              <select className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
                {COMMON_COUNTRIES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <button onClick={() => purchase.mutate()} disabled={purchase.isPending} className="btn-brand mt-5">
            {purchase.isPending ? 'Provisioning…' : 'Buy number'}
          </button>
          <p className="text-xs text-ink-500 mt-3">
            The price is calculated at the moment of purchase. If the provider can't deliver, your wallet is auto-refunded.
          </p>
        </div>
      )}

      <div className="card-pad">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Recent orders</h2>
          <button onClick={() => orders.refetch()} className="btn-ghost text-sm">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
        {orders.isLoading ? (
          <div className="text-sm text-ink-500 py-4">Loading…</div>
        ) : (orders.data?.items.length ?? 0) === 0 ? (
          <div className="text-sm text-ink-500 py-4">No orders yet.</div>
        ) : (
          <ul className="divide-y divide-ink-100">
            {orders.data!.items.map((o) => (
              <li key={o.id} className="py-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{o.service?.name ?? 'Service'}</div>
                  <div className="text-xs text-ink-500 mt-0.5">{formatDate(o.created_at)}</div>
                  {o.delivery?.phone_number && (
                    <div className="mt-1.5 flex items-center gap-2 text-sm font-mono">
                      {o.delivery.phone_number}
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(o.delivery!.phone_number!);
                          toast.success('Copied');
                        }}
                        className="text-ink-500 hover:text-ink-800"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  {o.failure_reason && (
                    <div className="text-xs text-rose-600 mt-1">{o.failure_reason}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-mono font-medium">{formatMoney(o.amount_minor, o.currency)}</div>
                  <div className="mt-0.5"><StatusBadge status={o.status} /></div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
