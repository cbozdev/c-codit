<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        $services = [
            [
                'code'          => 'proxy_residential',
                'name'          => 'Residential Proxies',
                'provider'      => 'proxy_auto',
                'category'      => 'proxy',
                'description'   => 'Rotating, sticky, and static residential proxies from real devices. Supports HTTP, HTTPS, SOCKS5.',
                'is_active'     => true,
                'config'        => json_encode([
                    'proxy_type'   => 'residential',
                    'subtypes'     => ['rotating', 'sticky', 'static'],
                    'protocols'    => ['http', 'https', 'socks5'],
                    'bandwidths'   => [1, 5, 10, 25, 50, 100],  // GB
                    'price_per_gb' => 350,                        // cents — $3.50/GB
                    'trial_gb'     => 0.1,
                    'max_threads'  => 100,
                ]),
                'base_price_minor' => 350,
                'currency'      => 'USD',
                'markup_percent'=> 25.00,
                'created_at'    => now(),
                'updated_at'    => now(),
            ],
            [
                'code'          => 'proxy_datacenter',
                'name'          => 'Datacenter Proxies',
                'provider'      => 'proxy_auto',
                'category'      => 'proxy',
                'description'   => 'Shared and dedicated datacenter proxies. High speed, unlimited bandwidth.',
                'is_active'     => true,
                'config'        => json_encode([
                    'proxy_type'      => 'datacenter',
                    'subtypes'        => ['shared', 'dedicated'],
                    'protocols'       => ['http', 'https', 'socks5'],
                    'ip_packages'     => [10, 25, 50, 100, 250, 500],
                    'price_per_ip'    => 80,   // cents — $0.80/IP/month (shared)
                    'price_dedicated' => 200,  // cents — $2.00/IP/month (dedicated)
                    'max_threads'     => 500,
                ]),
                'base_price_minor' => 80,
                'currency'      => 'USD',
                'markup_percent'=> 30.00,
                'created_at'    => now(),
                'updated_at'    => now(),
            ],
            [
                'code'          => 'proxy_isp',
                'name'          => 'ISP Proxies',
                'provider'      => 'proxy_auto',
                'category'      => 'proxy',
                'description'   => 'Static ISP proxies on real ISP IPs. Best for long-running sessions.',
                'is_active'     => true,
                'config'        => json_encode([
                    'proxy_type'   => 'isp',
                    'subtypes'     => ['static', 'rotating'],
                    'protocols'    => ['http', 'https', 'socks5'],
                    'ip_packages'  => [5, 10, 25, 50, 100],
                    'price_per_ip' => 250,  // cents — $2.50/IP/month
                    'max_threads'  => 100,
                ]),
                'base_price_minor' => 250,
                'currency'      => 'USD',
                'markup_percent'=> 25.00,
                'created_at'    => now(),
                'updated_at'    => now(),
            ],
            [
                'code'          => 'proxy_mobile',
                'name'          => 'Mobile Proxies',
                'provider'      => 'proxy_auto',
                'category'      => 'proxy',
                'description'   => 'Rotating mobile proxies from real 4G/5G devices.',
                'is_active'     => true,
                'config'        => json_encode([
                    'proxy_type'   => 'mobile',
                    'subtypes'     => ['rotating'],
                    'protocols'    => ['http', 'https', 'socks5'],
                    'bandwidths'   => [1, 5, 10, 25, 50],
                    'price_per_gb' => 1200,  // cents — $12.00/GB
                    'max_threads'  => 50,
                ]),
                'base_price_minor' => 1200,
                'currency'      => 'USD',
                'markup_percent'=> 20.00,
                'created_at'    => now(),
                'updated_at'    => now(),
            ],
        ];

        DB::table('services')->insertOrIgnore($services);
    }

    public function down(): void
    {
        DB::table('services')->whereIn('code', [
            'proxy_residential', 'proxy_datacenter', 'proxy_isp', 'proxy_mobile',
        ])->delete();
    }
};
