<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('services')->insertOrIgnore([[
            'code'        => 'vnum_smspool',
            'name'        => 'Virtual Numbers — Server 4',
            'provider'    => 'smspool',
            'category'    => 'virtual_number',
            'description' => 'Disposable phone numbers via SMSPool. 50+ countries.',
            'is_active'   => false,
            'created_at'  => now(),
            'updated_at'  => now(),
        ]]);
    }

    public function down(): void
    {
        DB::table('services')->where('code', 'vnum_smspool')->delete();
    }
};
