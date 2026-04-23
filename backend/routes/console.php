<?php

use Illuminate\Support\Facades\Schedule;

// Periodic cleanup of expired idempotency keys
Schedule::call(function () {
    \DB::table('idempotency_keys')
        ->where('expires_at', '<', now())
        ->delete();
})->dailyAt('02:00')->name('cleanup-idempotency-keys')->onOneServer();

// Trim audit logs older than 1 year (financial logs are kept forever — this only touches operational ones)
Schedule::call(function () {
    \DB::table('audit_logs')
        ->whereNotIn('action', ['wallet.funded', 'wallet.held_for_purchase', 'wallet.purchase_settled', 'wallet.refunded', 'payment.succeeded', 'payment.failed'])
        ->where('created_at', '<', now()->subYear())
        ->delete();
})->weeklyOn(0, '03:00')->name('trim-audit-logs')->onOneServer();
