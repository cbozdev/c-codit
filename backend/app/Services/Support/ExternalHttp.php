<?php

namespace App\Services\Support;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Centralised HTTP client factory with sane defaults:
 *   - 10s connect timeout, 25s total
 *   - Up to 3 retries for transient failures (429/5xx)
 *   - Structured logging of failures
 */
class ExternalHttp
{
    public static function for(string $provider, ?string $baseUrl = null): PendingRequest
    {
        return Http::baseUrl((string) $baseUrl)
            ->connectTimeout(10)
            ->timeout(25)
            ->retry(3, 500, function (\Throwable $e, PendingRequest $request) {
                if ($e instanceof \Illuminate\Http\Client\ConnectionException) return true;
                if ($e instanceof \Illuminate\Http\Client\RequestException) {
                    $status = $e->response?->status();
                    return $status === 429 || ($status !== null && $status >= 500);
                }
                return false;
            }, throw: false)
            ->withMiddleware(function (callable $handler) use ($provider) {
                return function ($request, array $options) use ($handler, $provider) {
                    return $handler($request, $options)->then(
                        function ($response) use ($provider, $request) {
                            if ($response->getStatusCode() >= 400) {
                                Log::channel('payments')->warning('external_http.error', [
                                    'provider' => $provider,
                                    'method'   => $request->getMethod(),
                                    'uri'      => (string) $request->getUri(),
                                    'status'   => $response->getStatusCode(),
                                ]);
                            }
                            return $response;
                        }
                    );
                };
            })
            ->acceptJson()
            ->asJson();
    }

    public static function ensureSuccessful(Response $res, string $context): array
    {
        if (! $res->successful()) {
            Log::channel('payments')->error('external_http.failed', [
                'context' => $context,
                'status'  => $res->status(),
                'body'    => mb_substr((string) $res->body(), 0, 2000),
            ]);
            throw new RuntimeException("{$context}: provider returned HTTP {$res->status()}.");
        }
        return (array) $res->json();
    }
}
