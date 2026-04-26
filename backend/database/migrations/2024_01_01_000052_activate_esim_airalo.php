<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration {
    public function up(): void
    {
        \DB::table('services')->where('code', 'esim_travel')->update([
            'provider'    => 'airalo',
            'is_active'   => true,
            'description' => 'Global data eSIMs for 190+ countries. Instant QR code delivery — no physical SIM needed.',
        ]);
    }

    public function down(): void
    {
        \DB::table('services')->where('code', 'esim_travel')->update([
            'provider'  => 'internal',
            'is_active' => false,
        ]);
    }
};
