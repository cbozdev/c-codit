<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration {
    public function up(): void
    {
        \DB::table('services')->where('code', 'vnum_5sim')->update([
            'name' => 'Virtual Numbers — Server 1',
        ]);
        \DB::table('services')->where('code', 'vnum_smsactivate')->update([
            'name' => 'Virtual Numbers — Server 2',
        ]);
    }

    public function down(): void
    {
        \DB::table('services')->where('code', 'vnum_5sim')->update([
            'name' => '5sim Virtual Numbers',
        ]);
        \DB::table('services')->where('code', 'vnum_smsactivate')->update([
            'name' => 'SMS-Activate Virtual Numbers',
        ]);
    }
};
