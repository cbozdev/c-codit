<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('services')->insertOrIgnore([[
            'code'        => 'vnum_textverified',
            'name'        => 'Virtual Numbers — TextVerified',
            'provider'    => 'textverified',
            'category'    => 'virtual_number',
            'description' => 'US phone numbers for SMS verification via TextVerified.',
            'is_active'   => false,
            'created_at'  => now(),
            'updated_at'  => now(),
        ]]);
    }

    public function down(): void
    {
        DB::table('services')->where('code', 'vnum_textverified')->delete();
    }
};
