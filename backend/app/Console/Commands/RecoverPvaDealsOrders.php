<?php

namespace App\Console\Commands;

use App\Models\ServiceOrder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * One-time command to recover PvaDeals LTR orders that got stuck in
 * 'provisioning' status due to the missing-$country closure bug (fixed 2026-07-12).
 *
 * PvaDeals data fetched via MCP on 2026-07-12; numbers expire 2026-07-14.
 */
class RecoverPvaDealsOrders extends Command
{
    protected $signature   = 'pvadeals:recover-stuck-orders {--dry-run : Preview without saving}';
    protected $description = 'Recover stuck LTR provisioning orders from the 2026-07-12 closure bug';

    // PvaDeals data confirmed via MCP list_active_numbers + check_sms
    private array $numbers = [
        [
            'provider_order_id' => '6a52d1719fda754b85c70e0f',
            'phone'             => '+18283754165',
            'code'              => '966-400',
            'created_around'    => '2026-07-11 23:27',
            'expires_at'        => '2026-07-14T23:27:45.993Z',
        ],
        [
            'provider_order_id' => '6a52d625e9a8314c793ad60e',
            'phone'             => '+18102884596',
            'code'              => '283-623',
            'created_around'    => '2026-07-11 23:47',
            'expires_at'        => '2026-07-14T23:47:49.557Z',
        ],
        [
            'provider_order_id' => '6a52d7c31606e4835f0afea5',
            'phone'             => '+15737970100',
            'code'              => '205-137',
            'created_around'    => '2026-07-11 23:54',
            'expires_at'        => '2026-07-14T23:54:43.809Z',
        ],
        [
            'provider_order_id' => '6a52d88ce9a8314c793ad9ee',
            'phone'             => '+14709969430',
            'code'              => '195-368',
            'created_around'    => '2026-07-11 23:58',
            'expires_at'        => '2026-07-14T23:58:04.812Z',
        ],
    ];

    public function handle(): int
    {
        $dryRun = $this->option('dry-run');

        // Find ALL pvadeals LTR orders stuck in provisioning
        $stuck = ServiceOrder::where('provider', 'pvadeals')
            ->where('status', 'provisioning')
            ->whereNull('provider_order_id')
            ->orderBy('created_at')
            ->get();

        if ($stuck->isEmpty()) {
            $this->info('No stuck pvadeals provisioning orders found.');
            return 0;
        }

        $this->info("Found {$stuck->count()} stuck order(s). Have {$this->count()} PvaDeals number(s) to match.");
        $this->newLine();

        if ($stuck->count() !== count($this->numbers)) {
            $this->warn("Count mismatch — will match by index (oldest order → earliest number).");
        }

        $pairs = $stuck->values()->zip(collect($this->numbers));

        foreach ($pairs as $i => [$order, $pva]) {
            if (! $order || ! $pva) {
                $this->warn("Skipping pair $i — no match available.");
                continue;
            }

            $this->line("Order #{$order->public_id} created {$order->created_at}");
            $this->line("  → Phone:  {$pva['phone']}");
            $this->line("  → PvaID:  {$pva['provider_order_id']}");
            $this->line("  → Code:   {$pva['code']}");
            $this->line("  → Expires:{$pva['expires_at']}");

            if ($dryRun) {
                $this->line("  [DRY RUN — skipping save]");
                $this->newLine();
                continue;
            }

            try {
                DB::transaction(function () use ($order, $pva) {
                    $delivery = array_merge((array) ($order->delivery ?? []), [
                        'phone_number'  => $pva['phone'],
                        'number_type'   => 'LTR',
                        'sms_code'      => $pva['code'],
                        'sms_text'      => 'Your WhatsApp Business code ' . $pva['code'],
                        'expires_at'    => $pva['expires_at'],
                        'recovered_by'  => 'pvadeals:recover-stuck-orders',
                    ]);

                    // Settle wallet suspense if transaction is still processing
                    if ($order->transaction && $order->transaction->status->value === 'processing') {
                        app(\App\Services\WalletService::class)
                            ->settleSuspense($order->transaction, 'svcsettle:' . $order->public_id);
                    }

                    $order->update([
                        'status'            => 'completed',
                        'provider_order_id' => $pva['provider_order_id'],
                        'delivery'          => $delivery,
                        'provisioned_at'    => now(),
                    ]);
                });

                $this->info("  ✓ Recovered");
                Log::info('pvadeals.recover_stuck.success', [
                    'order'   => $order->public_id,
                    'phone'   => $pva['phone'],
                    'pva_id'  => $pva['provider_order_id'],
                ]);
            } catch (\Throwable $e) {
                $this->error("  ✗ Failed: " . $e->getMessage());
                Log::error('pvadeals.recover_stuck.error', [
                    'order' => $order->public_id,
                    'error' => $e->getMessage(),
                ]);
            }

            $this->newLine();
        }

        return 0;
    }

    private function count(): int
    {
        return count($this->numbers);
    }
}
