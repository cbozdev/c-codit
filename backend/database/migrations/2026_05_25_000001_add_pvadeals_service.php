<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('services')->insertOrIgnore([[
            'code'        => 'vnum_pvadeals',
            'name'        => 'Virtual Numbers — Server 5',
            'provider'    => 'pvadeals',
            'category'    => 'virtual_number',
            'description' => 'US phone numbers for SMS verification via PVADeals.',
            'is_active'   => false,
            'created_at'  => now(),
            'updated_at'  => now(),
        ]]);
    }

    public function down(): void
    {
        DB::table('services')->where('code', 'vnum_pvadeals')->delete();
    }
};
