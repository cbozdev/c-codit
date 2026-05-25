<?php
if (($_GET['t'] ?? '') !== 'go') { die('no'); }
header('Content-Type: text/plain');

$repo = '/home/ccoditco/c-codit';

echo "=== git status ===\n";
echo shell_exec("cd {$repo} && git status 2>&1");

echo "\n=== git diff --stat ===\n";
echo shell_exec("cd {$repo} && git diff --stat 2>&1");

echo "\n=== git stash list ===\n";
echo shell_exec("cd {$repo} && git stash list 2>&1");
