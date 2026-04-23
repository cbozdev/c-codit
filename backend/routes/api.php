<?php

use App\Http\Controllers\Api\V1\AdminController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\ServiceController;
use App\Http\Controllers\Api\V1\WalletController;
use App\Http\Controllers\Api\V1\WebhookController;
use Illuminate\Support\Facades\Route;

Route::get('/health', HealthController::class);

Route::prefix('v1')->group(function () {

    // Public auth
    Route::middleware('throttle:auth')->group(function () {
        Route::post('/auth/register',         [AuthController::class, 'register']);
        Route::post('/auth/login',            [AuthController::class, 'login']);
        Route::post('/auth/forgot-password',  [AuthController::class, 'forgotPassword']);
        Route::post('/auth/reset-password',   [AuthController::class, 'resetPassword']);
        Route::get('/auth/verify-email/{id}/{hash}', [AuthController::class, 'verifyEmail'])
            ->name('verification.verify');
    });

    // Webhooks (no auth, but rate-limited and signature-verified internally)
    Route::middleware('throttle:webhooks')->group(function () {
        Route::post('/webhooks/flutterwave', [WebhookController::class, 'flutterwave']);
        Route::post('/webhooks/nowpayments', [WebhookController::class, 'nowpayments']);
    });

    // Authenticated routes
    Route::middleware(['auth:sanctum', 'active'])->group(function () {

        Route::post('/auth/logout',     [AuthController::class, 'logout']);
        Route::post('/auth/logout-all', [AuthController::class, 'logoutAll']);
        Route::get('/auth/me',          [AuthController::class, 'me']);
        Route::post('/auth/email/send-verification', [AuthController::class, 'sendVerificationEmail'])
            ->middleware('throttle:6,1');

        // Wallet
        Route::middleware('throttle:api')->group(function () {
            Route::get('/wallet',                 [WalletController::class, 'show']);
            Route::get('/wallet/transactions',    [WalletController::class, 'transactions']);
            Route::get('/wallet/transactions/{id}', [WalletController::class, 'transaction']);
        });

        // Funding (idempotency required, payments rate limit)
        Route::middleware(['throttle:payments', 'idempotent'])->group(function () {
            Route::post('/wallet/fund', [WalletController::class, 'fund']);
        });

        // Services
        Route::middleware('throttle:api')->group(function () {
            Route::get('/services',           [ServiceController::class, 'index']);
            Route::get('/services/{code}',    [ServiceController::class, 'show']);
            Route::get('/orders',             [ServiceController::class, 'orders']);
            Route::get('/orders/{id}',        [ServiceController::class, 'order']);
        });

        // Service purchases (idempotency required)
        Route::middleware(['throttle:services', 'idempotent'])->group(function () {
            Route::post('/services/virtual-number/purchase', [ServiceController::class, 'purchaseVirtualNumber']);
        });

        // Admin
        Route::middleware('role:admin')->prefix('admin')->group(function () {
            Route::get('/users',                       [AdminController::class, 'users']);
            Route::post('/users/{publicId}/suspend',   [AdminController::class, 'suspendUser']);
            Route::post('/users/{publicId}/unsuspend', [AdminController::class, 'unsuspendUser']);
            Route::get('/transactions',                [AdminController::class, 'transactions']);
            Route::get('/metrics',                     [AdminController::class, 'metrics']);
            Route::post('/services/{code}/toggle',     [AdminController::class, 'toggleService']);
        });
    });
});
