<?php
if (($_GET['token'] ?? '') !== 'ccodit_setup_2025') { http_response_code(403); die('Forbidden.'); }

header('Content-Type: text/plain; charset=utf-8');
set_time_limit(300);

echo "=== C-codit Setup ===\n\n";

require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);

function run(string $command, array $args = []) {
    global $kernel;
    echo ">> php artisan {$command}\n";
    flush();
    $code = $kernel->call($command, $args);
    echo $kernel->output();
    echo "   Exit: {$code}\n\n";
    flush();
}

run('migrate', ['--force' => true]);
run('config:cache');
run('route:cache');
run('view:cache');
run('storage:link');

echo "=== Done ===\n";
echo "DELETE THIS FILE: https://api.c-codit.com/setup.php\n";
