<?php

use App\Http\Controllers\Api\V1\AdminController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\ProxyAdminController;
use App\Http\Controllers\Api\V1\ProxyController;
use App\Http\Controllers\Api\V1\ServiceController;
use App\Http\Controllers\Api\V1\SocialAuthController;
use App\Http\Controllers\Api\V1\TwoFactorController;
use App\Http\Controllers\Api\V1\WalletController;
use App\Http\Controllers\Api\V1\WebhookController;
use Illuminate\Support\Facades\Route;

Route::get('/health', HealthController::class);
Route::get('/v1/settings', [AdminController::class, 'getSettings']); // public app settings

Route::prefix('v1')->group(function () {

    // Public auth
    Route::middleware('throttle:auth')->group(function () {
        Route::post('/auth/register',         [AuthController::class, 'register']);
        Route::post('/auth/login',            [AuthController::class, 'login']);
        Route::post('/auth/2fa/verify',       [AuthController::class, 'verifyTwoFactor']);
        Route::post('/auth/forgot-password',  [AuthController::class, 'forgotPassword']);
        Route::post('/auth/reset-password',   [AuthController::class, 'resetPassword']);
        Route::get('/auth/verify-email/{id}/{hash}', [AuthController::class, 'verifyEmail'])
            ->name('verification.verify');

        // Social auth
        Route::post('/auth/google', [SocialAuthController::class, 'google']);
        Route::post('/auth/apple',  [SocialAuthController::class, 'apple']);
    });

    // Webhooks
    Route::middleware('throttle:webhooks')->group(function () {
        Route::post('/webhooks/flutterwave', [WebhookController::class, 'flutterwave']);
        Route::post('/webhooks/nowpayments', [WebhookController::class, 'nowpayments']);
        Route::post('/webhooks/smspool',      [WebhookController::class, 'smspool']);
        Route::post('/webhooks/textverified', [WebhookController::class, 'textverified']);
        Route::post('/webhooks/pvadeals',     [WebhookController::class, 'pvadeals']);
    });

    // Authenticated routes
    Route::middleware(['auth:sanctum', 'active'])->group(function () {

        Route::post('/auth/logout',           [AuthController::class, 'logout']);
        Route::post('/auth/logout-all',       [AuthController::class, 'logoutAll']);
        Route::get('/auth/me',                [AuthController::class, 'me']);
        Route::patch('/auth/profile',         [AuthController::class, 'updateProfile']);
        Route::post('/auth/change-password',  [AuthController::class, 'changePassword']);
        Route::delete('/auth/account',        [AuthController::class, 'deleteAccount']);
        Route::get('/auth/referral',          [AuthController::class, 'referralInfo']);
        Route::post('/auth/email/send-verification', [AuthController::class, 'sendVerificationEmail'])
            ->middleware('throttle:6,1');

        // 2FA
        Route::get('/profile/2fa/setup',     [TwoFactorController::class, 'setup']);
        Route::post('/profile/2fa/confirm',  [TwoFactorController::class, 'confirm']);
        Route::delete('/profile/2fa',        [TwoFactorController::class, 'disable']);

        // Notifications
        Route::get('/notifications',          [NotificationController::class, 'index']);
        Route::post('/notifications/read-all',[NotificationController::class, 'markAllRead']);
        Route::post('/notifications/{id}/read',[NotificationController::class, 'markRead']);

        // Wallet
        Route::middleware('throttle:api')->group(function () {
            Route::get('/wallet',                   [WalletController::class, 'show']);
            Route::get('/wallet/transactions',      [WalletController::class, 'transactions']);
            Route::get('/wallet/transactions/{id}', [WalletController::class, 'transaction']);
            Route::get('/wallet/crypto-minimums',   [WalletController::class, 'cryptoMinimums']);
        });

        // Funding
        Route::middleware(['throttle:payments', 'idempotent'])->group(function () {
            Route::post('/wallet/fund', [WalletController::class, 'fund']);
        });

        // Services
        Route::middleware('throttle:api')->group(function () {
            Route::get('/services',                       [ServiceController::class, 'index']);
            Route::get('/services/esim-packages',         [ServiceController::class, 'esimPackages']);
            Route::get('/services/giftcard-products',     [ServiceController::class, 'giftCardProducts']);
            Route::get('/services/giftcard-products/{id}',[ServiceController::class, 'giftCardProduct']);
            Route::get('/services/virtual-number-prices', [ServiceController::class, 'virtualNumberPrices']);
            Route::get('/services/pvadeals-catalog',      [ServiceController::class, 'pvaDealsCatalog']);
            Route::get('/services/data-plans',            [ServiceController::class, 'dataPlans']);
            Route::get('/services/tv-plans',              [ServiceController::class, 'tvPlans']);
            Route::get('/services/smm-catalog',           [ServiceController::class, 'smmCatalog']);
            Route::post('/services/validate-meter',       [ServiceController::class, 'validateMeter']);
            Route::post('/services/validate-smartcard',   [ServiceController::class, 'validateSmartcard']);
            Route::get('/services/{code}',                [ServiceController::class, 'show']);
            Route::get('/orders',                         [ServiceController::class, 'orders']);
            Route::get('/orders/{id}',                    [ServiceController::class, 'order']);
        });

        // Order actions — cancel & fetch SMS code
        Route::post('/orders/{id}/cancel',      [ServiceController::class, 'cancel']);
        Route::post('/orders/{id}/fetch-code',  [ServiceController::class, 'fetchCode']);
        Route::post('/orders/{id}/smm-status',  [ServiceController::class, 'smmOrderStatus']);

        // Service purchases
        Route::middleware(['throttle:services', 'idempotent'])->group(function () {
            Route::post('/services/purchase', [ServiceController::class, 'purchase']);
            Route::post('/services/virtual-number/purchase', [ServiceController::class, 'purchaseVirtualNumber']);
            Route::post('/services/virtual-number/purchase-ltr', [ServiceController::class, 'purchaseLtrVirtualNumber']);
        });

        // PVADeals order actions
        Route::post('/orders/{id}/reuse',              [ServiceController::class, 'reuseNumber']);
        Route::post('/orders/{id}/toggle-auto-renew',  [ServiceController::class, 'togglePvaAutoRenew']);

        // Proxy
        Route::middleware('throttle:api')->prefix('proxy')->group(function () {
            Route::get('/plans',                         [ProxyController::class, 'plans']);
            Route::get('/locations',                     [ProxyController::class, 'locations']);
            Route::get('/price-estimate',                [ProxyController::class, 'priceEstimate']);
            Route::get('/trial-status',                  [ProxyController::class, 'trialStatus']);
            Route::get('/my',                            [ProxyController::class, 'index']);
            Route::get('/my/history',                    [ProxyController::class, 'history']);
            Route::get('/my/{id}',                       [ProxyController::class, 'show']);
            Route::get('/my/{id}/usage',                 [ProxyController::class, 'usage']);
            Route::get('/my/{id}/examples',              [ProxyController::class, 'connectionExamples']);
            Route::post('/my/{id}/test',                 [ProxyController::class, 'testProxy']);
            // Marketplace
            Route::get('/marketplace',                   [ProxyController::class, 'marketplace']);
            Route::get('/marketplace/countries',         [ProxyController::class, 'marketplaceCountries']);
            // IP Whitelist
            Route::get('/whitelist',                     [ProxyController::class, 'getWhitelist']);
        });

        Route::middleware(['throttle:services'])->prefix('proxy')->group(function () {
            Route::post('/claim-trial',                  [ProxyController::class, 'claimTrial']);
            Route::post('/my/{id}/rotate',               [ProxyController::class, 'rotate']);
            Route::post('/my/{id}/renew',                [ProxyController::class, 'renew']);
            Route::post('/my/{id}/cancel',               [ProxyController::class, 'cancel']);
            Route::post('/my/{id}/toggle-renew',         [ProxyController::class, 'toggleAutoRenew']);
            Route::post('/my/{id}/refund',               [ProxyController::class, 'refundSubscription']);
            Route::post('/marketplace/{id}/buy',         [ProxyController::class, 'purchaseListing']);
            Route::post('/social-buy',                   [ProxyController::class, 'socialBuy']);
            Route::put('/whitelist',                     [ProxyController::class, 'updateWhitelist']);
        });

        Route::middleware('throttle:api')->prefix('proxy-keys')->group(function () {
            Route::get('/',            [ProxyController::class, 'listApiKeys']);
            Route::post('/',           [ProxyController::class, 'createApiKey']);
            Route::post('/{id}/rotate',[ProxyController::class, 'rotateApiKey']);
            Route::delete('/{id}',     [ProxyController::class, 'revokeApiKey']);
        });

        // Admin
        Route::middleware('role:admin')->prefix('admin')->group(function () {
            // Metrics & Profit & Analytics
            Route::get('/metrics',       [AdminController::class, 'metrics']);
            Route::get('/profit',        [AdminController::class, 'profit']);
            Route::get('/revenue-stats', [AdminController::class, 'revenueStats']);
            Route::get('/top-spenders',  [AdminController::class, 'topSpenders']);

            // Users
            Route::get('/users',                                [AdminController::class, 'users']);
            Route::post('/users/{publicId}/suspend',            [AdminController::class, 'suspendUser']);
            Route::post('/users/{publicId}/unsuspend',          [AdminController::class, 'unsuspendUser']);
            Route::post('/users/{publicId}/toggle-role',        [AdminController::class, 'toggleUserRole']);
            Route::post('/users/{publicId}/adjust-wallet',      [AdminController::class, 'adjustWallet']);
            Route::get('/users/{publicId}/transactions',        [AdminController::class, 'userTransactions']);
            Route::post('/users/{publicId}/message',            [AdminController::class, 'messageUser']);

            // Broadcast
            Route::post('/broadcast',                           [AdminController::class, 'broadcastMessage']);

            // Transactions
            Route::get('/transactions', [AdminController::class, 'transactions']);
            Route::post('/transactions/{id}/refund', [AdminController::class, 'refundTransaction']);

            // Services
            Route::get('/services',                             [AdminController::class, 'services']);
            Route::post('/services/{code}/toggle',              [AdminController::class, 'toggleService']);
            Route::post('/services/{code}/markup',              [AdminController::class, 'updateServiceMarkup']);

            // App settings
            Route::get('/settings',                             [AdminController::class, 'getSettings']);
            Route::post('/settings',                            [AdminController::class, 'updateSettings']);

            // API key management
            Route::get('/api-keys',                             [AdminController::class, 'getApiKeys']);
            Route::post('/api-keys',                            [AdminController::class, 'updateApiKey']);
            Route::delete('/api-keys',                          [AdminController::class, 'deleteApiKey']);

            // Audit logs
            Route::get('/audit-logs',                           [AdminController::class, 'auditLogs']);

            // Service health
            Route::get('/health',                               [AdminController::class, 'serviceHealth']);

            // Referral stats
            Route::get('/referrals',                            [AdminController::class, 'referralStats']);

            // Proxy admin
            Route::get('/proxy/overview',                       [ProxyAdminController::class, 'overview']);
            Route::get('/proxy/subscriptions',                  [ProxyAdminController::class, 'subscriptions']);
            Route::get('/proxy/analytics',                      [ProxyAdminController::class, 'analytics']);
            Route::get('/proxy/provider-settings',              [ProxyAdminController::class, 'providerSettings']);
            Route::post('/proxy/provider-settings',             [ProxyAdminController::class, 'updateProviderSettings']);
            Route::post('/proxy/subscriptions/{id}/reprovision',[ProxyAdminController::class, 'forceReprovision']);
            Route::post('/proxy/subscriptions/{id}/reset-creds',[ProxyAdminController::class, 'resetCredentials']);
            Route::post('/proxy/subscriptions/{id}/sync-usage', [ProxyAdminController::class, 'syncUsage']);
            Route::post('/proxy/subscriptions/{id}/cancel',     [ProxyAdminController::class, 'cancelSubscription']);
        });
    });
});
