<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\PaymentProvider;
use App\Http\Controllers\Controller;
use App\Http\Requests\Wallet\FundWalletRequest;
use App\Http\Resources\TransactionResource;
use App\Http\Resources\WalletResource;
use App\Models\Transaction;
use App\Services\Payment\PaymentOrchestrator;
use App\Services\Wallet\WalletService;
use App\Support\ApiResponse;
use App\Support\Money;
use Illuminate\Http\Request;

class WalletController extends Controller
{
    public function __construct(
        private readonly WalletService $wallets,
        private readonly PaymentOrchestrator $payments,
    ) {}

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
        $user = $request->user();
        $currency = strtoupper((string) ($request->input('currency') ?: config('services.platform.base_currency')));
        $amount = Money::fromDecimal((string) $request->input('amount'), $currency);

        $idempotencyKey = (string) $request->header('Idempotency-Key');
        // The idempotent middleware also gates this; we re-use the key for payment row dedup.
        $providerKey = $idempotencyKey ?: 'fund:'.$user->id.':'.bin2hex(random_bytes(16));

        $gateway = $this->payments->for(PaymentProvider::from((string) $request->input('provider')));

        $payment = $gateway->initiate(
            user: $user,
            amount: $amount,
            idempotencyKey: $providerKey,
            options: [
                'pay_currency' => $request->input('pay_currency'),
                'description'  => 'Wallet funding',
                'purpose'      => 'wallet_fund',
            ],
        );

        return ApiResponse::ok([
            'payment_id'    => $payment->public_id,
            'provider'      => $payment->provider instanceof \BackedEnum ? $payment->provider->value : $payment->provider,
            'checkout_url'  => $payment->checkout_url,
            'reference'     => $payment->provider_reference,
            'amount'        => number_format($payment->amount_minor / 100, 2, '.', ''),
            'currency'      => $payment->currency,
            'expires_at'    => $payment->expires_at?->toIso8601String(),
        ], 'Payment initiated.');
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
