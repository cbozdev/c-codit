<?php
if (($_GET['t'] ?? '') !== 'go') { die('no'); }
header('Content-Type: text/plain');

$repo = '/home/ccoditco/c-codit';

echo "Resetting dirty file...\n";
echo shell_exec("cd {$repo} && git checkout -- backend/storage/app/.gitkeep 2>&1");

echo "\nGit status after reset:\n";
echo shell_exec("cd {$repo} && git status 2>&1");

echo "\nDone.\n";
