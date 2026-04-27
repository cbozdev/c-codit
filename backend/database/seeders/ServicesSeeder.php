<?php

namespace Database\Seeders;

use App\Models\Service;
use Illuminate\Database\Seeder;

class ServicesSeeder extends Seeder
{
    public function run(): void
    {
        $services = [
            // ── Virtual Numbers ──────────────────────────────────────────
            [
                'code'     => 'vnum_5sim',
                'name'     => 'Virtual Numbers — Server 1',
                'provider' => '5sim',
                'category' => 'virtual_number',
                'description' => 'Disposable phone numbers for SMS verification via 5sim. 200+ countries.',
                'is_active' => true,
            ],
            [
                'code'     => 'vnum_smsactivate',
                'name'     => 'Virtual Numbers — Server 2',
                'provider' => 'smsman',
                'category' => 'virtual_number',
                'description' => 'Disposable phone numbers via SMS-Man. 150+ countries.',
                'is_active' => true,
            ],
            [
                'code'     => 'vnum_smsactivate3',
                'name'     => 'Virtual Numbers — Server 3',
                'provider' => 'smsactivate',
                'category' => 'virtual_number',
                'description' => 'Disposable phone numbers via SMS-Activate. 190+ countries.',
                'is_active' => false,
            ],

            // ── eSIM ─────────────────────────────────────────────────────
            [
                'code'     => 'esim_travel',
                'name'     => 'Travel eSIM',
                'provider' => 'airalo',
                'category' => 'esim',
                'description' => 'Global data eSIMs for 190+ countries. Instant QR code delivery — no physical SIM needed.',
                'is_active' => true,
            ],

            // ── Gift Cards ────────────────────────────────────────────────
            [
                'code'     => 'giftcard_amazon',
                'name'     => 'Amazon Gift Card',
                'provider' => 'internal',
                'category' => 'giftcard',
                'description' => 'Amazon gift card codes. Valid in US, UK, DE and more.',
                'is_active' => true,
            ],
            [
                'code'     => 'giftcard_google',
                'name'     => 'Google Play Gift Card',
                'provider' => 'internal',
                'category' => 'giftcard',
                'description' => 'Google Play credit for apps, games and subscriptions.',
                'is_active' => true,
            ],
            [
                'code'     => 'giftcard_apple',
                'name'     => 'Apple Gift Card',
                'provider' => 'internal',
                'category' => 'giftcard',
                'description' => 'App Store & iTunes credit. Works on iPhone, iPad, Mac.',
                'is_active' => true,
            ],
            [
                'code'     => 'giftcard_netflix',
                'name'     => 'Netflix Gift Card',
                'provider' => 'internal',
                'category' => 'giftcard',
                'description' => 'Netflix subscription credit. Redeem on any Netflix account.',
                'is_active' => true,
            ],
            [
                'code'     => 'giftcard_steam',
                'name'     => 'Steam Gift Card',
                'provider' => 'internal',
                'category' => 'giftcard',
                'description' => 'Steam Wallet codes for games and in-game content.',
                'is_active' => true,
            ],
            [
                'code'     => 'giftcard_xbox',
                'name'     => 'Xbox Gift Card',
                'provider' => 'internal',
                'category' => 'giftcard',
                'description' => 'Microsoft Store credit for Xbox games and subscriptions.',
                'is_active' => true,
            ],
            [
                'code'     => 'giftcard_spotify',
                'name'     => 'Spotify Gift Card',
                'provider' => 'internal',
                'category' => 'giftcard',
                'description' => 'Spotify Premium subscription gift cards.',
                'is_active' => true,
            ],
            [
                'code'     => 'giftcard_jumia',
                'name'     => 'Jumia Gift Voucher',
                'provider' => 'internal',
                'category' => 'giftcard',
                'description' => 'Jumia shopping vouchers for Nigeria, Kenya, Ghana.',
                'is_active' => true,
            ],

            // ── Utility Bills ─────────────────────────────────────────────
            [
                'code'     => 'utility_airtime_ng',
                'name'     => 'Nigerian Airtime',
                'provider' => 'flutterwave',
                'category' => 'utility',
                'description' => 'Top up MTN, Airtel, Glo and 9mobile airtime instantly.',
                'is_active' => true,
            ],
            [
                'code'     => 'utility_data_ng',
                'name'     => 'Nigerian Data Bundles',
                'provider' => 'flutterwave',
                'category' => 'utility',
                'description' => 'Buy data bundles for MTN, Airtel, Glo and 9mobile.',
                'is_active' => true,
            ],
            [
                'code'     => 'utility_electricity',
                'name'     => 'Electricity Bills',
                'provider' => 'flutterwave',
                'category' => 'utility',
                'description' => 'Pay EKEDC, IKEDC, AEDC, PHEDC and other electricity bills.',
                'is_active' => true,
            ],
            [
                'code'     => 'utility_dstv',
                'name'     => 'DSTV / GOtv',
                'provider' => 'flutterwave',
                'category' => 'utility',
                'description' => 'Pay DSTV, GOtv and Showmax subscriptions.',
                'is_active' => true,
            ],
            [
                'code'     => 'utility_startimes',
                'name'     => 'StarTimes',
                'provider' => 'flutterwave',
                'category' => 'utility',
                'description' => 'Pay StarTimes TV subscription.',
                'is_active' => true,
            ],
        ];

        // Remove old generic service records that conflict
        Service::whereIn('code', ['esim', 'giftcard', 'utility_bills'])->delete();

        foreach ($services as $row) {
            Service::updateOrCreate(
                ['code' => $row['code']],
                array_merge(['currency' => 'USD', 'markup_percent' => 15], $row)
            );
        }
    }
}
