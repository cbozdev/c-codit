<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    // 1 NGN = 0.00065 USD  (platform default rate)
    private const NGN_USD_RATE = 0.00065;

    public function up(): void
    {
        DB::transaction(function () {
            $wallets = DB::table('wallets')->where('currency', 'NGN')->get();

            foreach ($wallets as $wallet) {
                // Convert balance: NGN kobo → USD cents
                $usdMinor = (int) round($wallet->balance_minor * self::NGN_USD_RATE);

                DB::table('wallets')
                    ->where('id', $wallet->id)
                    ->update(['currency' => 'USD', 'balance_minor' => $usdMinor]);

                // Update the wallet's ledger account currency
                DB::table('ledger_accounts')
                    ->where('code', 'user.wallet.' . $wallet->id)
                    ->where('currency', 'NGN')
                    ->update(['currency' => 'USD']);
            }
        });
    }

    public function down(): void
    {
        // Irreversible — do not attempt to reverse currency conversion
    }
};
