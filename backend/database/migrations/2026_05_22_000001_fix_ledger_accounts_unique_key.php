<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('ledger_accounts', function (Blueprint $t) {
            $t->dropUnique('ledger_accounts_code_unique');
            $t->unique(['code', 'currency'], 'ledger_accounts_code_currency_unique');
        });
    }

    public function down(): void
    {
        Schema::table('ledger_accounts', function (Blueprint $t) {
            $t->dropUnique('ledger_accounts_code_currency_unique');
            $t->unique('code', 'ledger_accounts_code_unique');
        });
    }
};
