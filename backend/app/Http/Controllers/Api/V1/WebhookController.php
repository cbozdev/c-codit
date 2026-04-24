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

        // Build headers — try multiple formats Flutterwave may use
        $headers = collect($request->headers->all())
            ->mapWithKeys(fn ($v, $k) => [strtolower((string) $k) => $v])
            ->all();

        // Log incoming webhook details for debugging
        Log::channel('webhooks')->info('webhook.received', [
            'provider'       => $provider->value,
            'header_keys'    => array_keys($headers),
            'verif_hash'     => $headers['verif-hash'][0] ?? $headers['verif_hash'][0] ?? 'NOT_FOUND',
            'body_length'    => strlen((string) $raw),
            'configured_secret_length' => strlen((string) config('services.flutterwave.webhook_secret')),
        ]);

        try {
            $this->orchestrator->handleWebhook($provider, (string) $raw, $headers);
        } catch (\Throwable $e) {
            Log::channel('webhooks')->error('webhook.handler_failed', [
                'provider' => $provider->value,
                'error'    => $e->getMessage(),
            ]);

            if (str_contains($e->getMessage(), 'signature') || str_contains($e->getMessage(), 'Invalid webhook')) {
                // Still return 200 to Flutterwave so they don't keep retrying with a bad sig
                // But log it clearly
                Log::channel('webhooks')->error('webhook.signature_failed', [
                    'provider' => $provider->value,
                ]);
                return ApiResponse::ok(null, 'Received.');
            }
            return ApiResponse::fail('Webhook processing failed.', null, 500);
        }

        return ApiResponse::ok(null, 'Webhook processed.');
    }
}
