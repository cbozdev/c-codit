<?php

use Monolog\Handler\StreamHandler;
use Monolog\Formatter\JsonFormatter;

return [
    'default' => env('LOG_CHANNEL', 'stack'),

    'deprecations' => [
        'channel' => env('LOG_DEPRECATIONS_CHANNEL', 'null'),
        'trace'   => false,
    ],

    'channels' => [
        'stack' => [
            'driver'   => 'stack',
            'channels' => ['stderr', 'daily'],
            'ignore_exceptions' => false,
        ],

        'stderr' => [
            'driver'    => 'monolog',
            'level'     => env('LOG_LEVEL', 'info'),
            'handler'   => StreamHandler::class,
            'formatter' => JsonFormatter::class,
            'with' => ['stream' => 'php://stderr'],
        ],

        'daily' => [
            'driver' => 'daily',
            'path'   => storage_path('logs/laravel.log'),
            'level'  => env('LOG_LEVEL', 'info'),
            'days'   => 14,
        ],

        'payments' => [
            'driver'    => 'daily',
            'path'      => storage_path('logs/payments.log'),
            'level'     => 'info',
            'days'      => 90,
            'formatter' => JsonFormatter::class,
        ],

        'webhooks' => [
            'driver'    => 'daily',
            'path'      => storage_path('logs/webhooks.log'),
            'level'     => 'info',
            'days'      => 90,
            'formatter' => JsonFormatter::class,
        ],

        'null' => [
            'driver'  => 'monolog',
            'handler' => Monolog\Handler\NullHandler::class,
        ],
    ],
];
