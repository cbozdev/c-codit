<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\PaymentProvider;
use App\Http\Controllers\Controller;
use App\Http\Requests\Wallet\FundWalletRequest;
use App\Http\Resources\TransactionResource;
use App\Http\Resources\WalletResource;
use App\Models\Transaction;
use App\Services\Payment\NowPaymentsService;
use App\Services\Payment\PaymentOrchestrator;
use App\Services\Wallet\WalletService;
use App\Support\ApiResponse;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class WalletController extends Controller
{
    public function __construct(
        private readonly WalletService $wallets,
        private readonly PaymentOrchestrator $payments,
        private readonly NowPaymentsService $nowpayments,
    ) {}

    public function cryptoMinimums()
    {
        $currencies = ['btc', 'eth', 'usdt', 'bnb', 'sol'];
        $minimums = Cache::remember('np_minimums', 3600, function () use ($currencies) {
            $result = [];
            foreach ($currencies as $coin) {
                $result[$coin] = $this->nowpayments->getMinimumUsd($coin);
            }
            return $result;
        });
        return ApiResponse::ok($minimums);
    }

    public function show(Request $request)
    {
        $wallet = $this->wallets->getOrCreate(
            $request->user(),
            (string) config('services.platform.base_currency'),
        );
        return ApiResponse::ok(new WalletResource($wallet));
    }

    public function fund(FundWalletRequest $request)
    {
        $user         = $request->user();
        $currency     = strtoupper((string) ($request->input('currency') ?: 'NGN'));
        $inputAmount  = (float) $request->input('amount');

        // Always store in USD so wallet credit is consistent regardless of payment currency
        $usdAmount    = $this->convertToUsd($inputAmount, $currency);
        $walletAmount = Money::fromDecimal((string) $usdAmount, 'USD');

        $idempotencyKey = (string) $request->header('Idempotency-Key');
        $providerKey    = $idempotencyKey ?: 'fund:'.$user->id.':'.bin2hex(random_bytes(16));

        $gateway = $this->payments->for(PaymentProvider::from((string) $request->input('provider')));

        try {
            $payment = $gateway->initiate(
                user: $user,
                amount: $walletAmount,
                idempotencyKey: $providerKey,
                options: [
                    'pay_currency'      => $request->input('pay_currency'),
                    'original_amount'   => $inputAmount,
                    'original_currency' => $currency,
                    'deposit_method'    => $request->input('deposit_method'),
                    'description'       => 'Wallet funding',
                    'purpose'           => 'wallet_fund',
                ],
            );
        } catch (\RuntimeException $e) {
            return ApiResponse::fail($e->getMessage(), null, 422);
        }

        return ApiResponse::ok([
            'payment_id'   => $payment->public_id,
            'provider'     => $payment->provider instanceof \BackedEnum ? $payment->provider->value : $payment->provider,
            'checkout_url' => $payment->checkout_url,
            'reference'    => $payment->provider_reference,
            'amount'       => number_format($payment->amount_minor / 100, 2, '.', ''),
            'currency'     => $payment->currency,
            'expires_at'   => $payment->expires_at?->toIso8601String(),
        ], 'Payment initiated.');
    }

    private function convertToUsd(float $amount, string $currency): float
    {
        if ($currency === 'USD') return round($amount, 2);
        $rates = [
            'NGN' => 0.00065, 'GHS' => 0.065, 'KES' => 0.0077,
            'ZAR' => 0.055,   'GBP' => 1.27,  'EUR' => 1.08,
        ];
        return max(0.01, round($amount * ($rates[$currency] ?? 1.0), 2));
    }


    public function transactions(Request $request)
    {
        $request->validate([
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'type'     => ['nullable', 'string'],
            'status'   => ['nullable', 'string'],
        ]);

        $q = Transaction::query()
            ->where('user_id', $request->user()->id)
            ->orderByDesc('id');

        if ($t = $request->input('type'))   $q->where('type', $t);
        if ($s = $request->input('status')) $q->where('status', $s);

        $page = $q->paginate((int) ($request->input('per_page') ?? 20));

        return ApiResponse::ok([
            'items' => TransactionResource::collection($page->items()),
            'meta'  => [
                'current_page' => $page->currentPage(),
                'last_page'    => $page->lastPage(),
                'per_page'     => $page->perPage(),
                'total'        => $page->total(),
            ],
        ]);
    }

    public function transaction(Request $request, string $publicId)
    {
        $tx = Transaction::where('public_id', $publicId)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();
        return ApiResponse::ok(new TransactionResource($tx));
    }
}
