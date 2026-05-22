<?php
if (($_GET['token'] ?? '') !== 'ccodit_gitfix_2025') {
    http_response_code(403); die('Forbidden.');
}
header('Content-Type: text/plain; charset=utf-8');

$logDir = '/home/ccoditco/c-codit/backend/storage/logs';
$filter = $_GET['filter'] ?? '';
$lines  = (int) ($_GET['lines'] ?? 150);

// Pick the newest log file
$newest = null; $newestTime = 0;
foreach (scandir($logDir) as $f) {
    if (! str_ends_with($f, '.log')) continue;
    $fp = "$logDir/$f";
    if (filemtime($fp) > $newestTime) { $newestTime = filemtime($fp); $newest = $fp; }
}

if (! $newest) { die("No log files found in $logDir\n"); }

echo "Reading: $newest\n\n";

$all = file($newest, FILE_IGNORE_NEW_LINES);
$all = array_reverse($all);
$out = [];
foreach ($all as $line) {
    if ($filter === '' || stripos($line, $filter) !== false) {
        $out[] = $line;
        if (count($out) >= $lines) break;
    }
}
echo implode("\n", array_reverse($out)) . "\n";
