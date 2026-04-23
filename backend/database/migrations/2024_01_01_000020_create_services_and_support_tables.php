<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('services', function (Blueprint $t) {
            $t->id();
            $t->string('code', 64)->unique();           // e.g. 'virtual_number', 'esim', 'giftcard', 'utility_bill'
            $t->string('name');
            $t->string('provider', 40);                  // '5sim', 'smsactivate', 'flutterwave_bills', internal
            $t->string('category', 40);
            $t->text('description')->nullable();
            $t->boolean('is_active')->default(true);
            $t->json('config')->nullable();              // provider-specific config
            $t->bigInteger('base_price_minor')->nullable(); // optional default
            $t->string('currency', 3)->default('USD');
            $t->decimal('markup_percent', 6, 2)->nullable();
            $t->timestamps();
        });

        Schema::create('service_orders', function (Blueprint $t) {
            $t->id();
            $t->uuid('public_id')->unique();
            $t->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $t->foreignId('service_id')->constrained('services')->restrictOnDelete();
            $t->foreignId('transaction_id')->nullable()->constrained('transactions')->nullOnDelete();
            $t->string('status', 20)->default('pending'); // pending|provisioning|completed|failed|refunded
            $t->bigInteger('amount_minor');
            $t->string('currency', 3);
            $t->string('provider_order_id')->nullable()->index();
            $t->json('request')->nullable();             // user input
            $t->json('provider_response')->nullable();   // provider output
            $t->json('delivery')->nullable();            // the thing they bought (number, code, etc.)
            $t->string('idempotency_key', 128)->unique();
            $t->string('failure_reason')->nullable();
            $t->timestamp('provisioned_at')->nullable();
            $t->timestamp('refunded_at')->nullable();
            $t->timestamps();
            $t->softDeletes();

            $t->index(['user_id', 'status']);
        });

        Schema::create('feature_flags', function (Blueprint $t) {
            $t->id();
            $t->string('key', 100)->unique();
            $t->boolean('enabled')->default(false);
            $t->text('description')->nullable();
            $t->json('rules')->nullable();               // optional per-user / percentage rules
            $t->timestamps();
        });

        Schema::create('idempotency_keys', function (Blueprint $t) {
            $t->id();
            $t->string('key', 128)->unique();
            $t->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $t->string('method', 10);
            $t->string('path');
            $t->string('request_hash', 64);              // sha256 of request body
            $t->unsignedSmallInteger('response_status')->nullable();
            $t->longText('response_body')->nullable();
            $t->timestamp('locked_at')->nullable();
            $t->timestamp('completed_at')->nullable();
            $t->timestamp('expires_at')->index();
            $t->timestamps();
        });

        Schema::create('audit_logs', function (Blueprint $t) {
            $t->id();
            $t->uuid('public_id')->unique();
            $t->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $t->string('actor_type', 40)->default('user'); // user|admin|system|webhook
            $t->string('action', 80);
            $t->string('subject_type')->nullable();
            $t->unsignedBigInteger('subject_id')->nullable();
            $t->string('ip_address', 45)->nullable();
            $t->string('user_agent')->nullable();
            $t->json('context')->nullable();
            // Immutable: only created_at
            $t->timestamp('created_at')->useCurrent();

            $t->index(['subject_type', 'subject_id']);
            $t->index(['user_id', 'action']);
            $t->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('idempotency_keys');
        Schema::dropIfExists('feature_flags');
        Schema::dropIfExists('service_orders');
        Schema::dropIfExists('services');
    }
};
