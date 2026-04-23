<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('wallets', function (Blueprint $t) {
            $t->id();
            $t->uuid('public_id')->unique();
            $t->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();
            $t->string('currency', 3)->default('USD');
            // Balance is stored in MINOR UNITS (cents). NEVER use float for money.
            $t->bigInteger('balance_minor')->default(0);
            $t->bigInteger('pending_balance_minor')->default(0);
            $t->boolean('is_frozen')->default(false);
            $t->string('frozen_reason')->nullable();
            $t->timestamp('frozen_at')->nullable();
            $t->bigInteger('version')->default(0); // optimistic locking
            $t->timestamps();

            $t->index(['user_id', 'currency']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wallets');
    }
};
