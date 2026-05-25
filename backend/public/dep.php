<?php
if (($_GET['t'] ?? '') !== 'go') { die('no'); }
header('Content-Type: text/plain');

$repo    = '/home/ccoditco/c-codit';
$artisan = '/home/ccoditco/c-codit/backend/artisan';
$php     = '/usr/local/bin/lsphp';

echo "=== git pull ===\n";
echo shell_exec("cd {$repo} && git pull origin main 2>&1");

echo "\n=== config:cache ===\n";
echo shell_exec("{$php} {$artisan} config:cache 2>&1");

echo "\n=== route:cache ===\n";
echo shell_exec("{$php} {$artisan} route:cache 2>&1");

echo "\n=== cache:clear ===\n";
echo shell_exec("{$php} {$artisan} cache:clear 2>&1");

echo "\nDone.\n";
