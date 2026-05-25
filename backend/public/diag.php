<?php
if (($_GET['token'] ?? '') !== 'ccodit_gitfix_2025') { http_response_code(403); die(); }
header('Content-Type: text/plain; charset=utf-8');

$logDir = '/home/ccoditco/c-codit/backend/storage/logs';

// Find newest log
$newest = null; $newestTime = 0;
foreach (scandir($logDir) as $f) {
    if (!str_ends_with($f, '.log')) continue;
    $fp = "$logDir/$f";
    if (filemtime($fp) > $newestTime) { $newestTime = filemtime($fp); $newest = $fp; }
}

if (!$newest) { die("No log files found.\n"); }
echo "Log: $newest\n\n";

$filter = $_GET['filter'] ?? 'ERROR';
$lines  = (int) ($_GET['lines'] ?? 50);

$all = array_reverse(file($newest, FILE_IGNORE_NEW_LINES));
$out = [];
foreach ($all as $line) {
    if ($filter === '' || stripos($line, $filter) !== false) {
        $out[] = $line;
        if (count($out) >= $lines) break;
    }
}
echo implode("\n", array_reverse($out)) . "\n";
