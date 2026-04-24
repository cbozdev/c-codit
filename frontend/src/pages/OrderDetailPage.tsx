import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiCall } from '@/lib/api';
import { formatMoney, formatDate } from '@/lib/format';
import type { ServiceOrder } from '@/types/api';
import {
  Copy, CheckCircle2, XCircle, Clock, RefreshCw,
  Phone, ArrowLeft, AlertTriangle, Shield,
} from 'lucide-react';
import { clsx } from 'clsx';
import { StatusBadge } from '@/components/StatusBadge';

const TIMEOUT_SECONDS = 600; // 10 minutes

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [copied, setCopied]         = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [now, setNow]               = useState(() => Date.now());

  const order = useQuery({
    queryKey: ['order', id],
    queryFn: () => apiCall<ServiceOrder>({ url: `/orders/${id}` }),
  });

  // Actively poll 5sim for SMS code every 5 seconds when waiting
  useEffect(() => {
    const delivery = order.data?.delivery as Record<string, unknown> | null;
    const smsCode  = delivery?.sms_code as string | null;
    const status   = order.data?.status;

    if (status !== 'completed' || smsCode) return;

    const interval = setInterval(async () => {
      try {
        const res = await apiCall<{ code: string | null }>({
          method: 'POST',
          url: `/orders/${id}/fetch-code`,
        });
        if (res.code) {
          // Code arrived — refetch order to get updated delivery
          qc.invalidateQueries({ queryKey: ['order', id] });
          qc.invalidateQueries({ queryKey: ['orders'] });
          clearInterval(interval);
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [order.data?.status, (order.data?.delivery as Record<string, unknown> | null)?.sms_code, id, qc]);

  // Tick every second for the timer — uses a fixed reference point
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const o        = order.data;
  const delivery = o?.delivery as Record<string, unknown> | null;
  const phoneNumber  = delivery?.phone_number as string | null;
  const smsCode      = delivery?.sms_code as string | null;
  const provisionedAt = o?.provisioned_at ? new Date(o.provisioned_at).getTime() : null;

  // Timer based on server provisioned_at timestamp — survives navigation
  const elapsed  = provisionedAt ? Math.floor((now - provisionedAt) / 1000) : 0;
  const timeLeft = Math.max(0, TIMEOUT_SECONDS - elapsed);
  const mins     = Math.floor(timeLeft / 60);
  const secs     = timeLeft % 60;
  const urgentTime  = timeLeft < 120 && timeLeft > 0;
  const isExpired   = timeLeft === 0 && !!provisionedAt && !smsCode;
  const isVirtualNumber = !!phoneNumber || o?.service?.code?.includes('vnum');
  const isRefunded  = o?.status === 'refunded';

  // Pull service name from request metadata
  const request = o?.request as Record<string, unknown> | null;
  const serviceName = request?.service as string | null;
  const country     = request?.country as string | null;

  const cancel = useMutation({
    mutationFn: () => apiCall<null>({ method: 'POST', url: `/orders/${id}/cancel` }),
    onSuccess: () => {
      toast.success('Number cancelled. Wallet refunded.');
      qc.invalidateQueries({ queryKey: ['order', id] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
    },
    onError: (e) => toast.error((e as Error).message ?? 'Could not cancel.'),
  });

  function copyPhone() {
    if (!phoneNumber) return;
    navigator.clipboard.writeText(phoneNumber);
    setCopied(true);
    toast.success('Phone number copied!');
    setTimeout(() => setCopied(false), 2000);
  }

  function copyCode() {
    if (!smsCode) return;
    navigator.clipboard.writeText(smsCode);
    setCodeCopied(true);
    toast.success('Code copied!');
    setTimeout(() => setCodeCopied(false), 2000);
  }

  if (order.isLoading) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="h-8 w-48 bg-ink-100 dark:bg-ink-800 rounded animate-pulse" />
        <div className="card-pad space-y-4">
          {[1,2,3].map((i) => (
            <div key={i} className="h-12 bg-ink-100 dark:bg-ink-800 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!o) {
    return (
      <div className="card-pad max-w-2xl text-center">
        <XCircle className="h-12 w-12 text-rose-400 mx-auto mb-3" />
        <p className="font-medium dark:text-white">Order not found</p>
        <button onClick={() => navigate('/services')} className="btn-outline mt-4">Back to services</button>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <button onClick={() => navigate('/services')} className="btn-ghost -ml-2 text-sm">
        <ArrowLeft className="h-4 w-4" /> Back to services
      </button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight dark:text-white">
            {o.service?.name ?? 'Order'}
          </h1>
          {/* Show which service was purchased */}
          {serviceName && (
            <div className="flex items-center gap-2 mt-1">
              <span className="badge-muted capitalize">{serviceName}</span>
              {country && <span className="badge-muted capitalize">{country}</span>}
            </div>
          )}
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">{formatDate(o.created_at)}</p>
        </div>
        <StatusBadge status={o.status} />
      </div>

      {/* Virtual number card */}
      {isVirtualNumber && phoneNumber && (
        <div className={clsx(
          'rounded-2xl p-6 border-2',
          isRefunded
            ? 'bg-ink-900 border-ink-700'
            : 'bg-gradient-to-br from-ink-950 to-ink-900 border-brand-500/30',
        )}>
          {/* Phone number */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/20">
              <Phone className="h-5 w-5 text-brand-400" />
            </div>
            <div>
              <div className="text-xs text-ink-400 uppercase tracking-wide">Your number</div>
              <div className="text-2xl font-mono font-semibold text-white tracking-wide">{phoneNumber}</div>
            </div>
            <button onClick={copyPhone}
              className={clsx(
                'ml-auto p-2.5 rounded-xl transition',
                copied ? 'bg-brand-500 text-white' : 'bg-ink-800 text-ink-300 hover:bg-ink-700',
              )}>
              {copied ? <CheckCircle2 className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
            </button>
          </div>

          {/* Timer */}
          {!smsCode && !isRefunded && (
            <div className={clsx(
              'flex items-center gap-2 text-sm rounded-lg px-3 py-2 mb-4',
              isExpired   ? 'bg-rose-500/20 text-rose-300'
              : urgentTime ? 'bg-amber-500/20 text-amber-300'
              : 'bg-ink-800 text-ink-300',
            )}>
              <Clock className={clsx('h-4 w-4 shrink-0', (urgentTime || isExpired) && 'animate-pulse')} />
              {isExpired ? (
                <span>⏰ Time expired — cancel for a full refund</span>
              ) : (
                <span>
                  {urgentTime ? '⚠ Expiring soon — ' : 'Time remaining: '}
                  <span className="font-mono font-semibold">
                    {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                  </span>
                </span>
              )}
            </div>
          )}

          {/* SMS Code box */}
          <div className={clsx(
            'rounded-xl border-2 p-4',
            smsCode
              ? 'border-brand-500 bg-brand-500/10'
              : 'border-dashed border-ink-700',
          )}>
            {smsCode ? (
              <div>
                <div className="flex items-center gap-2 text-brand-400 text-xs uppercase tracking-wide mb-2">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Verification code received
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="text-4xl font-mono font-bold text-white tracking-[0.2em]">{smsCode}</div>
                  <button onClick={copyCode}
                    className={clsx(
                      'p-2.5 rounded-xl transition',
                      codeCopied ? 'bg-brand-500 text-white' : 'bg-ink-800 text-ink-300 hover:bg-ink-700',
                    )}>
                    {codeCopied ? <CheckCircle2 className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            ) : isRefunded ? (
              <div className="text-center py-2">
                <XCircle className="h-8 w-8 text-rose-400 mx-auto mb-2" />
                <p className="text-ink-300 text-sm">Number cancelled — wallet refunded</p>
              </div>
            ) : (
              <div className="text-center py-3">
                <div className="flex items-center justify-center gap-2 text-ink-400 mb-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Waiting for SMS code…</span>
                </div>
                <p className="text-xs text-ink-500">
                  Use the number above to request your verification code. It will appear here automatically.
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          {!smsCode && !isRefunded && (
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={async () => {
                  try {
                    const res = await apiCall<{ code: string | null }>({
                      method: 'POST',
                      url: `/orders/${id}/fetch-code`,
                    });
                    if (res.code) {
                      toast.success('Code received!');
                      qc.invalidateQueries({ queryKey: ['order', id] });
                      qc.invalidateQueries({ queryKey: ['orders'] });
                    } else {
                      toast('No code yet. Keep waiting…', { icon: '⏳' });
                    }
                  } catch (e) {
                    toast.error((e as Error).message ?? 'Could not check for code.');
                  }
                }}
                className="btn-outline flex-1 text-sm border-ink-700 text-ink-300 hover:bg-ink-800"
              >
                <RefreshCw className="h-4 w-4" />
                Check for code
              </button>
              <button
                onClick={() => {
                  if (confirm('Cancel this number? You will receive a full refund.')) {
                    cancel.mutate();
                  }
                }}
                disabled={cancel.isPending}
                className="btn flex-1 text-sm border border-rose-800 bg-rose-950/40 text-rose-400 hover:bg-rose-950/80"
              >
                <XCircle className="h-4 w-4" />
                {cancel.isPending ? 'Cancelling…' : 'Cancel & refund'}
              </button>
            </div>
          )}

          {!smsCode && !isRefunded && (
            <div className="mt-4 flex items-start gap-2 text-xs text-ink-400">
              <Shield className="h-3.5 w-3.5 mt-0.5 shrink-0 text-brand-500" />
              <span>
                Enter this number on the platform you're verifying. The SMS code appears above automatically.
                If no code arrives within 10 minutes, cancel for a full refund.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Order summary */}
      <div className="card-pad">
        <h2 className="font-semibold dark:text-white mb-4">Order summary</h2>
        <div className="space-y-3 text-sm">
          <Row label="Reference"    value={o.id} mono />
          <Row label="Service"      value={o.service?.name ?? '—'} />
          {serviceName && <Row label="For"       value={<span className="capitalize">{serviceName}</span>} />}
          {country     && <Row label="Country"   value={<span className="capitalize">{country}</span>} />}
          <Row label="Amount"       value={formatMoney(o.amount_minor, o.currency)} />
          <Row label="Status"       value={<StatusBadge status={o.status} />} />
          {o.provisioned_at && <Row label="Provisioned" value={formatDate(o.provisioned_at)} />}
          {o.refunded_at    && <Row label="Refunded"    value={formatDate(o.refunded_at)} />}
          {o.failure_reason && (
            <div className="flex items-start gap-2 mt-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900">
              <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-700 dark:text-rose-300">{o.failure_reason}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-ink-500 dark:text-ink-400 shrink-0">{label}</span>
      <span className={clsx('text-right text-ink-900 dark:text-ink-100', mono && 'font-mono text-xs break-all')}>
        {value}
      </span>
    </div>
  );
}
