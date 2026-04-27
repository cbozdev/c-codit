<?php

return [
    'mailgun' => [
        'domain'   => env('MAILGUN_DOMAIN'),
        'secret'   => env('MAILGUN_SECRET'),
        'endpoint' => env('MAILGUN_ENDPOINT', 'api.mailgun.net'),
        'scheme'   => 'https',
    ],

    'postmark' => ['token' => env('POSTMARK_TOKEN')],

    'ses' => [
        'key'    => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'flutterwave' => [
        'public_key'     => env('FLUTTERWAVE_PUBLIC_KEY'),
        'secret_key'     => env('FLUTTERWAVE_SECRET_KEY'),
        'encryption_key' => env('FLUTTERWAVE_ENCRYPTION_KEY'),
        'webhook_secret' => env('FLUTTERWAVE_WEBHOOK_SECRET'),
        'base_url'       => env('FLUTTERWAVE_BASE_URL', 'https://api.flutterwave.com/v3'),
    ],

    'nowpayments' => [
        'api_key'    => env('NOWPAYMENTS_API_KEY'),
        'ipn_secret' => env('NOWPAYMENTS_IPN_SECRET'),
        'base_url'   => env('NOWPAYMENTS_BASE_URL', 'https://api.nowpayments.io/v1'),
    ],

    'fivesim' => [
        'api_key'  => env('FIVESIM_API_KEY'),
        'base_url' => env('FIVESIM_BASE_URL', 'https://5sim.net/v1'),
    ],

    'smsactivate' => [
        'api_key'  => env('SMSACTIVATE_API_KEY'),
        'base_url' => env('SMSACTIVATE_BASE_URL', 'https://api.sms-activate.org/stubs/handler_api.php'),
    ],

    'smsman' => [
        'api_key' => env('SMSMAN_API_KEY'),
    ],

    'google' => [
        'client_id'     => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
    ],

    'apple' => [
        'client_id' => env('APPLE_CLIENT_ID'), // Apple Service ID e.g. com.yourcompany.app
    ],

    'resend' => [
        'api_key' => env('RESEND_API_KEY', env('MAIL_PASSWORD')),
    ],

    'airalo' => [
        'client_id'     => env('AIRALO_CLIENT_ID'),
        'client_secret' => env('AIRALO_CLIENT_SECRET'),
        'base_url'      => env('AIRALO_BASE_URL', 'https://www.airalo.com/api/v2'),
    ],

    'platform' => [
        'base_currency'      => env('PLATFORM_BASE_CURRENCY', 'USD'),
        'markup_percent'     => (float) env('PLATFORM_MARKUP_PERCENT', 15),
        'wallet_max_balance' => (int) env('WALLET_MAX_BALANCE', 1_000_000),
        'daily_debit_limit'  => (int) env('WALLET_DAILY_DEBIT_LIMIT', 50_000),
        'rub_usd_rate'       => (float) env('PLATFORM_RUB_USD_RATE', 0.011),
        'ngn_usd_rate'       => (float) env('PLATFORM_NGN_USD_RATE', 0.00065),
    ],
];
