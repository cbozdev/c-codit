<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        DB::table('services')->insertOrIgnore([
            [
                'code'        => 'esim_celitech',
                'name'        => 'Travel eSIM — Celitech',
                'provider'    => 'celitech',
                'category'    => 'esim',
                'description' => 'Global data eSIMs powered by Celitech. Instant QR code delivery.',
                'is_active'   => false,
                'created_at'  => $now,
                'updated_at'  => $now,
            ],
            [
                'code'        => 'esim_bnesim',
                'name'        => 'Travel eSIM — BNESIM',
                'provider'    => 'bnesim',
                'category'    => 'esim',
                'description' => 'Global data eSIMs powered by BNESIM. Instant QR code delivery.',
                'is_active'   => false,
                'created_at'  => $now,
                'updated_at'  => $now,
            ],
        ]);
    }

    public function down(): void
    {
        DB::table('services')->whereIn('code', ['esim_celitech', 'esim_bnesim'])->delete();
    }
};
