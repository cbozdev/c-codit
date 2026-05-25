<?php
if (($_GET['token'] ?? '') !== 'ccodit_setup_2025') { http_response_code(403); die('Forbidden.'); }
header('Content-Type: text/plain; charset=utf-8');

$base   = dirname(__DIR__);
$phpBin = PHP_BINARY;

// 5sim returns USD prices directly — rate must be 1.0 (no conversion needed)
echo "=== Fixing PLATFORM_RUB_USD_RATE to 1.0 ===\n";
$envPath = "$base/.env";
$env = file_get_contents($envPath);
$env = preg_replace('/^PLATFORM_RUB_USD_RATE=.*/m', 'PLATFORM_RUB_USD_RATE=1.0', $env);
file_put_contents($envPath, $env);
echo "  Set to 1.0 (5sim guest API returns USD directly)\n\n";

// Delete old cache and rebuild
@unlink("$base/bootstrap/cache/config.php");
echo shell_exec("$phpBin $base/artisan config:cache 2>&1");

// Verify
$content = file_get_contents("$base/bootstrap/cache/config.php");
preg_match("/'rub_usd_rate'\s*=>\s*([^,\n]+)/", $content, $r);
echo "rub_usd_rate in cached config = " . ($r[1] ?? 'NOT FOUND') . "\n\n";

echo "=== Expected prices after fix ===\n";
echo "  Argentina WhatsApp cheapest: \$0.2513 × 1.0 = \$0.2513 USD\n";
echo "  With 15% markup: ~\$0.29 USD\n";
echo "  Done — reload the services page!\n";
