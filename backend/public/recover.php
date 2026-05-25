<?php
if (($_GET['token'] ?? '') !== 'ccodit_recover_2025') {
    http_response_code(403); die('Forbidden.');
}

header('Content-Type: text/plain; charset=utf-8');
ignore_user_abort(true);
set_time_limit(60);

$base = dirname(__DIR__);
$php  = PHP_BINARY;
$art  = "$base/artisan";

echo "=== C-codit Recovery (Seed Proxy Services) ===\n\n";

require $base . '/vendor/autoload.php';
$app = require_once $base . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

// Remove stub record so migrate will re-run the seed
DB::table('migrations')->where('migration', '2024_01_01_000064_seed_proxy_services')->delete();
echo "Removed stub for 000064. Running migrate...\n\n";

echo shell_exec("$php $art migrate --force --no-interaction 2>&1");

echo "\nDone. DELETE THIS FILE NOW.\n";
