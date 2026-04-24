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
}
