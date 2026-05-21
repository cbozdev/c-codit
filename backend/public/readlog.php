<?php
if (($_GET['token'] ?? '') !== 'ccodit_gitfix_2025') {
    http_response_code(403); die('Forbidden.');
}
header('Content-Type: text/plain; charset=utf-8');

$logFile = dirname(__DIR__) . '/storage/logs/laravel.log';

if (! file_exists($logFile)) {
    die("Log file not found: $logFile\n");
}

$lines  = (int) ($_GET['lines'] ?? 100);
$filter = $_GET['filter'] ?? '';

$all = file($logFile, FILE_IGNORE_NEW_LINES);
$all = array_reverse($all); // newest first

$out = [];
foreach ($all as $line) {
    if ($filter === '' || stripos($line, $filter) !== false) {
        $out[] = $line;
        if (count($out) >= $lines) break;
    }
}

echo implode("\n", array_reverse($out)) . "\n";
