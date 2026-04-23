<?php

namespace Database\Seeders;

use App\Models\User;
use App\Services\Wallet\WalletService;
use Illuminate\Database\Seeder;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $email = env('SEED_ADMIN_EMAIL', 'admin@c-codit.com');
        $password = env('SEED_ADMIN_PASSWORD', 'ChangeMe!2025');

        $admin = User::firstOrCreate(
            ['email' => strtolower($email)],
            [
                'name'              => 'Platform Admin',
                'password'          => $password,
                'email_verified_at' => now(),
                'terms_accepted_at' => now(),
                'terms_version'     => '1.0',
                'is_active'         => true,
            ],
        );

        if (! $admin->hasRole('admin')) {
            $admin->assignRole('admin');
        }

        app(WalletService::class)->getOrCreate($admin, 'USD');
    }
}
