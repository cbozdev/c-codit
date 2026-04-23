<?php

namespace Database\Seeders;

use App\Models\FeatureFlag;
use Illuminate\Database\Seeder;

class FeatureFlagsSeeder extends Seeder
{
    public function run(): void
    {
        $flags = [
            ['key' => 'crypto_funding',    'enabled' => true,  'description' => 'Allow funding via NowPayments (crypto).'],
            ['key' => 'card_funding',      'enabled' => true,  'description' => 'Allow funding via Flutterwave (card).'],
            ['key' => 'virtual_numbers',   'enabled' => true,  'description' => 'Enable virtual number purchase flow.'],
            ['key' => 'esim',              'enabled' => false, 'description' => 'Enable eSIM purchase flow.'],
            ['key' => 'giftcards',         'enabled' => false, 'description' => 'Enable gift card purchase flow.'],
            ['key' => 'utility_bills',     'enabled' => false, 'description' => 'Enable utility bills payment flow.'],
        ];
        foreach ($flags as $f) {
            FeatureFlag::updateOrCreate(['key' => $f['key']], $f);
        }
    }
}
