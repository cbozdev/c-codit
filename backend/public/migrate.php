<?php
// One-time migration runner — DELETE THIS FILE after use
define('TOKEN', 'dc68c076ce489b642808489aa4b5c326');

if (($_GET['token'] ?? '') !== TOKEN) {
    http_response_code(403);
    die('Forbidden');
}

$base = dirname(__DIR__);
chdir($base);

$output = [];
$code   = 0;
exec('php artisan migrate --force 2>&1', $output, $code);

header('Content-Type: text/plain; charset=utf-8');
echo implode("\n", $output) . "\n";
echo "\nExit code: $code\n";
