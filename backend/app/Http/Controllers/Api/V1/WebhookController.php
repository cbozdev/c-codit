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

        $verifHash = $headers['verif-hash'][0]
            ?? $headers['verif_hash'][0]
            ?? $headers['x-verif-hash'][0]
            ?? 'NOT_FOUND';

        $configuredSecret = (string) config('services.flutterwave.webhook_secret');

        Log::channel('webhooks')->info('webhook.received', [
            'provider'          => $provider->value,
            'verif_hash'        => $verifHash,
            'secret_configured' => !empty($configuredSecret),
            'hashes_match'      => $verifHash === $configuredSecret,
            'body_length'       => strlen((string) $raw),
        ]);

        // Always return 200 — never let Flutterwave see a 5xx
        // Process in a try/catch and log any errors
        try {
            $this->orchestrator->handleWebhook($provider, (string) $raw, $headers);
            Log::channel('webhooks')->info('webhook.processed', ['provider' => $provider->value]);
        } catch (\Throwable $e) {
            Log::channel('webhooks')->error('webhook.failed', [
                'provider' => $provider->value,
                'error'    => $e->getMessage(),
                'trace'    => substr($e->getTraceAsString(), 0, 500),
            ]);
        }

        // Always 200 so Flutterwave doesn't retry infinitely
        return response()->json(['status' => 'received'], 200);
    }
}
