<?php
if (($_GET['t'] ?? '') !== 'go') { die('no'); }
header('Content-Type: text/plain');

$base = dirname(__DIR__);
require $base . '/vendor/autoload.php';
$app = require_once $base . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\ProxySubscription;
use Illuminate\Support\Facades\DB;

$fixed = 0;

ProxySubscription::whereNotNull('username')->get()->each(function ($sub) use (&$fixed) {
    $old = $sub->username;

    // Convert user-ACCOUNT-country-CC[-session-ID] → user.ACCOUNT.country-CC[.session-ID]
    // Pattern: user-{account}-country-{cc} or user-{account}-country-{cc}-session-{id}
    if (!preg_match('/^user-([^-]+(?:-[^-]+)*)-country-([a-z]{2})(-session-(.+))?$/', $old, $m)) {
        echo "SKIP (already correct or unknown format): {$old}\n";
        return;
    }

    $account = $m[1];
    $country  = $m[2];
    $session  = isset($m[4]) ? ".session-{$m[4]}" : '';
    $new      = "user.{$account}.country-{$country}{$session}";

    DB::table('proxy_subscriptions')->where('id', $sub->id)->update(['username' => $new]);
    echo "Fixed: {$old}\n  → {$new}\n";
    $fixed++;
});

echo "\nFixed {$fixed} subscription(s).\n";
