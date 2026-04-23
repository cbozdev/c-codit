<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user) {
            if ($user->is_suspended) {
                return response()->json([
                    'success' => false,
                    'message' => 'Your account has been suspended.',
                    'data'    => ['reason' => $user->suspension_reason],
                ], 403);
            }
            if (! $user->is_active) {
                return response()->json([
                    'success' => false,
                    'message' => 'Your account is inactive.',
                    'data'    => null,
                ], 403);
            }
        }
        return $next($request);
    }
}
