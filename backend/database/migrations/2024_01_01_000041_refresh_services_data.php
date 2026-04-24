<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Artisan;

/**
 * Re-run the services seeder to replace generic service records
 * with individual ones (individual gift cards, utility types, etc.)
 */
return new class extends Migration {
    public function up(): void
    {
        // Remove old generic/placeholder services
        \DB::table('services')
            ->whereIn('code', ['esim', 'giftcard', 'utility_bills'])
            ->delete();

        // Re-seed services
        Artisan::call('db:seed', [
            '--class' => 'ServicesSeeder',
            '--force' => true,
        ]);
    }

    public function down(): void {}
};
