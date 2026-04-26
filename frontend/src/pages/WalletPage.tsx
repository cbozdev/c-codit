import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiCall, newIdempotencyKey } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import type { FundingResponse, Wallet } from '@/types/api';
import { CreditCard, Bitcoin, ArrowDownToLine, ExternalLink, ChevronDown, Landmark, Smartphone } from 'lucide-react';
import { clsx } from 'clsx';

type Provider = 'flutterwave' | 'nowpayments';
type DepositMethod = 'banktransfer' | 'ussd' | 'card';

const NGN_DEPOSIT_METHODS: { value: DepositMethod; label: string; sub: string; Icon: React.ElementType }[] = [
  { value: 'banktransfer', label: 'Bank Transfer', sub: 'Pay via internet banking',  Icon: Landmark    },
  { value: 'ussd',         label: 'USSD',          sub: 'Dial code — works offline', Icon: Smartphone  },
  { value: 'card',         label: 'Card',           sub: 'Debit or credit card',      Icon: CreditCard  },
];

const CURRENCIES = [
  { value: 'NGN', label: '🇳🇬 Nigerian Naira (NGN)', symbol: '₦', quick: [500, 1000, 2000, 5000, 10000, 20000], min: 100 },
  { value: 'USD', label: '🇺🇸 US Dollar (USD)',      symbol: '$', quick: [5, 10, 25, 50, 100, 250], min: 1 },
  { value: 'GHS', label: '🇬🇭 Ghanaian Cedi (GHS)',  symbol: 'GH₵', quick: [10, 20, 50, 100, 200, 500], min: 5 },
  { value: 'KES', label: '🇰🇪 Kenyan Shilling (KES)', symbol: 'KSh', quick: [500, 1000, 2000, 5000, 10000, 20000], min: 100 },
  { value: 'ZAR', label: '🇿🇦 South African Rand (ZAR)', symbol: 'R', quick: [50, 100, 200, 500, 1000, 2000], min: 10 },
  { value: 'GBP', label: '🇬🇧 British Pound (GBP)',  symbol: '£', quick: [5, 10, 25, 50, 100, 250], min: 1 },
  { value: 'EUR', label: '🇪🇺 Euro (EUR)',            symbol: '€', quick: [5, 10, 25, 50, 100, 250], min: 1 },
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
  const [currency, setCurrency]       = useState('NGN');
  const [amount, setAmount]           = useState('1000');
  const [provider, setProvider]       = useState<Provider>('flutterwave');
  const [payCurrency, setPayCurrency]       = useState('usdttrc20');
  const [depositMethod, setDepositMethod]   = useState<DepositMethod>('banktransfer');

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
        ...(provider === 'nowpayments'
          ? { pay_currency: payCurrency }
          : currency === 'NGN' ? { deposit_method: depositMethod } : {}
        ),
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

  const cur        = CURRENCIES.find((c) => c.value === currency) ?? CURRENCIES[0];
  const numericAmt = parseFloat(amount || '0');
  // $10 minimum for all crypto (matches backend NowPayments enforcement)
  const minAmount  = provider === 'nowpayments' ? 10 : cur.min;
  const canSubmit  = !fund.isPending && numericAmt >= minAmount;

  function handleCurrencyChange(val: string) {
    setCurrency(val);
    const newCur = CURRENCIES.find((c) => c.value === val);
    if (newCur) setAmount(String(newCur.quick[1]));
  }

  function switchProvider(p: Provider) {
    setProvider(p);
    if (p === 'nowpayments') {
      setAmount('25');
    } else {
      setAmount(cur.quick[1].toString());
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-white">Wallet</h1>
        <p className="text-sm text-ink-600 dark:text-ink-400 mt-1">Add funds to your wallet to use C-codit services.</p>
      </div>

      {/* Balance card */}
      <div className="rounded-2xl p-6 bg-gradient-to-br from-ink-950 to-ink-900 text-white border border-ink-900">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm text-ink-300">Available balance</div>
            <div className="mt-2 text-4xl font-semibold tracking-tight">
              {wallet.isLoading
                ? <span className="inline-block bg-ink-700 rounded h-9 w-44 animate-pulse" />
                : formatMoney(wallet.data?.balance_minor ?? 0, wallet.data?.currency ?? 'USD')}
            </div>
            <div className="text-ink-400 text-sm mt-1">{wallet.data?.currency ?? 'USD'} wallet</div>
          </div>
        </div>
        {wallet.data?.is_frozen && (
          <div className="mt-3 inline-flex items-center gap-1.5 bg-rose-500/20 text-rose-300 text-xs px-3 py-1.5 rounded-full">
            🔒 Wallet frozen — {wallet.data.frozen_reason}
          </div>
        )}
      </div>

      {/* Fund form */}
      <div className="card-pad">
        <h2 className="font-semibold flex items-center gap-2 text-ink-900 dark:text-white mb-5">
          <ArrowDownToLine className="h-4 w-4 text-brand-600" /> Add funds
        </h2>

        <div className="space-y-5">
          {/* Provider selection */}
          <div>
            <label className="label">Payment method</label>
            <div className="grid sm:grid-cols-2 gap-3">
              {/* Flutterwave */}
              <button type="button" onClick={() => switchProvider('flutterwave')}
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
                  Nigerian bank transfer, USSD, card, mobile money
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {['Bank Transfer', 'USSD', 'Card', 'Mobile Money'].map((m) => (
                    <span key={m} className="text-[10px] bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-400 px-1.5 py-0.5 rounded">{m}</span>
                  ))}
                </div>
              </button>

              {/* NowPayments */}
              <button type="button" onClick={() => switchProvider('nowpayments')}
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
                  USDT, BTC, ETH, BNB and 100+ coins
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {['USDT', 'BTC', 'ETH', 'BNB', 'SOL'].map((m) => (
                    <span key={m} className="text-[10px] bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-400 px-1.5 py-0.5 rounded">{m}</span>
                  ))}
                </div>
              </button>
            </div>
          </div>

          {/* Currency selector — Flutterwave only */}
          {provider === 'flutterwave' && (
            <div>
              <label className="label">Currency</label>
              <div className="relative">
                <select value={currency} onChange={(e) => handleCurrencyChange(e.target.value)} className="input appearance-none pr-8">
                  {CURRENCIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400 pointer-events-none" />
              </div>
              {currency === 'NGN' && (
                <div className="mt-3 space-y-2">
                  <label className="label">Deposit method</label>
                  <div className="grid grid-cols-3 gap-2">
                    {NGN_DEPOSIT_METHODS.map(({ value, label, sub, Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setDepositMethod(value)}
                        className={clsx(
                          'flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 text-center transition',
                          depositMethod === value
                            ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30 shadow-glow'
                            : 'border-ink-100 hover:border-ink-300 dark:border-ink-700 dark:hover:border-ink-500',
                        )}
                      >
                        <Icon className={clsx(
                          'h-5 w-5',
                          depositMethod === value ? 'text-brand-600 dark:text-brand-400' : 'text-ink-500 dark:text-ink-400',
                        )} />
                        <span className={clsx(
                          'text-xs font-semibold',
                          depositMethod === value ? 'text-brand-700 dark:text-brand-300' : 'text-ink-700 dark:text-ink-300',
                        )}>{label}</span>
                        <span className="text-[10px] text-ink-500 dark:text-ink-400 leading-tight">{sub}</span>
                      </button>
                    ))}
                  </div>
                  {depositMethod === 'banktransfer' && (
                    <div className="flex items-start gap-2 text-xs text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-900 rounded-lg px-3 py-2">
                      🏦 A virtual account number will be generated for your transfer at checkout.
                    </div>
                  )}
                  {depositMethod === 'ussd' && (
                    <div className="flex items-start gap-2 text-xs text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-900 rounded-lg px-3 py-2">
                      📲 You'll get a USSD code to dial on your phone — no internet required.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Crypto selector — NowPayments only */}
          {provider === 'nowpayments' && (
            <div>
              <label className="label">Preferred cryptocurrency</label>
              <div className="relative">
                <select value={payCurrency} onChange={(e) => { setPayCurrency(e.target.value); if (parseFloat(amount) < 5) setAmount('10'); }} className="input appearance-none pr-8">
                  {CRYPTO_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400 pointer-events-none" />
              </div>
              <div className="mt-2 text-xs text-ink-500 dark:text-ink-400 bg-ink-50 dark:bg-ink-800/50 border border-ink-200 dark:border-ink-700 rounded-lg px-3 py-2">
                You can change your cryptocurrency on NowPayments' secure checkout page.
              </div>
              <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2">
                ⚠ Minimum: <strong>$10 USD</strong> for all cryptocurrencies.
              </div>
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="label">
              Amount {provider === 'flutterwave' ? `(${currency})` : '(USD)'}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 font-medium select-none">
                {provider === 'nowpayments' ? '$' : cur.symbol}
              </span>
              <input
                type="number"
                min={minAmount}
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input pl-8 text-lg font-semibold"
                placeholder={`Min ${minAmount}`}
              />
            </div>
            {!canSubmit && numericAmt > 0 && (
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                Minimum amount is {provider === 'nowpayments' ? '$' : cur.symbol}{minAmount}
              </p>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              {(provider === 'nowpayments'
                ? [10, 25, 50, 100, 200, 500]
                : cur.quick
              ).map((q) => (
                <button key={q} type="button" onClick={() => setAmount(String(q))}
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
          <button onClick={() => fund.mutate()} disabled={!canSubmit} className="btn-brand w-full py-3 text-base">
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
