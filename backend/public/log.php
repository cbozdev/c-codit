<?php
if(($_GET['t']??'')!=='go'){die('no');}
header('Content-Type: text/plain; charset=utf-8');

$base = dirname(__DIR__);
require $base.'/vendor/autoload.php';
$app = require_once $base.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$key      = config('services.decodo.api_key');
$email    = config('services.decodo.email', '');    // may not exist
$password = config('services.decodo.password', ''); // may not exist

echo "Key prefix: ".substr($key,0,12)."...\n";
echo "Email in config: ".($email ? $email : 'not set')."\n\n";

function hit(string $method, string $url, array $opts): void {
    $ch = curl_init($url);
    curl_setopt_array($ch, array_merge([
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_CUSTOMREQUEST  => $method,
    ], $opts));
    $resp   = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    echo "[$status] ".substr($resp, 0, 300)."\n\n";
}

$url = 'https://api.decodo.com/v2/sub-users';

echo "--- Token header ---\n";
hit('GET', $url, [CURLOPT_HTTPHEADER => ['Authorization: Token '.$key, 'Accept: application/json']]);

echo "--- Bearer header ---\n";
hit('GET', $url, [CURLOPT_HTTPHEADER => ['Authorization: Bearer '.$key, 'Accept: application/json']]);

// Try with your Decodo account email + API key as Basic auth
if ($email) {
    echo "--- Basic auth (email:key) ---\n";
    hit('GET', $url, [CURLOPT_USERPWD => "$email:$key", CURLOPT_HTTPHEADER => ['Accept: application/json']]);
}

echo "--- Try /v2/ root ---\n";
hit('GET', 'https://api.decodo.com/v2/', [CURLOPT_HTTPHEADER => ['Authorization: Token '.$key, 'Accept: application/json']]);

echo "--- Try /v2/account ---\n";
hit('GET', 'https://api.decodo.com/v2/account', [CURLOPT_HTTPHEADER => ['Authorization: Token '.$key, 'Accept: application/json']]);
