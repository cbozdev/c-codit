<?php
$key = $_GET['key'] ?? '';
if ($key !== 'ccodit-mail-2026') { http_response_code(403); die('Forbidden'); }

chdir(dirname(__DIR__));
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$to = $_GET['to'] ?? 'currensyboz@gmail.com';

echo '<pre>';
echo "Mailer:     " . config('mail.default') . "\n";
echo "Host:       " . config('mail.mailers.smtp.host') . "\n";
echo "Port:       " . config('mail.mailers.smtp.port') . "\n";
echo "Username:   " . config('mail.mailers.smtp.username') . "\n";
echo "Encryption: " . config('mail.mailers.smtp.encryption') . "\n";
echo "From:       " . config('mail.from.address') . "\n\n";

try {
    \Illuminate\Support\Facades\Mail::raw('This is a test email from C-codit.', function ($m) use ($to) {
        $m->to($to)->subject('C-codit Mail Test');
    });
    echo "SUCCESS — email sent to {$to}\n";
} catch (\Exception $e) {
    echo "FAILED: " . $e->getMessage() . "\n";
}
echo '</pre>';
