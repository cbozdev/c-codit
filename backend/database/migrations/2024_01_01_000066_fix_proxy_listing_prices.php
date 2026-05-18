<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Fix prices seeded 100× too high in migration 000065.
 * Correct 30-day rates (in cents):
 *   wifi+http   → $8.00  (800 minor)
 *   wifi+socks5 → $9.50  (950 minor)
 *   cell+http   → $11.00 (1100 minor)
 *   cell+socks5 → $13.00 (1300 minor)
 */
return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('proxy_listings')) return;

        DB::table('proxy_listings')
            ->where('connection_type', 'wifi')->where('protocol', 'http')
            ->update(['price_minor' => 800]);

        DB::table('proxy_listings')
            ->where('connection_type', 'wifi')->where('protocol', 'socks5')
            ->update(['price_minor' => 950]);

        DB::table('proxy_listings')
            ->where('connection_type', 'cell')->where('protocol', 'http')
            ->update(['price_minor' => 1100]);

        DB::table('proxy_listings')
            ->where('connection_type', 'cell')->where('protocol', 'socks5')
            ->update(['price_minor' => 1300]);
    }

    public function down(): void {}
};
