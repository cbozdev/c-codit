import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiCall, newIdempotencyKey } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import type { FundingResponse, Wallet } from '@/types/api';
import { CreditCard, Bitcoin, ArrowDownToLine, ExternalLink } from 'lucide-react';
import { clsx } from 'clsx';

type Provider = 'flutterwave' | 'nowpayments';

const QUICK = [10, 25, 50, 100, 250, 500];

export default function WalletPage() {
  const qc = useQueryClient();
  const [amount, setAmount] = useState('25');
  const [provider, setProvider] = useState<Provider>('flutterwave');
  const [payCurrency, setPayCurrency] = useState('usdttrc20');

  const wallet = useQuery({
    queryKey: ['wallet'],
    queryFn: () => apiCall<Wallet>({ url: '/wallet' }),
  });

  const fund = useMutation({
    mutationFn: () => apiCall<FundingResponse>({
      url: '/wallet/fund',
      method: 'POST',
      headers: { 'Idempotency-Key': newIdempotencyKey() },
      data: {
        amount: parseFloat(amount),
        provider,
        currency: 'USD',
        ...(provider === 'nowpayments' ? { pay_currency: payCurrency } : {}),
      },
    }),
    onSuccess(data) {
      qc.invalidateQueries({ queryKey: ['wallet'] });
      window.location.href = data.checkout_url;
    },
    onError(err) {
      toast.error((err as Error).message ?? 'Could not start payment.');
    },
  });

  const numericAmount = parseFloat(amount || '0');
  const canSubmit = !fund.isPending && numericAmount >= 1 && numericAmount <= 10_000;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Wallet</h1>
        <p className="text-sm text-ink-600 mt-1">Manage your balance and top up.</p>
      </div>

      {/* Balance */}
      <div className="card-pad bg-gradient-to-br from-ink-950 to-ink-900 text-white border-ink-950">
        <div className="text-sm text-ink-300">Available balance</div>
        <div className="mt-2 text-4xl font-semibold tracking-tight">
          {wallet.isLoading
            ? <span className="inline-block bg-ink-700 rounded h-9 w-44 animate-pulse" />
            : formatMoney(wallet.data?.balance_minor ?? 0, wallet.data?.currency ?? 'USD')}
        </div>
        {wallet.data?.is_frozen && (
          <div className="mt-3 badge-danger">Wallet frozen — {wallet.data.frozen_reason}</div>
        )}
      </div>

      {/* Fund form */}
      <div className="card-pad">
        <h2 className="font-semibold flex items-center gap-2">
          <ArrowDownToLine className="h-4 w-4 text-brand-600" /> Add funds
        </h2>

        <div className="mt-5 space-y-5">
          {/* Amount */}
          <div>
            <label className="label">Amount (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500">$</span>
              <input type="number" min="1" max="10000" step="0.01"
                value={amount} onChange={(e) => setAmount(e.target.value)}
                className="input pl-7 text-lg font-semibold" />
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {QUICK.map((q) => (
                <button key={q} type="button" onClick={() => setAmount(String(q))}
                  className={clsx(
                    'px-3 py-1.5 text-xs rounded-full border transition',
                    parseFloat(amount) === q
                      ? 'bg-ink-900 text-white border-ink-900'
                      : 'border-ink-200 text-ink-700 hover:border-ink-300',
                  )}>
                  ${q}
                </button>
              ))}
            </div>
          </div>

          {/* Provider */}
          <div>
            <label className="label">Payment method</label>
            <div className="grid sm:grid-cols-2 gap-3">
              <button type="button" onClick={() => setProvider('flutterwave')}
                className={clsx(
                  'card-pad text-left transition border-2',
                  provider === 'flutterwave' ? 'border-brand-500 shadow-glow' : 'border-ink-100 hover:border-ink-200',
                )}>
                <div className="flex items-center justify-between">
                  <CreditCard className="h-5 w-5 text-ink-700" />
                  <span className="badge-muted">Card</span>
                </div>
                <div className="mt-3 font-semibold">Flutterwave</div>
                <div className="text-xs text-ink-600 mt-1">Cards, bank transfer, mobile money.</div>
              </button>
              <button type="button" onClick={() => setProvider('nowpayments')}
                className={clsx(
                  'card-pad text-left transition border-2',
                  provider === 'nowpayments' ? 'border-brand-500 shadow-glow' : 'border-ink-100 hover:border-ink-200',
                )}>
                <div className="flex items-center justify-between">
                  <Bitcoin className="h-5 w-5 text-ink-700" />
                  <span className="badge-muted">Crypto</span>
                </div>
                <div className="mt-3 font-semibold">NowPayments</div>
                <div className="text-xs text-ink-600 mt-1">USDT, BTC, ETH and more.</div>
              </button>
            </div>
          </div>

          {provider === 'nowpayments' && (
            <div>
              <label className="label">Pay with</label>
              <select value={payCurrency} onChange={(e) => setPayCurrency(e.target.value)} className="input">
                <option value="usdttrc20">USDT (TRC-20)</option>
                <option value="usdterc20">USDT (ERC-20)</option>
                <option value="btc">Bitcoin (BTC)</option>
                <option value="eth">Ethereum (ETH)</option>
                <option value="ltc">Litecoin (LTC)</option>
              </select>
            </div>
          )}

          <button onClick={() => fund.mutate()} disabled={!canSubmit} className="btn-brand w-full">
            {fund.isPending ? 'Preparing checkout…' : <>Continue <ExternalLink className="h-4 w-4" /></>}
          </button>

          <p className="text-xs text-ink-500">
            You'll be redirected to {provider === 'flutterwave' ? 'Flutterwave' : 'NowPayments'} to complete payment.
            Your wallet will be credited automatically once the payment is verified.
          </p>
        </div>
      </div>
    </div>
  );
}
