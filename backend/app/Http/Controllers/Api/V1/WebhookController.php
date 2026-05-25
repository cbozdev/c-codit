<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\PaymentProvider;
use App\Http\Controllers\Controller;
use App\Models\ServiceOrder;
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

    /**
     * TextVerified sends a POST when an SMS code is received.
     * Payload: id, number, code, sms, status, targetName
     *
     * Webhook URL to configure: https://c-codit.com/api/webhooks/textverified
     */
    public function textverified(Request $request)
    {
        $secret = (string) config('services.textverified.webhook_secret');

        // Verify signature if a secret is configured
        if ($secret) {
            $sig = $request->header('X-TEXTVERIFIED-SIGNATURE')
                ?? $request->header('X-Signature')
                ?? '';
            $expected = hash_hmac('sha256', $request->getContent(), $secret);
            if (! hash_equals($expected, $sig)) {
                Log::channel('webhooks')->warning('textverified.invalid_signature');
                return response()->json(['status' => 'invalid_signature'], 200);
            }
        }

        $verificationId = $request->input('id');
        $code           = $request->input('code') ?? $request->input('smsCode');
        $fullSms        = $request->input('sms') ?? $request->input('smsText') ?? $request->input('message');
        $status         = $request->input('status', '');

        Log::channel('webhooks')->info('textverified.webhook', [
            'id'     => $verificationId,
            'status' => $status,
            'has_code' => ! empty($code),
        ]);

        if (! $verificationId) {
            return response()->json(['status' => 'missing_id'], 200);
        }

        // Extract code from full SMS text if not provided directly
        if (empty($code) && $fullSms) {
            preg_match('/\b(\d{4,8})\b/', (string) $fullSms, $m);
            $code = $m[1] ?? null;
        }

        if (! $code) {
            return response()->json(['status' => 'no_code'], 200);
        }

        try {
            $order = ServiceOrder::where('provider_order_id', (string) $verificationId)
                ->whereIn('status', ['completed', 'pending'])
                ->first();

            if ($order) {
                $delivery = array_merge((array) $order->delivery, [
                    'sms_code' => $code,
                    'sms_text' => $fullSms,
                ]);
                $order->update(['delivery' => $delivery]);
                Log::channel('webhooks')->info('textverified.code_saved', [
                    'order' => $order->public_id,
                    'code'  => $code,
                ]);
            } else {
                Log::channel('webhooks')->warning('textverified.order_not_found', [
                    'verification_id' => $verificationId,
                ]);
            }
        } catch (\Throwable $e) {
            Log::channel('webhooks')->error('textverified.webhook_error', ['error' => $e->getMessage()]);
        }

        return response()->json(['status' => 'ok'], 200);
    }

    /**
     * PVADeals sends events: sms_received, number_purchased, number_flagged, etc.
     * Payload: { event, requestId, number, message, timestamp }
     * Webhook URL to configure: https://api.c-codit.com/api/v1/webhooks/pvadeals
     */
    public function pvadeals(Request $request)
    {
        $event     = $request->input('event');
        $requestId = $request->input('requestId');
        $message   = $request->input('message', '');

        Log::channel('webhooks')->info('pvadeals.webhook', [
            'event'      => $event,
            'request_id' => $requestId,
            'has_message' => ! empty($message),
        ]);

        // LTR auto-renew: update provider_order_id to new request ID
        if ($event === 'number_renewed') {
            $oldId      = (string) ($request->input('oldRequestId') ?? '');
            $newId      = (string) ($requestId ?? '');
            $expiresAt  = $request->input('newExpiresAt');
            if ($oldId && $newId) {
                $order = ServiceOrder::where('provider_order_id', $oldId)->first();
                if ($order) {
                    $delivery = array_merge((array) $order->delivery, [
                        'expires_at'        => $expiresAt ?? ($order->delivery['expires_at'] ?? null),
                        'auto_renew_enable' => true,
                    ]);
                    $order->update(['provider_order_id' => $newId, 'delivery' => $delivery]);
                    Log::channel('webhooks')->info('pvadeals.number_renewed', ['old' => $oldId, 'new' => $newId]);
                }
            }
            return response()->json(['status' => 'ok'], 200);
        }

        if ($event !== 'sms_received' || ! $requestId) {
            return response()->json(['status' => 'ok'], 200);
        }

        // Extract numeric code from full SMS message
        $code = null;
        if ($message) {
            preg_match('/\b(\d{4,8})\b/', (string) $message, $m);
            $code = $m[1] ?? null;
        }

        if (! $code) {
            return response()->json(['status' => 'no_code'], 200);
        }

        try {
            $order = ServiceOrder::where('provider_order_id', (string) $requestId)
                ->whereIn('status', ['completed', 'pending'])
                ->first();

            if ($order) {
                $delivery = array_merge((array) $order->delivery, [
                    'sms_code' => $code,
                    'sms_text' => $message,
                ]);
                $order->update(['delivery' => $delivery]);
                Log::channel('webhooks')->info('pvadeals.code_saved', [
                    'order' => $order->public_id,
                    'code'  => $code,
                ]);
            } else {
                Log::channel('webhooks')->warning('pvadeals.order_not_found', [
                    'request_id' => $requestId,
                ]);
            }
        } catch (\Throwable $e) {
            Log::channel('webhooks')->error('pvadeals.webhook_error', ['error' => $e->getMessage()]);
        }

        return response()->json(['status' => 'ok'], 200);
    }

    /**
     * SMSPool sends a POST when an SMS code arrives for a rented number.
     * Payload: order_id, sms, full_sms, number
     */
    public function smspool(Request $request)
    {
        $orderId = $request->input('order_id');
        $code    = $request->input('sms');
        $fullSms = $request->input('full_sms');

        Log::channel('webhooks')->info('smspool.webhook', [
            'order_id' => $orderId,
            'has_code' => ! empty($code),
        ]);

        if (! $orderId) {
            return response()->json(['status' => 'missing order_id'], 200);
        }

        // Extract code from full_sms if the sms field is empty
        if (empty($code) && $fullSms) {
            preg_match('/\b(\d{4,8})\b/', (string) $fullSms, $m);
            $code = $m[1] ?? null;
        }

        if (! $code) {
            return response()->json(['status' => 'no_code'], 200);
        }

        try {
            $order = ServiceOrder::where('provider_order_id', (string) $orderId)
                ->where('status', 'completed')
                ->first();

            if ($order) {
                $delivery = array_merge((array) $order->delivery, ['sms_code' => $code]);
                $order->update(['delivery' => $delivery]);
                Log::channel('webhooks')->info('smspool.code_saved', ['order' => $order->public_id, 'code' => $code]);
            } else {
                Log::channel('webhooks')->warning('smspool.order_not_found', ['order_id' => $orderId]);
            }
        } catch (\Throwable $e) {
            Log::channel('webhooks')->error('smspool.webhook_error', ['error' => $e->getMessage()]);
        }

        return response()->json(['status' => 'ok'], 200);
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
