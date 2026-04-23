<?php

namespace Database\Seeders;

use App\Models\Service;
use Illuminate\Database\Seeder;

class ServicesSeeder extends Seeder
{
    public function run(): void
    {
        $services = [
            ['code' => 'vnum_5sim',        'name' => '5sim Virtual Numbers',        'provider' => '5sim',         'category' => 'virtual_number', 'description' => 'Buy disposable virtual numbers via 5sim.'],
            ['code' => 'vnum_smsactivate', 'name' => 'SMS-Activate Virtual Numbers','provider' => 'smsactivate', 'category' => 'virtual_number', 'description' => 'Buy disposable virtual numbers via sms-activate.'],
            ['code' => 'esim',             'name' => 'eSIM',                        'provider' => 'internal',     'category' => 'esim',           'description' => 'Travel eSIMs (coming soon).', 'is_active' => false],
            ['code' => 'giftcard',         'name' => 'Gift Cards',                  'provider' => 'internal',     'category' => 'giftcard',       'description' => 'Digital gift cards (coming soon).', 'is_active' => false],
            ['code' => 'utility_bills',    'name' => 'Utility Bills (Flutterwave)', 'provider' => 'flutterwave',  'category' => 'utility',        'description' => 'Pay airtime/data/utility bills via Flutterwave.', 'is_active' => false],
        ];

        foreach ($services as $row) {
            Service::updateOrCreate(['code' => $row['code']], array_merge([
                'is_active' => true,
                'currency'  => 'USD',
            ], $row));
        }
    }
}
