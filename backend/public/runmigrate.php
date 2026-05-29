<?php
// One-time migration runner — DELETE after use
$key = $_GET['key'] ?? '';
if ($key !== 'ccodit-migrate-2026') {
    http_response_code(403);
    die('Forbidden');
}

chdir(dirname(__DIR__));
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo '<pre>';
\Illuminate\Support\Facades\Artisan::call('migrate', ['--force' => true]);
echo htmlspecialchars(\Illuminate\Support\Facades\Artisan::output());
echo '</pre>';
