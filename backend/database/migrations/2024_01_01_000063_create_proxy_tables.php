<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('proxy_subscriptions', function (Blueprint $t) {
            $t->id();
            $t->uuid('public_id')->unique();
            $t->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $t->foreignId('service_order_id')->nullable()->constrained('service_orders')->nullOnDelete();

            // Provider
            $t->string('provider', 20);                    // decodo|brightdata
            $t->string('provider_subscription_id')->nullable()->index();

            // Proxy details
            $t->string('proxy_type', 40);                  // residential_rotating|residential_sticky|residential_static|datacenter_shared|datacenter_dedicated|isp_static|isp_rotating|mobile_rotating
            $t->string('protocol', 10)->default('http');   // http|https|socks5
            $t->string('host')->nullable();
            $t->unsignedInteger('port')->nullable();
            $t->string('username')->nullable();
            $t->text('password_encrypted')->nullable();    // AES-256 encrypted

            // Location
            $t->string('location_country', 5)->nullable(); // ISO code
            $t->string('location_city')->nullable();

            // Bandwidth & limits
            $t->decimal('bandwidth_gb_total', 10, 3)->default(0);
            $t->decimal('bandwidth_gb_used', 10, 3)->default(0);
            $t->unsignedInteger('ip_count')->default(1);
            $t->unsignedInteger('threads')->default(1);

            // Lifecycle
            $t->string('status', 20)->default('active');   // active|expired|cancelled|suspended|provisioning|failed
            $t->boolean('auto_renew')->default(false);
            $t->boolean('is_trial')->default(false);
            $t->unsignedInteger('duration_days')->default(30);
            $t->timestamp('expires_at')->nullable()->index();
            $t->timestamp('last_synced_at')->nullable();
            $t->timestamp('provisioned_at')->nullable();

            $t->json('config')->nullable();                // provider-specific metadata
            $t->timestamps();
            $t->softDeletes();

            $t->index(['user_id', 'status']);
            $t->index(['status', 'expires_at']);
        });

        Schema::create('proxy_usage_logs', function (Blueprint $t) {
            $t->id();
            $t->foreignId('subscription_id')->constrained('proxy_subscriptions')->cascadeOnDelete();
            $t->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $t->string('event_type', 30);                  // bandwidth_sync|renewal|credential_refresh|test|rotate|cancel
            $t->decimal('bandwidth_mb', 12, 3)->default(0);
            $t->json('data')->nullable();
            $t->timestamp('created_at')->useCurrent();

            $t->index(['subscription_id', 'event_type']);
            $t->index(['user_id', 'created_at']);
        });

        Schema::create('proxy_trials', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();
            $t->foreignId('subscription_id')->nullable()->constrained('proxy_subscriptions')->nullOnDelete();
            $t->timestamp('claimed_at')->useCurrent();
            $t->timestamp('expires_at')->nullable();
        });

        Schema::create('proxy_api_keys', function (Blueprint $t) {
            $t->id();
            $t->uuid('public_id')->unique();
            $t->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $t->string('name', 80);
            $t->string('key_hash', 64)->unique();          // sha256 of raw key
            $t->string('key_prefix', 10);                  // first 8 chars for display
            $t->json('scopes')->nullable();                 // ['buy','renew','check','credentials']
            $t->json('ip_whitelist')->nullable();
            $t->unsignedBigInteger('request_count')->default(0);
            $t->boolean('is_active')->default(true);
            $t->timestamp('last_used_at')->nullable();
            $t->timestamps();

            $t->index(['user_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('proxy_api_keys');
        Schema::dropIfExists('proxy_trials');
        Schema::dropIfExists('proxy_usage_logs');
        Schema::dropIfExists('proxy_subscriptions');
    }
};
