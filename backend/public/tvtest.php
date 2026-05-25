<?php
if (($_GET['token'] ?? '') !== 'ccodit_gitfix_2025') { http_response_code(403); die(); }
header('Content-Type: text/plain; charset=utf-8');

$base = '/home/ccoditco/c-codit/backend';

$envFile = "$base/.env";
$env = [];
foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
    if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) continue;
    [$k, $v] = explode('=', $line, 2);
    $env[trim($k)] = trim($v, " \t\n\r\0\x0B\"'");
}

$dbHost = $env['DB_HOST'] ?? '127.0.0.1';
$dbPort = $env['DB_PORT'] ?? 3306;
$dbName = $env['DB_DATABASE'] ?? '';
$dbUser = $env['DB_USERNAME'] ?? '';
$dbPass = $env['DB_PASSWORD'] ?? '';

try {
    $pdo = new PDO("mysql:host=$dbHost;port=$dbPort;dbname=$dbName", $dbUser, $dbPass);
    $tvRows = $pdo->query("SELECT `key`, LEFT(value,80) as val FROM service_configs WHERE `group`='textverified'")->fetchAll(PDO::FETCH_ASSOC);
    $decodoRows = $pdo->query("SELECT `key`, value FROM service_configs WHERE `group`='decodo'")->fetchAll(PDO::FETCH_ASSOC);
} catch (Exception $e) {
    die("DB error: " . $e->getMessage() . "\n");
}

$tvConf = array_column($tvRows, 'val', 'key');
$apiKey = $tvConf['api_key'] ?? '';

$decodoUser = $env['DECODO_USERNAME'] ?? '';
$decodoPass = $env['DECODO_PASSWORD'] ?? '';
foreach ($decodoRows as $r) {
    if ($r['key'] === 'username' && !$decodoUser) $decodoUser = $r['value'];
    if ($r['key'] === 'password' && !$decodoPass) $decodoPass = $r['value'];
}

// Plaintext overrides
if ($_GET['decodopass'] ?? '') $decodoPass = $_GET['decodopass'];
if ($_GET['decodouser'] ?? '') $decodoUser = $_GET['decodouser'];

echo "API Key: " . ($apiKey ? substr($apiKey,0,6).'...'.substr($apiKey,-4) : '(not set)') . "\n";
echo "Decodo User: " . ($decodoUser ?: '(not set)') . "\n";
echo "Decodo Pass: " . ($decodoPass ? substr($decodoPass,0,4).'...' : '(not set)') . "\n\n";

// ── Port reachability test ────────────────────────────────────────────────
echo "=== Port reachability from this server ===\n";
$tests = [
    ['gate.decodo.com',     7777],
    ['gate.decodo.com',    10000],
    ['gate.decodo.com',      443],
    ['gate.decodo.com',       80],
    ['www.textverified.com', 443],
];
$workingDecodoPort = null;
foreach ($tests as [$host, $port]) {
    $t0   = microtime(true);
    $sock = @fsockopen($host, $port, $errNo, $errStr, 5);
    $ms   = round((microtime(true) - $t0) * 1000);
    if ($sock) {
        fclose($sock);
        echo "  $host:$port → OPEN ({$ms}ms)\n";
        if ($host === 'gate.decodo.com' && !$workingDecodoPort) $workingDecodoPort = $port;
    } else {
        echo "  $host:$port → BLOCKED/TIMEOUT ({$ms}ms) — $errStr\n";
    }
}
echo "\n";

// ── Test 1: Direct auth ──────────────────────────────────────────────────
echo "=== Test 1: Direct auth (no proxy) ===\n";
$ch = curl_init('https://www.textverified.com/api/pub/v2/auth');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER=>true, CURLOPT_TIMEOUT=>10, CURLOPT_POST=>true,
    CURLOPT_HTTPHEADER=>['X-SIMPLEAPI-APPLICATION-KEY: '.$apiKey, 'Accept: application/json', 'Content-Type: application/json'],
    CURLOPT_POSTFIELDS=>'',
]);
$b1 = curl_exec($ch); $e1 = curl_error($ch); $s1 = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
echo "Status: $s1" . ($e1 ? " | cURL: $e1" : '') . "\n";
echo str_contains($b1,'Cloudflare') ? "→ BLOCKED by Cloudflare\n\n" : "→ ".substr($b1,0,200)."\n\n";

// ── Test 2: Decodo residential proxy ────────────────────────────────────
echo "=== Test 2: Decodo residential proxy ===\n";
if ($decodoUser && $decodoPass && $workingDecodoPort) {
    echo "Using port: $workingDecodoPort\n";
    $ch = curl_init('https://www.textverified.com/api/pub/v2/auth');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER=>true, CURLOPT_TIMEOUT=>20, CURLOPT_POST=>true,
        CURLOPT_PROXY=>"gate.decodo.com:{$workingDecodoPort}",
        CURLOPT_PROXYUSERPWD=>"$decodoUser:$decodoPass",
        CURLOPT_HTTPHEADER=>['X-SIMPLEAPI-APPLICATION-KEY: '.$apiKey, 'Accept: application/json', 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS=>'',
    ]);
    $b2 = curl_exec($ch); $e2 = curl_error($ch); $s2 = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    echo "Status: $s2" . ($e2 ? " | cURL: $e2" : '') . "\n";
    echo str_contains($b2,'Cloudflare') ? "→ Decodo ALSO blocked by Cloudflare\n\n" : "→ ".substr($b2,0,300)."\n\n";
} elseif (!$workingDecodoPort) {
    echo "SKIP — no Decodo port is reachable from this server\n";
    echo "This confirms the cPanel firewall blocks outbound proxy connections.\n\n";
} else {
    echo "SKIP — no Decodo credentials\n\n";
}

// ── Test 3: Try each Decodo port explicitly ──────────────────────────────
if ($decodoUser && $decodoPass) {
    echo "=== Test 3: Try each Decodo port explicitly ===\n";
    foreach ([7777, 10000, 443, 80] as $port) {
        $ch = curl_init('https://www.textverified.com/api/pub/v2/auth');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER=>true, CURLOPT_TIMEOUT=>8, CURLOPT_POST=>true,
            CURLOPT_PROXY=>"gate.decodo.com:{$port}",
            CURLOPT_PROXYUSERPWD=>"$decodoUser:$decodoPass",
            CURLOPT_HTTPHEADER=>['X-SIMPLEAPI-APPLICATION-KEY: '.$apiKey, 'Accept: application/json', 'Content-Type: application/json'],
            CURLOPT_POSTFIELDS=>'',
        ]);
        $b = curl_exec($ch); $e = curl_error($ch); $s = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $result = $e ? "FAIL: $e" : ($s . " " . substr($b,0,80));
        echo "  Port $port → $result\n";
    }
    echo "\n";
}
