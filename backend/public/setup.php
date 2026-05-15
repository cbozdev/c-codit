<?php
if (($_GET['token'] ?? '') !== 'ccodit_setup_2025') { http_response_code(403); die('Forbidden.'); }

ignore_user_abort(true);
set_time_limit(0);
header('Content-Type: text/plain; charset=utf-8');
header('X-Accel-Buffering: no');
ob_implicit_flush(true);
if (ob_get_level()) ob_end_flush();

echo "=== C-codit Setup ===\n";
echo "PHP: " . PHP_VERSION . " | Time: " . date('H:i:s') . "\n\n";
flush();

$base    = dirname(__DIR__);
$phpBin  = PHP_BINARY;
$artisan = "$base/artisan";

// Fix permissions
echo "Fixing permissions...\n";
shell_exec("chmod -R 775 $base/bootstrap/cache 2>&1");
shell_exec("chmod -R 775 $base/storage 2>&1");
echo "  bootstrap/cache: " . (is_writable("$base/bootstrap/cache") ? 'writable' : 'NOT writable') . "\n";
echo "  storage: " . (is_writable("$base/storage") ? 'writable' : 'NOT writable') . "\n\n";
flush();

// Clear config cache so fresh env is read
echo "Clearing config cache...\n";
shell_exec("$phpBin $artisan config:clear 2>&1");
echo "  Done\n\n";
flush();

// Drop partial tables from failed migration 000020 so migrate can re-run cleanly
echo "Cleaning up partial tables...\n";
flush();
$lines = @file("$base/.env", FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
$env = [];
foreach ($lines as $line) {
    if (!isset($line[0]) || $line[0] === '#' || !str_contains($line, '=')) continue;
    [$k, $v] = explode('=', $line, 2);
    $env[trim($k)] = trim($v, " \t\"'");
}
try {
    $dsn = "mysql:unix_socket=/var/lib/mysql/mysql.sock;dbname={$env['DB_DATABASE']};charset=utf8mb4";
    $pdo = new PDO($dsn, $env['DB_USERNAME'], $env['DB_PASSWORD'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $pdo->exec("SET FOREIGN_KEY_CHECKS=0");
    foreach (['audit_logs','idempotency_keys','service_orders','feature_flags','services'] as $tbl) {
        $pdo->exec("DROP TABLE IF EXISTS `$tbl`");
        echo "  Dropped $tbl (if existed)\n";
    }
    $pdo->exec("SET FOREIGN_KEY_CHECKS=1");
    echo "  Cleanup done\n\n";
} catch (Exception $e) {
    echo "  Cleanup error: " . $e->getMessage() . "\n\n";
}
flush();

$commands = [
    'migrate --force',
    'config:cache',
    'route:cache',
    'storage:link',
];

foreach ($commands as $cmd) {
    echo ">> php artisan $cmd [" . date('H:i:s') . "]\n";
    flush();
    $output = shell_exec("$phpBin $artisan $cmd 2>&1");
    echo ($output ?: '(no output)') . "\n";
    echo "   Done [" . date('H:i:s') . "]\n\n";
    flush();
}

echo "=== Finished: " . date('H:i:s') . " ===\n";
echo "DELETE THIS FILE!\n";
