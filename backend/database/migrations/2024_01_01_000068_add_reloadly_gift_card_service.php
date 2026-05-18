<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Replace the stubbed 'internal' gift card services with a unified
 * Reloadly-backed service. The frontend now fetches the live product
 * catalog from Reloadly instead of using static brand names.
 */
return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('services')) return;

        // Disable the old internal stubs
        DB::table('services')
            ->where('provider', 'internal')
            ->where('category', 'giftcard')
            ->update(['is_active' => false]);

        // Upsert the unified Reloadly gift card service
        $existing = DB::table('services')->where('code', 'giftcard')->first();

        if ($existing) {
            DB::table('services')
                ->where('code', 'giftcard')
                ->update([
                    'provider'       => 'reloadly',
                    'is_active'      => true,
                    'markup_percent' => 5.00,
                    'updated_at'     => now(),
                ]);
        } else {
            DB::table('services')->insert([
                'code'           => 'giftcard',
                'name'           => 'Gift Cards',
                'provider'       => 'reloadly',
                'category'       => 'giftcard',
                'description'    => 'Instant digital gift cards for Amazon, Google Play, Apple, Netflix, Steam, and hundreds more brands worldwide.',
                'is_active'      => true,
                'currency'       => 'USD',
                'markup_percent' => 5.00,
                'config'         => json_encode([]),
                'created_at'     => now(),
                'updated_at'     => now(),
            ]);
        }
    }

    public function down(): void
    {
        DB::table('services')
            ->where('code', 'giftcard')
            ->where('provider', 'reloadly')
            ->delete();

        DB::table('services')
            ->where('provider', 'internal')
            ->where('category', 'giftcard')
            ->update(['is_active' => true]);
    }
};
