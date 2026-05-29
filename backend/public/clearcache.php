<?php
$key = $_GET['key'] ?? '';
if ($key !== 'ccodit-cache-2026') { http_response_code(403); die('Forbidden'); }

chdir(dirname(__DIR__));
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo '<pre>';
\Illuminate\Support\Facades\Artisan::call('config:clear');
echo "Config: " . \Illuminate\Support\Facades\Artisan::output();
\Illuminate\Support\Facades\Artisan::call('cache:clear');
echo "Cache:  " . \Illuminate\Support\Facades\Artisan::output();
echo "Done — new .env values are now active.\n";
echo '</pre>';
