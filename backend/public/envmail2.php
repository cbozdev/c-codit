<?php
if (($_GET['t'] ?? '') !== 'go') { die('no'); }
header('Content-Type: text/plain');

$envPath = '/home/ccoditco/c-codit/backend/.env';
$env = file_get_contents($envPath);
if ($env === false) { die('Cannot read .env'); }

// mail.c-codit.com is behind Cloudflare which blocks SMTP.
// gr1.serverfoundation.com:465 is the actual reachable mail server.
$replacements = [
    'MAIL_HOST'       => 'gr1.serverfoundation.com',
    'MAIL_PORT'       => '465',
    'MAIL_ENCRYPTION' => 'ssl',
];

foreach ($replacements as $key => $value) {
    $env = preg_replace("/^{$key}=.*/m", "{$key}={$value}", $env);
    echo "Updated: {$key}={$value}\n";
}

file_put_contents($envPath, $env);

$php     = '/usr/local/bin/lsphp';
$artisan = '/home/ccoditco/c-codit/backend/artisan';
echo "\n";
echo shell_exec("{$php} {$artisan} config:cache 2>&1");

// Quick send test
echo "\n=== Test send ===\n";
require dirname(__DIR__) . '/vendor/autoload.php';
$app = require_once dirname(__DIR__) . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

try {
    Illuminate\Support\Facades\Mail::raw('Mail config test from C-codit', function($m) {
        $m->to('currensyboz@gmail.com')->subject('C-codit mail test');
    });
    echo "Test email sent successfully.\n";
} catch (\Throwable $e) {
    echo "Send failed: " . $e->getMessage() . "\n";
}

echo "\nDone.\n";
