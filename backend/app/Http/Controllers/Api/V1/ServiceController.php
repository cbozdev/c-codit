<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\ServiceOrderResource;
use App\Http\Resources\ServiceResource;
use App\Models\Service;
use App\Models\ServiceOrder;
use App\Services\ServicePurchaseService;
use App\Services\Sms\ServiceUnavailableException;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class ServiceController extends Controller
{
    public function __construct(private readonly ServicePurchaseService $purchases) {}

    public function index()
    {
        $services = Service::where('is_active', true)
            ->orderBy('category')
            ->orderBy('name')
            ->get();
        return ApiResponse::ok(ServiceResource::collection($services));
    }

    public function show(string $code)
    {
        $service = Service::where('code', $code)->firstOrFail();
        return ApiResponse::ok(new ServiceResource($service));
    }

    /**
     * Unified purchase endpoint — handles virtual numbers, utility bills, gift cards.
     */
    public function purchase(Request $request)
    {
        $request->validate([
            'service_code'    => ['required', 'string', 'exists:services,code'],
            // Virtual number fields
            'service'         => ['nullable', 'string', 'max:40'],
            'country'         => ['nullable', 'string', 'max:20'],
            // Utility bill fields
            'amount'          => ['nullable', 'numeric', 'min:1', 'max:1000000'],
            'network'         => ['nullable', 'string', 'max:30'],
            'phone_number'    => ['nullable', 'string', 'max:20'],
            'meter_number'    => ['nullable', 'string', 'max:30'],
            'smartcard_number'=> ['nullable', 'string', 'max:30'],
            'plan'            => ['nullable', 'string', 'max:50'],
            'plan_code'       => ['nullable', 'string', 'max:20'],
            // Gift card fields
            'denomination'    => ['nullable', 'numeric', 'min:1', 'max:500'],
        ]);

        $service = Service::where('code', $request->input('service_code'))
            ->where('is_active', true)
            ->firstOrFail();

        $idempotencyKey = (string) $request->header('Idempotency-Key', \Illuminate\Support\Str::uuid());

        try {
            $order = $this->purchases->purchase(
                user: $request->user(),
                service: $service,
                request: $request->except(['service_code']),
                idempotencyKey: $idempotencyKey,
            );
        } catch (ServiceUnavailableException $e) {
            return ApiResponse::fail($e->getMessage(), null, 409);
        } catch (\App\Services\Ledger\InsufficientFundsException $e) {
            return ApiResponse::fail('Insufficient wallet balance. Please top up first.', null, 402);
        } catch (\RuntimeException $e) {
            return ApiResponse::fail($e->getMessage(), null, 422);
        }

        $order->loadMissing('service');
        return ApiResponse::ok(new ServiceOrderResource($order), 'Order placed successfully.');
    }

    // Keep old method as alias for backward compatibility
    public function purchaseVirtualNumber(Request $request)
    {
        return $this->purchase($request);
    }

    public function orders(Request $request)
    {
        $request->validate(['per_page' => ['nullable', 'integer', 'min:1', 'max:100']]);

        $page = ServiceOrder::with('service')
            ->where('user_id', $request->user()->id)
            ->orderByDesc('id')
            ->paginate((int) ($request->input('per_page') ?? 20));

        return ApiResponse::ok([
            'items' => ServiceOrderResource::collection($page->items()),
            'meta'  => [
                'current_page' => $page->currentPage(),
                'last_page'    => $page->lastPage(),
                'per_page'     => $page->perPage(),
                'total'        => $page->total(),
            ],
        ]);
    }

    public function order(Request $request, string $publicId)
    {
        $order = ServiceOrder::with('service')
            ->where('public_id', $publicId)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();
        return ApiResponse::ok(new ServiceOrderResource($order));
    }

    public function validateMeter(Request $request)
    {
        $request->validate([
            'meter_number' => ['required', 'string'],
            'disco'        => ['required', 'string'],
            'meter_type'   => ['nullable', 'in:prepaid,postpaid'],
        ]);

        try {
            $result = app(\App\Services\FlutterwaveBillsService::class)->validateMeter(
                meterNumber: $request->input('meter_number'),
                disco:       $request->input('disco'),
                meterType:   $request->input('meter_type', 'prepaid'),
            );
            return ApiResponse::ok([
                'customer_name'   => $result['name'] ?? $result['customer_name'] ?? null,
                'customer_number' => $result['address'] ?? $result['meter_number'] ?? $request->input('meter_number'),
                'meter_type'      => $request->input('meter_type', 'prepaid'),
            ]);
        } catch (\Throwable $e) {
            return ApiResponse::fail('Could not validate meter: ' . $e->getMessage(), null, 422);
        }
    }

    public function cancel(Request $request, string $publicId)
    {
        $order = ServiceOrder::where('public_id', $publicId)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        if ($order->status === 'refunded') {
            return ApiResponse::fail('Already refunded.', null, 422);
        }
        if (! in_array($order->status, ['completed', 'provisioning', 'pending'])) {
            return ApiResponse::fail('This order cannot be cancelled.', null, 422);
        }

        $holdTx = $order->transaction;
        if (! $holdTx) {
            return ApiResponse::fail('No transaction found for this order.', null, 422);
        }

        // Try to cancel with provider first (best-effort)
        try {
            if ($order->provider_order_id) {
                $provider = $order->service->provider ?? '';
                if ($provider === '5sim') {
                    app(\App\Services\Sms\FiveSimService::class)->cancel($order->provider_order_id);
                } elseif ($provider === 'smsactivate') {
                    app(\App\Services\Sms\SmsActivateService::class)->cancel($order->provider_order_id);
                }
            }
        } catch (\Throwable $e) {
            \Log::warning('cancel.provider_cancel_failed', ['order' => $publicId, 'error' => $e->getMessage()]);
        }

        // Refund the wallet — handle both PROCESSING (hold) and SUCCESS (settled) states
        $wallets = app(\App\Services\Wallet\WalletService::class);
        \Illuminate\Support\Facades\DB::transaction(function () use ($wallets, $holdTx, $order) {
            $freshTx   = $holdTx->fresh();
            $txStatus  = $freshTx->status;
            // Normalise to string whether it's an enum or a plain string
            $statusStr = $txStatus instanceof \BackedEnum ? $txStatus->value : (string) $txStatus;

            if ($statusStr === 'processing') {
                // Transaction still in suspense — use normal refund path
                $wallets->refundSuspense(
                    $freshTx,
                    'cancel_refund:' . $order->public_id,
                    'Number cancelled by user',
                );
            } else {
                // Transaction already settled — credit wallet directly
                $wallet = $freshTx->wallet;
                $amount = \App\Support\Money::minor($freshTx->amount_minor, $freshTx->currency);
                $wallets->fundFromPayment(
                    wallet: $wallet,
                    amount: $amount,
                    cashAccountCode: \App\Services\Ledger\ChartOfAccounts::SUSPENSE,
                    idempotencyKey: 'cancel_refund:' . $order->public_id,
                    description: 'Refund: number cancelled by user',
                );
            }

            $order->update([
                'status'         => 'refunded',
                'failure_reason' => 'Cancelled by user',
                'refunded_at'    => now(),
            ]);
        });

        \App\Support\Audit::log('service.cancelled', $order);

        return ApiResponse::ok(
            new \App\Http\Resources\ServiceOrderResource($order->fresh()->loadMissing('service')),
            'Order cancelled and wallet refunded.'
        );
    }

    public function fetchCode(Request $request, string $publicId)
    {
        $order = ServiceOrder::where('public_id', $publicId)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        if ($order->status !== 'completed') {
            return ApiResponse::fail('Order is not active.', null, 422);
        }

        if (! $order->provider_order_id) {
            return ApiResponse::fail('No provider order ID.', null, 422);
        }

        $code = null;
        try {
            $provider = $order->service->provider;
            if ($provider === '5sim') {
                $code = app(\App\Services\Sms\FiveSimService::class)->fetchCode($order->provider_order_id);
            } elseif ($provider === 'smsactivate') {
                $code = app(\App\Services\Sms\SmsActivateService::class)->fetchCode($order->provider_order_id);
            }
        } catch (\Throwable $e) {
            return ApiResponse::fail('Could not check for code: ' . $e->getMessage(), null, 500);
        }

        if ($code) {
            $delivery = array_merge((array) $order->delivery, ['sms_code' => $code]);
            $order->update(['delivery' => $delivery]);
            \App\Support\Audit::log('service.code_received', $order);
        }

        return ApiResponse::ok([
            'code'     => $code,
            'delivery' => $order->fresh()->delivery,
        ], $code ? 'Code received!' : 'No code yet.');
    }
}
