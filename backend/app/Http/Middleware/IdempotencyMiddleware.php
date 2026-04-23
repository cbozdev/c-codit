<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Processes the "Idempotency-Key" header on mutating endpoints.
 *
 * - First request with a given key: executes, stores the response, returns it.
 * - Repeat request (same key + same body): returns the stored response verbatim.
 * - Concurrent retries while the first is still in flight: returns 409 Conflict.
 * - Repeat request with a different body: returns 422 (key reused for different request).
 *
 * Keys are scoped per-user (or per-IP for anonymous routes).
 */
class IdempotencyMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $key = trim((string) $request->header('Idempotency-Key'));
        if ($key === '') {
            return response()->json([
                'success' => false,
                'message' => 'Idempotency-Key header is required for this endpoint.',
                'data'    => null,
            ], 400);
        }
        if (strlen($key) > 128) {
            return response()->json([
                'success' => false,
                'message' => 'Idempotency-Key must be 128 characters or fewer.',
                'data'    => null,
            ], 400);
        }

        $userId = optional($request->user())->id;
        $scopedKey = ($userId ? "u:{$userId}:" : "ip:{$request->ip()}:").$key;
        $requestHash = hash('sha256', $request->getContent() ?: '{}');

        // Atomically claim the key or detect a replay.
        $row = DB::transaction(function () use ($scopedKey, $request, $userId, $requestHash) {
            $existing = DB::table('idempotency_keys')
                ->where('key', $scopedKey)
                ->lockForUpdate()
                ->first();

            if ($existing) return $existing;

            DB::table('idempotency_keys')->insert([
                'key'          => $scopedKey,
                'user_id'      => $userId,
                'method'       => $request->method(),
                'path'         => $request->path(),
                'request_hash' => $requestHash,
                'locked_at'    => now(),
                'expires_at'   => now()->addHours(24),
                'created_at'   => now(),
                'updated_at'   => now(),
            ]);

            return null;
        });

        if ($row) {
            if ($row->request_hash !== $requestHash) {
                return response()->json([
                    'success' => false,
                    'message' => 'Idempotency-Key was reused with a different request body.',
                    'data'    => null,
                ], 422);
            }

            if ($row->completed_at && $row->response_body !== null) {
                return response($row->response_body, $row->response_status ?? 200)
                    ->header('Content-Type', 'application/json')
                    ->header('Idempotent-Replayed', 'true');
            }

            // Still in flight.
            return response()->json([
                'success' => false,
                'message' => 'A request with this Idempotency-Key is still being processed.',
                'data'    => null,
            ], 409);
        }

        try {
            /** @var Response $response */
            $response = $next($request);
        } catch (\Throwable $e) {
            // On failure, release the claim so the user can retry safely.
            DB::table('idempotency_keys')->where('key', $scopedKey)->delete();
            throw $e;
        }

        // Only persist successful / client-error responses (not 5xx).
        if ($response->getStatusCode() < 500) {
            DB::table('idempotency_keys')->where('key', $scopedKey)->update([
                'response_status' => $response->getStatusCode(),
                'response_body'   => $response->getContent(),
                'completed_at'    => now(),
                'updated_at'      => now(),
            ]);
        } else {
            DB::table('idempotency_keys')->where('key', $scopedKey)->delete();
        }

        return $response;
    }
}
