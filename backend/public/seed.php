<?php
if (($_GET['token'] ?? '') !== 'ccodit_setup_2025') { http_response_code(403); die('Forbidden.'); }

ignore_user_abort(true);
set_time_limit(0);
header('Content-Type: text/plain; charset=utf-8');
header('X-Accel-Buffering: no');
ob_implicit_flush(true);
if (ob_get_level()) ob_end_flush();

echo "=== C-codit Seeder ===\n";
echo "PHP: " . PHP_VERSION . " | Time: " . date('H:i:s') . "\n\n";
flush();

$base    = dirname(__DIR__);
$phpBin  = PHP_BINARY;
$artisan = "$base/artisan";

echo ">> php artisan db:seed --force [" . date('H:i:s') . "]\n";
flush();
$output = shell_exec("$phpBin $artisan db:seed --force 2>&1");
echo ($output ?: '(no output)') . "\n";
echo "   Done [" . date('H:i:s') . "]\n\n";
flush();

echo "=== Finished: " . date('H:i:s') . " ===\n";
echo "DELETE THIS FILE!\n";
