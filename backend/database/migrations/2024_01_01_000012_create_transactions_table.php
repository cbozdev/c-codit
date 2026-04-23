<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('transactions', function (Blueprint $t) {
            $t->id();
            $t->uuid('public_id')->unique();
            $t->string('reference', 64)->unique();      // user-facing reference code
            $t->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $t->foreignId('wallet_id')->constrained('wallets')->restrictOnDelete();
            $t->string('type', 40);                      // TransactionType enum
            $t->string('status', 20)->default('pending'); // TransactionStatus enum
            $t->bigInteger('amount_minor');               // gross amount user sees
            $t->string('currency', 3)->default('USD');
            $t->string('description')->nullable();
            $t->uuid('journal_id')->nullable()->index();  // link to ledger journal
            // Polymorphic link to related business object (Payment, ServiceOrder, etc.)
            $t->string('related_type')->nullable();
            $t->unsignedBigInteger('related_id')->nullable();
            $t->string('idempotency_key', 128)->nullable()->unique();
            // For reversal/refund chains
            $t->foreignId('parent_transaction_id')->nullable()->constrained('transactions')->nullOnDelete();
            $t->json('meta')->nullable();
            $t->timestamp('completed_at')->nullable();
            $t->timestamp('failed_at')->nullable();
            $t->string('failure_reason')->nullable();
            $t->timestamps();
            $t->softDeletes();

            $t->index(['user_id', 'created_at']);
            $t->index(['status', 'type']);
            $t->index(['related_type', 'related_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};
