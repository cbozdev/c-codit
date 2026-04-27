<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        \DB::table('services')->updateOrInsert(
            ['code' => 'vnum_smsactivate3'],
            [
                'name'           => 'Virtual Numbers — Server 3',
                'provider'       => 'smsactivate',
                'category'       => 'virtual_number',
                'description'    => 'Disposable phone numbers via SMS-Activate. 190+ countries.',
                'currency'       => 'USD',
                'markup_percent' => 15,
                'is_active'      => false,
                'created_at'     => now(),
                'updated_at'     => now(),
            ]
        );
    }

    public function down(): void
    {
        \DB::table('services')->where('code', 'vnum_smsactivate3')->delete();
    }
};
