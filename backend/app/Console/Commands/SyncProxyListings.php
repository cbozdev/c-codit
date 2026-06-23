<?php

namespace App\Console\Commands;

use App\Models\ProxyListing;
use App\Services\Proxy\DecodoService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class SyncProxyListings extends Command
{
    protected $signature   = 'proxy:sync-listings {--dry-run : Preview without saving}';
    protected $description = 'Sync proxy marketplace listings from Decodo API';

    private const DECODO_PROXY_LIST_URL = 'https://api.decodo.com/res/v2/proxy-list';

    public function handle(DecodoService $decodo): int
    {
        $apiKey = config('services.decodo.api_key');

        if (empty($apiKey)) {
            $this->error('DECODO_API_KEY not configured.');
            return self::FAILURE;
        }

        $this->info('Fetching proxy list from Decodo...');

        try {
            $res = Http::withHeaders(['Authorization' => $apiKey])
                ->timeout(30)
                ->get(self::DECODO_PROXY_LIST_URL, [
                    'limit'  => 5000,
                    'format' => 'json',
                ]);
        } catch (\Throwable $e) {
            $this->error('Request failed: ' . $e->getMessage());
            Log::error('proxy.sync_listings.request_failed', ['error' => $e->getMessage()]);
            return self::FAILURE;
        }

        if (! $res->successful()) {
            $this->error("Decodo API returned HTTP {$res->status()}: " . $res->body());
            Log::error('proxy.sync_listings.api_error', ['status' => $res->status(), 'body' => $res->body()]);
            return self::FAILURE;
        }

        $proxies = $res->json();

        if (! is_array($proxies) || empty($proxies)) {
            $this->warn('Decodo returned no proxy data. Response: ' . $res->body());
            return self::FAILURE;
        }

        $this->info('Received ' . count($proxies) . ' proxies. Building listings...');

        $rows = [];
        $now  = now()->toDateTimeString();

        foreach ($proxies as $proxy) {
            $ip          = $proxy['ip'] ?? $proxy['host'] ?? null;
            $countryCode = strtoupper($proxy['country_code'] ?? $proxy['country'] ?? '');
            $stateCode   = strtoupper($proxy['state_code'] ?? $proxy['state'] ?? '') ?: null;
            $city        = $proxy['city'] ?? null;
            $isp         = $proxy['isp'] ?? $proxy['provider'] ?? null;
            $type        = $proxy['type'] ?? $proxy['connection_type'] ?? 'wifi';
            $protocol    = $proxy['protocol'] ?? 'http';
            $speed       = (int) ($proxy['speed_ms'] ?? $proxy['ping'] ?? 120);

            if (! $ip || ! $countryCode) continue;

            // Mask last two octets for display
            $parts      = explode('.', $ip);
            $ipDisplay  = count($parts) === 4
                ? "{$parts[0]}.{$parts[1]}.xxx.xxx"
                : $ip;

            // Normalise connection type
            $connType = match (strtolower($type)) {
                'cellular', 'cell', 'mobile' => 'cell',
                default                       => 'wifi',
            };

            // Normalise protocol
            $proto = str_contains(strtolower($protocol), 'socks') ? 'socks5' : 'http';

            // Price in minor units (cents): wifi-http $7.20, wifi-socks $8.20, cell-http $9.70, cell-socks $11.70
            $priceMinor = match ("{$connType}-{$proto}") {
                'wifi-http'    => 7200,
                'wifi-socks5'  => 8200,
                'cell-http'    => 9700,
                'cell-socks5'  => 11700,
                default        => 9700,
            };

            // Country name
            $countryName = $proxy['country_name'] ?? $proxy['country_full'] ?? $countryCode;

            $rows[] = [
                'public_id'       => (string) Str::uuid(),
                'country_code'    => $countryCode,
                'country_name'    => $countryName,
                'state_code'      => $stateCode,
                'state_name'      => $proxy['state_name'] ?? null,
                'city'            => $city,
                'isp'             => $isp,
                'zip'             => $proxy['zip'] ?? null,
                'ip_display'      => $ipDisplay,
                'connection_type' => $connType,
                'protocol'        => $proto,
                'speed_ms'        => max(1, $speed),
                'price_minor'     => $priceMinor,
                'is_available'    => (bool) ($proxy['available'] ?? $proxy['is_available'] ?? true),
                'sort_order'      => 0,
                'created_at'      => $now,
                'updated_at'      => $now,
            ];
        }

        if (empty($rows)) {
            $this->warn('No valid listings parsed from Decodo response.');
            return self::FAILURE;
        }

        $this->info('Parsed ' . count($rows) . ' listings.');

        if ($this->option('dry-run')) {
            $this->table(['Country', 'State', 'City', 'ISP', 'Type', 'Protocol', 'IP'],
                collect($rows)->take(20)->map(fn($r) => [
                    $r['country_code'], $r['state_code'], $r['city'],
                    $r['isp'], $r['connection_type'], $r['protocol'], $r['ip_display'],
                ])->toArray()
            );
            $this->info('[dry-run] No changes saved.');
            return self::SUCCESS;
        }

        DB::transaction(function () use ($rows, $now) {
            DB::table('proxy_listings')->delete();

            $order = 0;
            foreach ($rows as &$row) {
                $row['sort_order'] = $order++;
            }

            foreach (array_chunk($rows, 200) as $chunk) {
                DB::table('proxy_listings')->insert($chunk);
            }
        });

        $this->info('Done. Inserted ' . count($rows) . ' listings.');
        Log::info('proxy.sync_listings.completed', ['count' => count($rows)]);

        return self::SUCCESS;
    }
}
