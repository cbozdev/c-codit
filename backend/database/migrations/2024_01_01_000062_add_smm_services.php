<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('services')->insertOrIgnore([
            [
                'code'        => 'smm_boost',
                'name'        => 'Social Media Boost',
                'provider'    => 'smmpanel',
                'category'    => 'smm',
                'description' => 'Buy followers, likes, views & more for Instagram, YouTube, TikTok and other platforms.',
                'is_active'   => false,
                'created_at'  => now(),
                'updated_at'  => now(),
            ],
            [
                'code'        => 'smm_accounts',
                'name'        => 'Social Media Accounts',
                'provider'    => 'smmpanel',
                'category'    => 'smm_accounts',
                'description' => 'Buy aged, verified & fresh social media accounts for any platform.',
                'is_active'   => false,
                'created_at'  => now(),
                'updated_at'  => now(),
            ],
        ]);
    }

    public function down(): void
    {
        DB::table('services')->whereIn('code', ['smm_boost', 'smm_accounts'])->delete();
    }
};
