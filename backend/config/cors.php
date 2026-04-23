<?php

$origins = env('CORS_ALLOWED_ORIGINS');
$allowed = $origins ? array_map('trim', explode(',', $origins)) : ['*'];

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie', 'webhooks/*'],
    'allowed_methods' => ['*'],
    'allowed_origins' => $allowed,
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => true,
];
