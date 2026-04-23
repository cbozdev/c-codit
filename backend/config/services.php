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

    'platform' => [
        'base_currency'      => env('PLATFORM_BASE_CURRENCY', 'USD'),
        'markup_percent'     => (float) env('PLATFORM_MARKUP_PERCENT', 15),
        'wallet_max_balance' => (int) env('WALLET_MAX_BALANCE', 1_000_000),
        'daily_debit_limit'  => (int) env('WALLET_DAILY_DEBIT_LIMIT', 50_000),
    ],
];
