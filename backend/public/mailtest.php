<?php
if (($_GET['t'] ?? '') !== 'go') { die('no'); }
header('Content-Type: text/plain');

$hosts = [
    ['mail.c-codit.com',        465],
    ['mail.c-codit.com',        587],
    ['mail.c-codit.com',         25],
    ['gr1.serverfoundation.com', 465],
    ['gr1.serverfoundation.com', 587],
    ['localhost',                 25],
    ['127.0.0.1',                 25],
];

echo "=== DNS lookup ===\n";
$ip = gethostbyname('mail.c-codit.com');
echo "mail.c-codit.com → " . ($ip !== 'mail.c-codit.com' ? $ip : 'FAILED (no DNS)') . "\n\n";

echo "=== Port connectivity ===\n";
foreach ($hosts as [$host, $port]) {
    $conn = @fsockopen($host, $port, $errno, $errstr, 5);
    $status = $conn ? 'OPEN' : "CLOSED ({$errstr})";
    if ($conn) fclose($conn);
    echo "{$host}:{$port} → {$status}\n";
}

echo "\n=== Server hostname ===\n";
echo gethostname() . "\n";
echo php_uname('n') . "\n";
