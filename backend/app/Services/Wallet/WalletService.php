<?php

namespace App\Services\Wallet;

use App\Enums\LedgerDirection;
use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Services\Ledger\ChartOfAccounts;
use App\Services\Ledger\InsufficientFundsException;
use App\Services\Ledger\JournalLeg;
use App\Services\Ledger\LedgerService;
use App\Support\Audit;
use App\Support\Money;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Wallet operations. All money movement is recorded via LedgerService; the
 * `wallets.balance_minor` column is a denormalised cache kept in sync inside
 * the same DB transaction as the ledger write.
 *
 * All public methods are idempotent via the provided idempotency key.
 */
class WalletService
{
    public function __construct(
        private readonly LedgerService $ledger,
        private readonly ChartOfAccounts $coa,
    ) {}

    /**
     * Credit a user's wallet from a verified external payment.
     * DEBIT  cash.<provider>   (asset ↑)
     * CREDIT user.wallet.<id>  (liability ↑)
     */
    public function fundFromPayment(
        Wallet $wallet,
        Money $amount,
        string $cashAccountCode,
        string $idempotencyKey,
        ?Model $reference = null,
        ?string $description = null,
    ): Transaction {
        return DB::transaction(function () use ($wallet, $amount, $cashAccountCode, $idempotencyKey, $reference, $description) {
            if ($existing = Transaction::where('idempotency_key', $idempotencyKey)->first()) {
                return $existing;
            }

            $locked = Wallet::whereKey($wallet->id)->lockForUpdate()->firstOrFail();
            $this->assertUsable($locked);

            $maxBalance = (int) config('services.platform.wallet_max_balance') * 100;
            if ($locked->balance_minor + $amount->amountMinor > $maxBalance) {
                throw new RuntimeException('Wallet maximum balance exceeded.');
            }

            $cash   = $this->coa->system($cashAccountCode, $locked->currency);
            $walletAcct = $this->coa->userWallet($locked);

            $journalId = $this->ledger->post(
                legs: [
                    new JournalLeg($cash->id,       LedgerDirection::DEBIT,  $amount, 'Wallet funding'),
                    new JournalLeg($walletAcct->id, LedgerDirection::CREDIT, $amount, 'Wallet funding'),
                ],
                idempotencyKey: 'wallet_fund:'.$idempotencyKey,
                reference: $reference,
                memo: $description ?? 'Wallet funding',
            );

            $locked->increment('balance_minor', $amount->amountMinor);
            $locked->increment('version');

            $tx = Transaction::create([
                'user_id'         => $locked->user_id,
                'wallet_id'       => $locked->id,
                'type'            => TransactionType::WALLET_FUNDING->value,
                'status'          => TransactionStatus::SUCCESS->value,
                'amount_minor'    => $amount->amountMinor,
                'currency'        => $amount->currency,
                'description'     => $description ?? 'Wallet funding',
                'journal_id'      => $journalId,
                'related_type'    => $reference?->getMorphClass(),
                'related_id'      => $reference?->getKey(),
                'idempotency_key' => $idempotencyKey,
                'completed_at'    => now(),
            ]);

            Audit::log('wallet.funded', $tx, [
                'amount_minor' => $amount->amountMinor,
                'currency'     => $amount->currency,
                'provider'     => $cashAccountCode,
            ]);

            return $tx;
        });
    }

    /**
     * Debit the wallet and park funds in suspense until the service delivers.
     * DEBIT  user.wallet  (liability ↓ — we owe the user less)
     * CREDIT suspense     (asset ↓  — suspense holds a negative balance pending delivery)
     */
    public function holdForPurchase(
        Wallet $wallet,
        Money $amount,
        string $idempotencyKey,
        ?Model $reference = null,
        ?string $description = null,
    ): Transaction {
        return DB::transaction(function () use ($wallet, $amount, $idempotencyKey, $reference, $description) {
            if ($existing = Transaction::where('idempotency_key', $idempotencyKey)->first()) {
                return $existing;
            }

            $locked = Wallet::whereKey($wallet->id)->lockForUpdate()->firstOrFail();
            $this->assertUsable($locked);
            $this->assertDailyDebitLimit($locked, $amount);

            if ($locked->balance_minor < $amount->amountMinor) {
                throw new InsufficientFundsException('Insufficient wallet balance.');
            }

            $walletAcct = $this->coa->userWallet($locked);
            $suspense   = $this->coa->system(ChartOfAccounts::SUSPENSE, $locked->currency);

            $journalId = $this->ledger->post(
                legs: [
                    new JournalLeg($walletAcct->id, LedgerDirection::DEBIT,  $amount, 'Purchase hold'),
                    new JournalLeg($suspense->id,   LedgerDirection::CREDIT, $amount, 'Purchase hold'),
                ],
                idempotencyKey: 'wallet_hold:'.$idempotencyKey,
                reference: $reference,
                memo: $description ?? 'Service purchase hold',
            );

            $locked->decrement('balance_minor', $amount->amountMinor);
            $locked->increment('version');

            $tx = Transaction::create([
                'user_id'         => $locked->user_id,
                'wallet_id'       => $locked->id,
                'type'            => TransactionType::SERVICE_PURCHASE->value,
                'status'          => TransactionStatus::PROCESSING->value,
                'amount_minor'    => $amount->amountMinor,
                'currency'        => $amount->currency,
                'description'     => $description ?? 'Service purchase',
                'journal_id'      => $journalId,
                'related_type'    => $reference?->getMorphClass(),
                'related_id'      => $reference?->getKey(),
                'idempotency_key' => $idempotencyKey,
            ]);

            Audit::log('wallet.held_for_purchase', $tx, ['amount_minor' => $amount->amountMinor]);

            return $tx;
        });
    }

    /**
     * Service delivered. Move suspense to revenue.
     * DEBIT  suspense          (asset ↑ back to 0)
     * CREDIT revenue.markup    (revenue ↑)
     */
    public function settleSuspense(Transaction $holdTx, string $idempotencyKey): Transaction
    {
        return DB::transaction(function () use ($holdTx, $idempotencyKey) {
            $holdTx->refresh();
            if ($holdTx->status !== TransactionStatus::PROCESSING) return $holdTx;

            Wallet::whereKey($holdTx->wallet_id)->lockForUpdate()->firstOrFail();

            $suspense = $this->coa->system(ChartOfAccounts::SUSPENSE, $holdTx->currency);
            $revenue  = $this->coa->system(ChartOfAccounts::REVENUE_MARKUP, $holdTx->currency);
            $amount   = Money::minor($holdTx->amount_minor, $holdTx->currency);

            $this->ledger->post(
                legs: [
                    new JournalLeg($suspense->id, LedgerDirection::DEBIT,  $amount, 'Settle purchase'),
                    new JournalLeg($revenue->id,  LedgerDirection::CREDIT, $amount, 'Revenue recognition'),
                ],
                idempotencyKey: 'wallet_settle:'.$idempotencyKey,
                reference: $holdTx,
                memo: 'Service delivered - suspense settled',
            );

            $holdTx->update([
                'status'       => TransactionStatus::SUCCESS->value,
                'completed_at' => now(),
            ]);

            Audit::log('wallet.purchase_settled', $holdTx);
            return $holdTx;
        });
    }

    /**
     * Service failed. Return held funds to user's wallet.
     * DEBIT  suspense       (asset ↑ back to 0)
     * CREDIT user.wallet    (liability ↑ — we owe the user again)
     */
    public function refundSuspense(Transaction $holdTx, string $idempotencyKey, ?string $reason = null): Transaction
    {
        return DB::transaction(function () use ($holdTx, $idempotencyKey, $reason) {
            $holdTx->refresh();
            if ($holdTx->status === TransactionStatus::REFUNDED) return $holdTx;
            if (! in_array($holdTx->status, [TransactionStatus::PROCESSING, TransactionStatus::FAILED], true)) {
                throw new RuntimeException('Only processing/failed transactions can be refunded.');
            }

            $locked = Wallet::whereKey($holdTx->wallet_id)->lockForUpdate()->firstOrFail();
            $amount = Money::minor($holdTx->amount_minor, $holdTx->currency);

            $walletAcct = $this->coa->userWallet($locked);
            $suspense   = $this->coa->system(ChartOfAccounts::SUSPENSE, $locked->currency);

            $journalId = $this->ledger->post(
                legs: [
                    new JournalLeg($suspense->id,   LedgerDirection::DEBIT,  $amount, 'Refund — suspense'),
                    new JournalLeg($walletAcct->id, LedgerDirection::CREDIT, $amount, 'Refund — wallet'),
                ],
                idempotencyKey: 'wallet_refund:'.$idempotencyKey,
                reference: $holdTx,
                memo: 'Service failed — wallet refund',
            );

            $locked->increment('balance_minor', $amount->amountMinor);
            $locked->increment('version');

            $refundTx = Transaction::create([
                'user_id'               => $locked->user_id,
                'wallet_id'             => $locked->id,
                'type'                  => TransactionType::REFUND->value,
                'status'                => TransactionStatus::SUCCESS->value,
                'amount_minor'          => $amount->amountMinor,
                'currency'              => $amount->currency,
                'description'           => $reason ?? 'Service failed',
                'journal_id'            => $journalId,
                'related_type'          => $holdTx->related_type,
                'related_id'            => $holdTx->related_id,
                'parent_transaction_id' => $holdTx->id,
                'idempotency_key'       => $idempotencyKey,
                'completed_at'          => now(),
            ]);

            $holdTx->update([
                'status'         => TransactionStatus::REFUNDED->value,
                'failed_at'      => now(),
                'failure_reason' => $reason,
            ]);

            Audit::log('wallet.refunded', $refundTx, [
                'hold_tx_id' => $holdTx->id,
                'reason'     => $reason,
            ]);

            return $refundTx;
        });
    }

    public function getOrCreate(User $user, string $currency = 'USD'): Wallet
    {
        return Wallet::firstOrCreate(['user_id' => $user->id], ['currency' => $currency]);
    }

    private function assertUsable(Wallet $w): void
    {
        if ($w->is_frozen) {
            throw new RuntimeException('Wallet is frozen: '.$w->frozen_reason);
        }
    }

    private function assertDailyDebitLimit(Wallet $w, Money $amount): void
    {
        $limit = (int) config('services.platform.daily_debit_limit') * 100;
        if ($limit <= 0) return;

        $spent = (int) Transaction::where('wallet_id', $w->id)
            ->where('type', TransactionType::SERVICE_PURCHASE->value)
            ->whereIn('status', [TransactionStatus::PROCESSING->value, TransactionStatus::SUCCESS->value])
            ->where('created_at', '>=', Carbon::now()->startOfDay())
            ->sum('amount_minor');

        if ($spent + $amount->amountMinor > $limit) {
            throw new RuntimeException('Daily spending limit exceeded.');
        }
    }
}
