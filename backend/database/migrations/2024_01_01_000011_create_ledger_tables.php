<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Chart of accounts
        Schema::create('ledger_accounts', function (Blueprint $t) {
            $t->id();
            $t->string('code', 64)->unique();             // e.g. "user.wallet.123", "cash.flutterwave"
            $t->string('name');
            $t->string('type', 20);                       // AccountType enum
            $t->string('currency', 3)->default('USD');
            // Morph target (e.g. user_id -> wallet account). Null for system accounts.
            $t->string('owner_type')->nullable();
            $t->unsignedBigInteger('owner_id')->nullable();
            $t->boolean('is_system')->default(false);
            $t->boolean('is_active')->default(true);
            $t->json('meta')->nullable();
            $t->timestamps();

            $t->index(['owner_type', 'owner_id']);
            $t->index('type');
        });

        // Immutable double-entry ledger
        // Every business event creates one "journal" with >=2 entries that sum to zero.
        Schema::create('ledger_entries', function (Blueprint $t) {
            $t->id();
            $t->uuid('public_id')->unique();
            $t->uuid('journal_id')->index();              // groups entries of same event
            $t->foreignId('account_id')->constrained('ledger_accounts')->restrictOnDelete();
            $t->string('direction', 6);                   // debit | credit
            // Always positive; "direction" column encodes sign. Stored in minor units.
            $t->bigInteger('amount_minor');
            $t->string('currency', 3);
            // Balance AFTER this entry on this account - computed at insert time for audit
            $t->bigInteger('balance_after_minor');
            // Link to the business object that caused the entry
            $t->string('reference_type')->nullable();
            $t->unsignedBigInteger('reference_id')->nullable();
            // Idempotency: the same (journal_id, account_id, direction) can never be inserted twice
            $t->string('idempotency_key', 128)->nullable();
            $t->string('memo')->nullable();
            $t->json('meta')->nullable();
            // Immutable: no updated_at. Once written, never changes.
            $t->timestamp('created_at')->useCurrent();

            $t->unique(['journal_id', 'account_id', 'direction'], 'ledger_entries_unique_leg');
            $t->unique('idempotency_key');
            $t->index(['reference_type', 'reference_id']);
            $t->index(['account_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ledger_entries');
        Schema::dropIfExists('ledger_accounts');
    }
};
