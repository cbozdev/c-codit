<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration {
    // Repurpose the dormant vnum_smsactivate service slot to use SMS-Man.
    // sms-activate.org is unreachable from Render (DNS blocked on all domains).
    public function up(): void
    {
        \DB::table('services')
            ->where('code', 'vnum_smsactivate')
            ->update([
                'provider'    => 'smsman',
                'description' => 'Disposable phone numbers via SMS-Man. 150+ countries.',
                'is_active'   => true,
            ]);
    }

    public function down(): void
    {
        \DB::table('services')
            ->where('code', 'vnum_smsactivate')
            ->update([
                'provider'    => 'smsactivate',
                'description' => 'Disposable phone numbers via sms-activate.org. 190+ countries.',
                'is_active'   => false,
            ]);
    }
};
