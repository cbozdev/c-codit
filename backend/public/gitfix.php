<?php
if (($_GET['token'] ?? '') !== 'ccodit_gitfix_2025') {
    http_response_code(403); die('Forbidden.');
}

header('Content-Type: text/plain; charset=utf-8');
ignore_user_abort(true);
set_time_limit(120);

$base   = '/home/ccoditco/c-codit';
$php    = PHP_BINARY;
$art    = "$base/backend/artisan";

if (function_exists('opcache_reset')) {
    opcache_reset();
    echo "OPcache cleared.\n";
}

echo "=== Deploy ===\n\n";

echo "1. Git fetch...\n";
echo shell_exec("cd $base && git fetch origin 2>&1");

echo "\n2. Git reset to origin/main...\n";
echo shell_exec("cd $base && git reset --hard origin/main 2>&1");

echo "\n3. Migrate...\n";
echo shell_exec("$php $art migrate --force --no-interaction 2>&1");

echo "\n4. Config clear (not cache — API keys live in DB, not .env)...\n";
echo shell_exec("$php $art config:clear 2>&1");

echo "\n5. Route cache...\n";
echo shell_exec("$php $art route:cache 2>&1");

echo "\n7. Copy frontend dist to public_html...\n";
echo shell_exec("/bin/cp -rf $base/frontend/dist/. /home/ccoditco/public_html/ 2>&1");
echo "Done.\n";

echo "\nDelete this file when finished.\n";
