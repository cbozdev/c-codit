<?php
// Quick 5sim API diagnostic — shows raw response for /guest/prices?product=telegram
// Access: api.c-codit.com/fivesimtest.php?token=ccodit_gitfix_2025&product=telegram

if (($_GET['token'] ?? '') !== 'ccodit_gitfix_2025') {
    http_response_code(403); die('Forbidden.');
}

require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$apiKey  = config('services.fivesim.api_key');
$product = $_GET['product'] ?? 'telegram';
$baseUrl = 'https://5sim.net/v1';

if (!$apiKey) {
    die('FIVESIM_API_KEY not set in .env');
}

$ch = curl_init();
$url = $baseUrl . '/guest/prices?' . http_build_query(['product' => $product]);
curl_setopt_array($ch, [
    CURLOPT_URL            => $url,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_HTTPHEADER     => [
        'Authorization: Bearer ' . $apiKey,
        'Accept: application/json',
    ],
]);
$raw    = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err    = curl_error($ch);
curl_close($ch);

echo "URL: $url\n";
echo "HTTP Status: $status\n";

if ($err) {
    echo "cURL error: $err\n";
    exit;
}

$body = json_decode($raw, true);

if (!is_array($body)) {
    echo "Raw response (first 500 chars):\n";
    echo substr($raw, 0, 500) . "\n";
    exit;
}

$countryCount = count($body);
echo "Countries in response: $countryCount\n\n";

if ($countryCount === 0) {
    echo "Empty response — product code '$product' may be wrong or API key issue.\n";
    exit;
}

// Show first country's structure to diagnose format
$firstCountry = array_key_first($body);
$firstData    = $body[$firstCountry];
echo "=== First country: $firstCountry ===\n";
echo json_encode($firstData, JSON_PRETTY_PRINT) . "\n\n";

// Check if product level is present
if (isset($firstData[$product])) {
    echo "FORMAT: A — {country:{product:{operator:{cost,count}}}}\n";
    $ops = $firstData[$product];
} else {
    echo "FORMAT: B — {country:{operator:{cost,count}}} (product level stripped)\n";
    $ops = $firstData;
}

echo "Operators found: " . count($ops) . "\n";
echo "Sample: " . json_encode(array_slice($ops, 0, 2, true), JSON_PRETTY_PRINT) . "\n\n";

// Show total countries with available numbers
$withNumbers = 0;
foreach ($body as $cc => $data) {
    $ops = $data[$product] ?? $data;
    foreach ($ops as $info) {
        if (is_array($info) && isset($info['cost']) && $info['cost'] > 0 && ($info['count'] ?? 0) > 0) {
            $withNumbers++;
            break;
        }
    }
}
echo "Countries with available numbers: $withNumbers\n";
