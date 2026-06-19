<?php
if (($_GET['key'] ?? '') !== 'ccodit-migrate-2026') {
    http_response_code(403); exit('Forbidden');
}

define('LARAVEL_START', microtime(true));
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo '<pre>';
\Illuminate\Support\Facades\Artisan::call('migrate', ['--force' => true]);
echo htmlspecialchars(\Illuminate\Support\Facades\Artisan::output());
echo '</pre>';
echo 'Done.';
