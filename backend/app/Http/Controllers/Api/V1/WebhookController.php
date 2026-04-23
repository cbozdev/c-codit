<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\PaymentProvider;
use App\Http\Controllers\Controller;
use App\Services\Payment\PaymentOrchestrator;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class WebhookController extends Controller
{
    public function __construct(private readonly PaymentOrchestrator $orchestrator) {}

    public function flutterwave(Request $request)
    {
        return $this->handle($request, PaymentProvider::FLUTTERWAVE);
    }

    public function nowpayments(Request $request)
    {
        return $this->handle($request, PaymentProvider::NOWPAYMENTS);
    }

    private function handle(Request $request, PaymentProvider $provider)
    {
        $raw = $request->getContent();
        $headers = collect($request->headers->all())
            ->mapWithKeys(fn ($v, $k) => [strtolower((string) $k) => $v])
            ->all();

        try {
            $this->orchestrator->handleWebhook($provider, (string) $raw, $headers);
        } catch (\Throwable $e) {
            Log::channel('webhooks')->error('webhook.handler_failed', [
                'provider' => $provider->value,
                'error'    => $e->getMessage(),
            ]);
            // Return 200 to providers we can't recover for to avoid retry storms when WE failed.
            // Return 4xx only for invalid signatures (a security signal).
            if (str_contains($e->getMessage(), 'signature')) {
                return ApiResponse::fail('Invalid signature.', null, 400);
            }
            return ApiResponse::fail('Webhook processing failed.', null, 500);
        }

        return ApiResponse::ok(null, 'Webhook processed.');
    }
}
