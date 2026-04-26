<?php

namespace App\Providers;

use App\Services\Ledger\ChartOfAccounts;
use App\Services\Ledger\LedgerService;
use App\Services\Payment\FlutterwaveService;
use App\Services\Payment\NowPaymentsService;
use App\Services\Payment\PaymentOrchestrator;
use App\Services\ServicePurchaseService;
use App\Services\Sms\FiveSimService;
use App\Services\Sms\SmsActivateService;
use App\Services\Wallet\WalletService;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        foreach ([
            LedgerService::class, ChartOfAccounts::class, WalletService::class,
            FlutterwaveService::class, NowPaymentsService::class, PaymentOrchestrator::class,
            FiveSimService::class, SmsActivateService::class,
            \App\Services\FlutterwaveBillsService::class,
            \App\Services\GiftCardService::class,
            \App\Services\Esim\AiraloService::class,
            ServicePurchaseService::class,
        ] as $class) {
            $this->app->singleton($class);
        }
    }

    public function boot(): void
    {
        if ($url = env('DATABASE_URL')) {
            $parts = parse_url($url);
            if ($parts) {
                config([
                    'database.connections.pgsql.host'     => $parts['host']     ?? '127.0.0.1',
                    'database.connections.pgsql.port'     => $parts['port']     ?? 5432,
                    'database.connections.pgsql.database' => ltrim($parts['path'] ?? '', '/'),
                    'database.connections.pgsql.username' => $parts['user']     ?? 'postgres',
                    'database.connections.pgsql.password' => isset($parts['pass']) ? urldecode($parts['pass']) : '',
                ]);
            }
        }

        if ($url = env('REDIS_URL')) {
            $parts = parse_url($url);
            if ($parts) {
                foreach (['default', 'cache'] as $conn) {
                    config([
                        "database.redis.{$conn}.host"     => $parts['host'] ?? '127.0.0.1',
                        "database.redis.{$conn}.port"     => $parts['port'] ?? 6379,
                        "database.redis.{$conn}.password" => isset($parts['pass']) ? urldecode($parts['pass']) : null,
                    ]);
                }
            }
        }

        Schema::defaultStringLength(191);

        // Register Resend HTTP transport (bypasses SMTP limitations)
        Mail::extend('resend', function () {
            return new \App\Mail\ResendTransport(
                (string) config('services.resend.api_key', env('MAIL_PASSWORD'))
            );
        });

        $this->configureRateLimiting();
    }

    private function configureRateLimiting(): void
    {
        RateLimiter::for('api',
            fn (Request $r) => Limit::perMinute(120)->by($r->user()?->id ?: $r->ip()));
        RateLimiter::for('auth',
            fn (Request $r) => Limit::perMinute(10)->by($r->ip()));
        RateLimiter::for('payments',
            fn (Request $r) => Limit::perMinute(20)->by($r->user()?->id ?: $r->ip()));
        RateLimiter::for('services',
            fn (Request $r) => Limit::perMinute(30)->by($r->user()?->id ?: $r->ip()));
        RateLimiter::for('webhooks',
            fn (Request $r) => Limit::perMinute(600)->by($r->ip()));
    }
}
