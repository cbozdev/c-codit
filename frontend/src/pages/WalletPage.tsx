import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiCall, newIdempotencyKey } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import type { FundingResponse, Wallet } from '@/types/api';
import { CreditCard, Bitcoin, ArrowDownToLine, ExternalLink } from 'lucide-react';
import { clsx } from 'clsx';

type Provider = 'flutterwave' | 'nowpayments';

const CURRENCIES = [
  { value: 'NGN', label: '🇳🇬 Nigerian Naira (NGN)', symbol: '₦', quick: [500, 1000, 2000, 5000, 10000, 20000] },
  { value: 'USD', label: '🇺🇸 US Dollar (USD)',      symbol: '$', quick: [5, 10, 25, 50, 100, 250] },
  { value: 'GHS', label: '🇬🇭 Ghanaian Cedi (GHS)',  symbol: 'GH₵', quick: [10, 20, 50, 100, 200, 500] },
  { value: 'KES', label: '🇰🇪 Kenyan Shilling (KES)', symbol: 'KSh', quick: [500, 1000, 2000, 5000, 10000, 20000] },
  { value: 'ZAR', label: '🇿🇦 South African Rand (ZAR)', symbol: 'R', quick: [50, 100, 200, 500, 1000, 2000] },
  { value: 'GBP', label: '🇬🇧 British Pound (GBP)',  symbol: '£', quick: [5, 10, 25, 50, 100, 250] },
  { value: 'EUR', label: '🇪🇺 Euro (EUR)',            symbol: '€', quick: [5, 10, 25, 50, 100, 250] },
];

const CRYPTO_OPTIONS = [
  { value: 'usdttrc20', label: 'USDT (TRC-20) — recommended' },
  { value: 'usdterc20', label: 'USDT (ERC-20)' },
  { value: 'usdtbsc',   label: 'USDT (BEP-20 / BSC)' },
  { value: 'btc',       label: 'Bitcoin (BTC)' },
  { value: 'eth',       label: 'Ethereum (ETH)' },
  { value: 'bnbbsc',    label: 'BNB (BSC)' },
  { value: 'ltc',       label: 'Litecoin (LTC)' },
  { value: 'trx',       label: 'TRON (TRX)' },
  { value: 'sol',       label: 'Solana (SOL)' },
];

export default function WalletPage() {
  const qc = useQueryClient();
  // Default to NGN so Nigerian bank transfer shows on Flutterwave
  const [currency, setCurrency]       = useState('NGN');
  const [amount, setAmount]           = useState('1000');
  const [provider, setProvider]       = useState<Provider>('flutterwave');
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
        amount:   parseFloat(amount),
        currency: provider === 'nowpayments' ? 'USD' : currency,
        provider,
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

  const cur         = CURRENCIES.find((c) => c.value === currency) ?? CURRENCIES[0];
  const numericAmt  = parseFloat(amount || '0');
  const minAmount  = provider === 'nowpayments' ? 20 : 1;
  const canSubmit  = !fund.isPending && numericAmt >= minAmount;

  function handleCurrencyChange(val: string) {
    setCurrency(val);
    const newCur = CURRENCIES.find((c) => c.value === val);
    if (newCur) setAmount(String(newCur.quick[1])); // pick a sensible default amount
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-white">Wallet</h1>
        <p className="text-sm text-ink-600 dark:text-ink-400 mt-1">Manage your balance and top up.</p>
      </div>

      {/* Balance card */}
      <div className="rounded-2xl p-6 bg-gradient-to-br from-ink-950 to-ink-900 text-white border border-ink-900">
        <div className="text-sm text-ink-300">Available balance</div>
        <div className="mt-2 text-4xl font-semibold tracking-tight">
          {wallet.isLoading
            ? <span className="inline-block bg-ink-700 rounded h-9 w-44 animate-pulse" />
            : formatMoney(wallet.data?.balance_minor ?? 0, wallet.data?.currency ?? 'USD')}
        </div>
        <div className="text-ink-400 text-sm mt-1">{wallet.data?.currency ?? 'USD'} · Platform wallet</div>
        {wallet.data?.is_frozen && (
          <div className="mt-3 inline-flex items-center gap-1.5 bg-rose-500/20 text-rose-300 text-xs px-3 py-1.5 rounded-full">
            🔒 Wallet frozen — {wallet.data.frozen_reason}
          </div>
        )}
      </div>

      {/* Fund form */}
      <div className="card-pad">
        <h2 className="font-semibold flex items-center gap-2 text-ink-900 dark:text-white">
          <ArrowDownToLine className="h-4 w-4 text-brand-600" /> Add funds
        </h2>

        <div className="mt-5 space-y-5">

          {/* Payment method */}
          <div>
            <label className="label">Payment method</label>
            <div className="grid sm:grid-cols-2 gap-3">
              <button type="button" onClick={() => { setProvider('flutterwave'); setAmount('1000'); }}
                className={clsx(
                  'card-pad text-left transition border-2',
                  provider === 'flutterwave'
                    ? 'border-brand-500 shadow-glow'
                    : 'border-ink-100 hover:border-ink-200 dark:border-ink-700 dark:hover:border-ink-600',
                )}>
                <div className="flex items-center justify-between">
                  <CreditCard className="h-5 w-5 text-ink-700 dark:text-ink-300" />
                  <span className="badge-success text-[10px]">Recommended</span>
                </div>
                <div className="mt-3 font-semibold dark:text-white">Flutterwave</div>
                <div className="text-xs text-ink-600 dark:text-ink-400 mt-1">
                  Bank transfer, USSD, card, mobile money.
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {['Bank Transfer', 'USSD', 'Card', 'Mobile Money'].map((m) => (
                    <span key={m} className="text-[10px] bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-400 px-1.5 py-0.5 rounded">
                      {m}
                    </span>
                  ))}
                </div>
              </button>

              <button type="button" onClick={() => { setProvider('nowpayments'); setAmount('10'); }}
                className={clsx(
                  'card-pad text-left transition border-2',
                  provider === 'nowpayments'
                    ? 'border-brand-500 shadow-glow'
                    : 'border-ink-100 hover:border-ink-200 dark:border-ink-700 dark:hover:border-ink-600',
                )}>
                <div className="flex items-center justify-between">
                  <Bitcoin className="h-5 w-5 text-ink-700 dark:text-ink-300" />
                  <span className="badge-muted text-[10px]">Crypto</span>
                </div>
                <div className="mt-3 font-semibold dark:text-white">NowPayments</div>
                <div className="text-xs text-ink-600 dark:text-ink-400 mt-1">
                  USDT, BTC, ETH, BNB and 100+ coins.
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {['USDT', 'BTC', 'ETH', 'BNB', 'SOL'].map((m) => (
                    <span key={m} className="text-[10px] bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-400 px-1.5 py-0.5 rounded">
                      {m}
                    </span>
                  ))}
                </div>
              </button>
            </div>
          </div>

          {/* Currency selector — only for Flutterwave */}
          {provider === 'flutterwave' && (
            <div>
              <label className="label">Currency</label>
              <select
                value={currency}
                onChange={(e) => handleCurrencyChange(e.target.value)}
                className="input"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              {currency === 'NGN' && (
                <div className="mt-2 flex items-center gap-2 text-xs text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-900 rounded-lg px-3 py-2">
                  🇳🇬 Bank transfer, USSD and mobile money will be available on the checkout page.
                </div>
              )}
            </div>
          )}

              {provider === 'nowpayments' && (
                <div>
                  <label className="label">Pay with</label>
                  <select value={payCurrency} onChange={(e) => setPayCurrency(e.target.value)} className="input">
                    {CRYPTO_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
                    ⚠ Minimum deposit is <strong>$20 USD</strong> for crypto payments due to blockchain network fees.
                  </p>
                </div>
              )}

          {/* Amount */}
          <div>
            <label className="label">
              Amount {provider === 'flutterwave' ? `(${currency})` : '(USD)'}
            </label>
            {provider === 'nowpayments' && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mb-1.5">
                ⚠ Minimum $10 USD for crypto payments.
              </p>
            )}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 font-medium select-none">
                {provider === 'nowpayments' ? '$' : cur.symbol}
              </span>
              <input
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input pl-8 text-lg font-semibold"
                placeholder="Enter amount"
              />
            </div>
            {/* Quick amount buttons */}
            <div className="flex flex-wrap gap-2 mt-3">
              {(provider === 'nowpayments' ? [20, 50, 100, 250, 500] : cur.quick).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmount(String(q))}
                  className={clsx(
                    'px-3 py-1.5 text-xs rounded-full border transition',
                    parseFloat(amount) === q
                      ? 'bg-ink-900 text-white border-ink-900 dark:bg-white dark:text-ink-900'
                      : 'border-ink-200 text-ink-700 hover:border-ink-300 dark:border-ink-700 dark:text-ink-300 dark:hover:border-ink-500',
                  )}>
                  {provider === 'nowpayments' ? '$' : cur.symbol}{q.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={() => fund.mutate()}
            disabled={!canSubmit}
            className="btn-brand w-full py-3 text-base"
          >
            {fund.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-950/30 border-t-ink-950" />
                Preparing checkout…
              </span>
            ) : (
              <>
                Continue to {provider === 'flutterwave' ? 'Flutterwave' : 'NowPayments'}
                <ExternalLink className="h-4 w-4" />
              </>
            )}
          </button>

          <p className="text-xs text-ink-500 dark:text-ink-400 text-center">
            You'll be redirected to complete payment securely.
            Your wallet is credited automatically once verified.
          </p>
        </div>
      </div>
    </div>
  );
}
