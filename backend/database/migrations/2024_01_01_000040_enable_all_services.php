<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Enable all services that have real provider integrations
 * or are UI-ready for the platform.
 */
return new class extends Migration {
    public function up(): void
    {
        // Enable virtual number providers (already have API integrations)
        DB::table('services')
            ->whereIn('code', ['vnum_5sim', 'vnum_smsactivate'])
            ->update(['is_active' => true]);

        // Enable utility bills (Flutterwave integration ready)
        DB::table('services')
            ->whereIn('code', [
                'utility_airtime_ng',
                'utility_data_ng',
                'utility_electricity',
                'utility_dstv',
                'utility_startimes',
            ])
            ->update(['is_active' => true]);

        // Gift cards — enable for display (manual fulfillment mode)
        DB::table('services')
            ->whereIn('code', [
                'giftcard_amazon',
                'giftcard_google',
                'giftcard_apple',
                'giftcard_steam',
                'giftcard_netflix',
                'giftcard_xbox',
                'giftcard_spotify',
                'giftcard_jumia',
            ])
            ->update(['is_active' => true]);
    }

    public function down(): void
    {
        DB::table('services')
            ->whereNotIn('code', ['vnum_5sim', 'vnum_smsactivate'])
            ->update(['is_active' => false]);
    }
};
