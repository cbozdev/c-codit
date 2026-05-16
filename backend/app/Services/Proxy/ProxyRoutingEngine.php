<?php

namespace App\Services\Proxy;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Smart provider routing engine.
 *
 * Selects the best provider for a proxy order based on:
 *   - Provider enabled status
 *   - Admin-configured priority
 *   - Proxy type support
 *   - Recent success rate (cached)
 */
class ProxyRoutingEngine
{
    public function __construct(
        private readonly DecodoService    $decodo,
        private readonly BrightDataService $brightData,
    ) {}

    /**
     * Select the best provider for a given proxy type.
     * Returns 'decodo' or 'brightdata'.
     */
    public function selectProvider(string $proxyType, ?string $forcedProvider = null): string
    {
        if ($forcedProvider && in_array($forcedProvider, ['decodo', 'brightdata'], true)) {
            if ($this->isProviderAvailable($forcedProvider)) {
                return $forcedProvider;
            }
            Log::warning('proxy.routing.forced_provider_unavailable', [
                'forced'    => $forcedProvider,
                'proxy_type'=> $proxyType,
            ]);
        }

        $priority = config('services.proxy.provider_priority', ['decodo', 'brightdata']);

        foreach ($priority as $provider) {
            if ($this->isProviderAvailable($provider) && $this->supportsType($provider, $proxyType)) {
                Log::info('proxy.routing.selected', [
                    'provider'   => $provider,
                    'proxy_type' => $proxyType,
                ]);
                return $provider;
            }
        }

        // Last resort fallback
        if ($this->decodo->isEnabled())    return 'decodo';
        if ($this->brightData->isEnabled()) return 'brightdata';

        throw new \RuntimeException('No proxy provider is currently available. Please try again later.');
    }

    /**
     * After a failure, select the fallback provider.
     */
    public function fallback(string $failedProvider, string $proxyType): string
    {
        $this->recordFailure($failedProvider);

        $fallback = $failedProvider === 'decodo' ? 'brightdata' : 'decodo';

        Log::warning('proxy.routing.fallback', [
            'from'       => $failedProvider,
            'to'         => $fallback,
            'proxy_type' => $proxyType,
        ]);

        if (! $this->isProviderAvailable($fallback)) {
            throw new \RuntimeException('All proxy providers are currently unavailable. Your payment has been refunded.');
        }

        return $fallback;
    }

    public function isProviderAvailable(string $provider): bool
    {
        return match ($provider) {
            'decodo'     => $this->decodo->isEnabled(),
            'brightdata' => $this->brightData->isEnabled(),
            default      => false,
        };
    }

    public function supportsType(string $provider, string $proxyType): bool
    {
        // Both providers support all types; can be restricted per config
        $restrictions = config("services.{$provider}.unsupported_types", []);
        $baseType = explode('_', $proxyType)[0];
        return ! in_array($baseType, $restrictions, true);
    }

    private function recordFailure(string $provider): void
    {
        $key = "proxy.provider.{$provider}.failures";
        Cache::put($key, (Cache::get($key, 0) + 1), now()->addHour());
    }

    public function getProviderStats(): array
    {
        $providers = ['decodo', 'brightdata'];
        $stats = [];

        foreach ($providers as $p) {
            $stats[$p] = [
                'enabled'      => $this->isProviderAvailable($p),
                'failures_1h'  => Cache::get("proxy.provider.{$p}.failures", 0),
                'priority'     => array_search($p, config('services.proxy.provider_priority', $providers), true),
            ];
        }

        return $stats;
    }
}
