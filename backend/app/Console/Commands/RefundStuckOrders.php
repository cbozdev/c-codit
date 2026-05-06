<?php

namespace App\Console\Commands;

use App\Models\ServiceOrder;
use App\Models\Transaction;
use App\Services\Wallet\WalletService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RefundStuckOrders extends Command
{
    protected $signature   = 'orders:refund-stuck {--service= : Filter by service code} {--dry-run : Preview without making changes}';
    protected $description = 'Refund orders stuck in provisioning/pending with no successful provider response';

    public function handle(WalletService $wallets): int
    {
        $query = ServiceOrder::whereIn('status', ['provisioning', 'pending'])
            ->where('created_at', '<', now()->subMinutes(10));

        if ($service = $this->option('service')) {
            $query->whereHas('service', fn ($q) => $q->where('code', $service));
        }

        $orders = $query->with(['service', 'transaction'])->get();

        if ($orders->isEmpty()) {
            $this->info('No stuck orders found.');
            return 0;
        }

        $this->table(
            ['ID', 'Public ID', 'Service', 'Status', 'Amount', 'Created'],
            $orders->map(fn ($o) => [
                $o->id,
                $o->public_id,
                $o->service->code ?? '?',
                $o->status,
                '$'.number_format($o->amount_minor / 100, 2),
                $o->created_at->toDateTimeString(),
            ])
        );

        if ($this->option('dry-run')) {
            $this->warn('Dry run — no changes made.');
            return 0;
        }

        if (! $this->confirm("Refund {$orders->count()} order(s)?")) {
            return 0;
        }

        $refunded = 0;
        $failed   = 0;

        foreach ($orders as $order) {
            try {
                $holdTx = $order->transaction;

                if (! $holdTx) {
                    $this->warn("Order {$order->public_id}: no transaction found, skipping.");
                    $failed++;
                    continue;
                }

                if (! in_array($holdTx->status, ['processing', 'failed'], true)) {
                    $this->warn("Order {$order->public_id}: transaction status is '{$holdTx->status}', skipping.");
                    $failed++;
                    continue;
                }

                DB::transaction(function () use ($order, $holdTx, $wallets) {
                    $wallets->refundSuspense(
                        $holdTx,
                        'svcrefund:'.$order->public_id,
                        'Provider failed — order stuck in provisioning',
                    );
                    $order->update([
                        'status'         => 'refunded',
                        'failure_reason' => 'Order stuck in provisioning — auto-refunded',
                        'refunded_at'    => now(),
                    ]);
                });

                $this->info("Refunded {$order->public_id}");
                $refunded++;
            } catch (\Throwable $e) {
                $this->error("Order {$order->public_id}: {$e->getMessage()}");
                $failed++;
            }
        }

        $this->info("Done. Refunded: {$refunded}, Failed: {$failed}");
        return $failed > 0 ? 1 : 0;
    }
}
