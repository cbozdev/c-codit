<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration {
    // sms-activate.org and all its domains are unreachable from Render (DNS blocked).
    // Deactivate Server 2 until a working alternative endpoint is configured.
    public function up(): void
    {
        \DB::table('services')->where('code', 'vnum_smsactivate')->update(['is_active' => false]);
    }

    public function down(): void
    {
        \DB::table('services')->where('code', 'vnum_smsactivate')->update(['is_active' => true]);
    }
};
