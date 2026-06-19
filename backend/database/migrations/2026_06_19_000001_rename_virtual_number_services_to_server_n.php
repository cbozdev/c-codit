<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Rename virtual_number services to "Server 1", "Server 2", etc. in ID order.
        // Admins can rename them anytime via the admin panel.
        $ids = DB::table('services')
            ->where('category', 'virtual_number')
            ->orderBy('id')
            ->pluck('id');

        foreach ($ids as $i => $id) {
            DB::table('services')
                ->where('id', $id)
                ->update(['name' => 'Server ' . ($i + 1)]);
        }
    }

    public function down(): void
    {
        // No rollback — names are admin-editable, original values aren't stored here
    }
};
