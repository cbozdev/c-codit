<?php

return [
    'driver'           => env('SESSION_DRIVER', 'redis'),
    'lifetime'         => (int) env('SESSION_LIFETIME', 120),
    'expire_on_close'  => false,
    'encrypt'          => false,
    'files'            => storage_path('framework/sessions'),
    'connection'       => 'default',
    'table'            => 'sessions',
    'store'            => null,
    'lottery'          => [2, 100],
    'cookie'           => env('SESSION_COOKIE', 'ccodit_session'),
    'path'             => '/',
    'domain'           => env('SESSION_DOMAIN'),
    'secure'           => env('SESSION_SECURE_COOKIE', true),
    'http_only'        => true,
    'same_site'        => 'lax',
];
