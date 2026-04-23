<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;

class HealthController extends Controller
{
    public function __invoke()
    {
        $checks = [];
        $allOk = true;

        try {
            DB::connection()->select('select 1');
            $checks['database'] = 'ok';
        } catch (\Throwable $e) {
            $checks['database'] = 'fail: '.mb_substr($e->getMessage(), 0, 100);
            $allOk = false;
        }

        try {
            Redis::connection()->ping();
            $checks['redis'] = 'ok';
        } catch (\Throwable $e) {
            $checks['redis'] = 'fail: '.mb_substr($e->getMessage(), 0, 100);
            // Redis is optional in dev; mark as warning, not failure.
        }

        $checks['app']     = 'ok';
        $checks['version'] = (string) config('app.version', '1.0.0');
        $checks['env']     = (string) config('app.env');

        return ApiResponse::ok($checks, $allOk ? 'Healthy.' : 'Degraded.', $allOk ? 200 : 503);
    }
}
