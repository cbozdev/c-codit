<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    // 1 USD = 1600 NGN → USD cents = NGN kobo / 1600
    private const NGN_PER_USD = 1600;

    public function up(): void
    {
        DB::transaction(function () {
            $wallets = DB::table('wallets')->where('currency', 'NGN')->get();

            foreach ($wallets as $wallet) {
                $usdMinor = max(0, (int) round($wallet->balance_minor / self::NGN_PER_USD));

                DB::table('wallets')
                    ->where('id', $wallet->id)
                    ->update(['currency' => 'USD', 'balance_minor' => $usdMinor]);

                DB::table('ledger_accounts')
                    ->where('code', 'user.wallet.' . $wallet->id)
                    ->where('currency', 'NGN')
                    ->update(['currency' => 'USD']);
            }
        });
    }

    public function down(): void {}
};
