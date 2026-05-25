<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::table('services')->where('code', 'vnum_pvadeals_ltr')->exists()) {
            return;
        }

        DB::table('services')->insert([
            'code'           => 'vnum_pvadeals_ltr',
            'provider'       => 'pvadeals',
            'category'       => 'virtual_number',
            'name'           => 'Virtual Numbers — Server 5 LTR',
            'description'    => 'US phone numbers for 3–30 day rentals via PVADeals. One number, reusable for the rental period.',
            'is_active'      => false,
            'markup_percent' => 15,
            'created_at'     => now(),
            'updated_at'     => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('services')->where('code', 'vnum_pvadeals_ltr')->delete();
    }
};
