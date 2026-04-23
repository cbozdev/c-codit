<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $t) {
            $t->id();
            $t->uuid('public_id')->unique();
            $t->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $t->string('provider', 40);                 // PaymentProvider enum
            $t->string('provider_reference', 128)->nullable()->index(); // tx_ref / invoice id
            $t->string('provider_payment_id', 128)->nullable()->index();
            $t->string('status', 20)->default('initiated'); // PaymentStatus enum
            $t->bigInteger('amount_minor');
            $t->string('currency', 3);
            // For crypto, the requested fiat, then the crypto amount
            $t->bigInteger('requested_amount_minor')->nullable();
            $t->string('requested_currency', 3)->nullable();
            $t->string('pay_currency', 10)->nullable();   // BTC, ETH, USDT, etc.
            $t->string('pay_address')->nullable();
            $t->string('checkout_url')->nullable();
            $t->string('idempotency_key', 128)->unique();
            $t->json('request_payload')->nullable();
            $t->json('response_payload')->nullable();
            $t->json('webhook_payload')->nullable();
            $t->timestamp('verified_at')->nullable();
            $t->timestamp('expires_at')->nullable();
            $t->timestamps();
            $t->softDeletes();

            $t->unique(['provider', 'provider_reference']);
            $t->index(['user_id', 'status']);
        });

        // Webhook event log - track every inbound webhook to guarantee idempotency
        Schema::create('webhook_events', function (Blueprint $t) {
            $t->id();
            $t->string('provider', 40);
            $t->string('event_id', 128)->nullable();     // provider's event id
            $t->string('signature', 512)->nullable();
            $t->string('signature_hash', 128)->index();  // sha256 of signature for dedup
            $t->json('payload');
            $t->string('status', 20)->default('received'); // received|processed|failed|duplicate
            $t->text('error')->nullable();
            $t->timestamp('processed_at')->nullable();
            $t->timestamp('received_at')->useCurrent();

            $t->unique(['provider', 'signature_hash']);
            $t->index(['provider', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('webhook_events');
        Schema::dropIfExists('payments');
    }
};
