<?php
if (($_GET['t'] ?? '') !== 'go') { die('no'); }
header('Content-Type: text/plain');

$envPath = '/home/ccoditco/c-codit/backend/.env';
$env = file_get_contents($envPath);
if ($env === false) { die('Cannot read .env'); }

$replacements = [
    'MAIL_MAILER'       => 'smtp',
    'MAIL_HOST'         => 'mail.c-codit.com',
    'MAIL_PORT'         => '465',
    'MAIL_USERNAME'     => 'Info@c-codit.com',
    'MAIL_PASSWORD'     => 'YL)]hl((dU%z+GmU',
    'MAIL_ENCRYPTION'   => 'ssl',
    'MAIL_FROM_ADDRESS' => 'Info@c-codit.com',
    'MAIL_FROM_NAME'    => 'C-codit',
];

foreach ($replacements as $key => $value) {
    $escaped = addcslashes($value, '\\$');
    if (preg_match("/^{$key}=/m", $env)) {
        $env = preg_replace("/^{$key}=.*/m", "{$key}={$value}", $env);
        echo "Updated: {$key}\n";
    } else {
        $env .= "\n{$key}={$value}";
        echo "Added:   {$key}\n";
    }
}

file_put_contents($envPath, $env);

// Re-cache config
$php     = '/usr/local/bin/lsphp';
$artisan = '/home/ccoditco/c-codit/backend/artisan';
echo "\n";
echo shell_exec("{$php} {$artisan} config:cache 2>&1");
echo "\nDone.\n";
