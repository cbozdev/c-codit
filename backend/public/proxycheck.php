<?php
if (($_GET['t'] ?? '') !== 'go') { die('no'); }
header('Content-Type: text/plain; charset=utf-8');

$base = dirname(__DIR__);
require $base . '/vendor/autoload.php';
$app = require_once $base . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$u = config('services.decodo.username');
$p = config('services.decodo.password');
$e = config('services.decodo.enabled');

echo "DECODO_ENABLED : " . var_export($e, true) . "\n";
echo "DECODO_USERNAME: " . ($u ? substr($u, 0, 6) . '***' : 'NOT SET') . "\n";
echo "DECODO_PASSWORD: " . ($p ? '***set***' : 'NOT SET') . "\n\n";

$ok = $e && !empty($u) && !empty($p);
echo "Provider ready : " . ($ok ? "YES" : "NO - provider not enabled, purchases will fail") . "\n\n";

// Check proxy_listings count
try {
    $count = \Illuminate\Support\Facades\DB::table('proxy_listings')->count();
    $prices = \Illuminate\Support\Facades\DB::table('proxy_listings')
        ->selectRaw('connection_type, protocol, MIN(price_minor) as min_p, MAX(price_minor) as max_p')
        ->groupBy('connection_type', 'protocol')
        ->get();
    echo "proxy_listings rows: $count\n";
    foreach ($prices as $r) {
        echo "  {$r->connection_type}+{$r->protocol}: {$r->min_p}–{$r->max_p} minor\n";
    }
} catch (\Throwable $e) {
    echo "DB error: " . $e->getMessage() . "\n";
}
