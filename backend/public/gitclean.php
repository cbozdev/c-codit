<?php
$key = $_GET['key'] ?? '';
if ($key !== 'ccodit-git-2026') { http_response_code(403); die('Forbidden'); }

$repo = dirname(__DIR__, 2); // /home/ccoditco/c-codit
echo '<pre>';
echo "Repo: $repo\n\n";

// Show current status
exec("cd $repo && git status 2>&1", $out1);
echo "Status before:\n" . implode("\n", $out1) . "\n\n";

// Reset tracked files, remove untracked (keep .env safe — it's gitignored)
exec("cd $repo && git checkout -- . 2>&1", $out2);
exec("cd $repo && git clean -fd 2>&1", $out3);

echo "Checkout: " . implode("\n", $out2) . "\n";
echo "Clean:    " . implode("\n", $out3) . "\n\n";

// Status after
exec("cd $repo && git status 2>&1", $out4);
echo "Status after:\n" . implode("\n", $out4) . "\n";
echo '</pre>';
