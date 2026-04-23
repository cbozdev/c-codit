<?php

namespace App\Services\Ledger;

use App\Enums\AccountType;
use App\Enums\LedgerDirection;
use App\Models\LedgerAccount;
use App\Models\LedgerEntry;
use App\Support\Money;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;
use RuntimeException;

/**
 * The ledger is the source of truth for all money movement.
 * No code outside this service may insert rows into ledger_entries.
 *
 * Rules enforced here:
 *   1. Legs sum to zero (sum of debits = sum of credits), by currency.
 *   2. A row-level lock is taken on every involved account before writing.
 *   3. balance_after_minor is computed deterministically inside the locked tx.
 *   4. Operations are idempotent when an idempotency_key is supplied.
 */
class LedgerService
{
    /**
     * Post a balanced journal to the ledger.
     *
     * @param JournalLeg[] $legs
     */
    public function post(
        array $legs,
        ?string $idempotencyKey = null,
        ?Model $reference = null,
        ?string $memo = null,
    ): string {
        if (count($legs) < 2) {
            throw new InvalidArgumentException('A journal requires at least 2 legs.');
        }

        $this->assertBalanced($legs);

        // If idempotency key used and already applied, return its journal_id.
        if ($idempotencyKey) {
            $existing = LedgerEntry::query()
                ->where('idempotency_key', 'LIKE', $idempotencyKey.':%')
                ->value('journal_id');
            if ($existing) return $existing;
        }

        $journalId = (string) Str::uuid();

        DB::transaction(function () use ($legs, $journalId, $idempotencyKey, $reference, $memo) {
            // Lock all involved accounts in a deterministic order to avoid deadlocks.
            $accountIds = collect($legs)->pluck('accountId')->unique()->sort()->values()->all();

            $accounts = LedgerAccount::query()
                ->whereIn('id', $accountIds)
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            if ($accounts->count() !== count($accountIds)) {
                throw new RuntimeException('One or more ledger accounts not found.');
            }

            // Compute current balance for each account, then apply legs in order.
            $currentBalance = [];
            foreach ($accounts as $accountId => $account) {
                $currentBalance[$accountId] = $this->computeBalance($account);
                if (! $account->is_active) {
                    throw new RuntimeException("Account {$account->code} is inactive.");
                }
            }

            foreach ($legs as $i => $leg) {
                $account = $accounts[$leg->accountId];

                if ($account->currency !== $leg->amount->currency) {
                    throw new InvalidArgumentException(
                        "Currency mismatch on account {$account->code}: expected {$account->currency}, got {$leg->amount->currency}"
                    );
                }

                $sign = $this->signFor($account->type, $leg->direction);
                $delta = $sign * $leg->amount->amountMinor;
                $newBalance = $currentBalance[$leg->accountId] + $delta;

                // For liability accounts (user wallets) balance must never go negative.
                if ($account->type === AccountType::LIABILITY && $newBalance < 0) {
                    throw new InsufficientFundsException(
                        "Account {$account->code} has insufficient balance. Current: {$currentBalance[$leg->accountId]}, required: {$leg->amount->amountMinor}"
                    );
                }

                $currentBalance[$leg->accountId] = $newBalance;

                LedgerEntry::create([
                    'journal_id'          => $journalId,
                    'account_id'          => $leg->accountId,
                    'direction'           => $leg->direction->value,
                    'amount_minor'        => $leg->amount->amountMinor,
                    'currency'            => $leg->amount->currency,
                    'balance_after_minor' => $newBalance,
                    'reference_type'      => $reference?->getMorphClass(),
                    'reference_id'        => $reference?->getKey(),
                    // Each leg gets a unique idempotency key so the unique index protects us even if
                    // the same key is retried with identical legs.
                    'idempotency_key'     => $idempotencyKey ? "{$idempotencyKey}:{$i}" : null,
                    'memo'                => $leg->memo ?? $memo,
                    'meta'                => $leg->meta,
                ]);
            }
        });

        return $journalId;
    }

    /**
     * Reverse a journal by posting the opposite legs. Returns the new reversing journal_id.
     */
    public function reverse(string $journalId, ?string $idempotencyKey = null, ?string $memo = null): string
    {
        $entries = LedgerEntry::where('journal_id', $journalId)->get();
        if ($entries->isEmpty()) {
            throw new RuntimeException("Journal {$journalId} not found.");
        }

        $legs = $entries->map(fn (LedgerEntry $e) => new JournalLeg(
            accountId: $e->account_id,
            direction: $e->direction === LedgerDirection::DEBIT ? LedgerDirection::CREDIT : LedgerDirection::DEBIT,
            amount: Money::minor($e->amount_minor, $e->currency),
            memo: $memo ?? "Reversal of {$journalId}",
            meta: ['reversed_journal' => $journalId],
        ))->all();

        return $this->post($legs, $idempotencyKey, memo: $memo ?? "Reversal of {$journalId}");
    }

    public function computeBalance(LedgerAccount $account): int
    {
        // Use the latest entry's balance_after (O(1)) if any exist, otherwise 0.
        $latest = LedgerEntry::where('account_id', $account->id)
            ->orderByDesc('id')
            ->lockForUpdate()
            ->value('balance_after_minor');

        return (int) ($latest ?? 0);
    }

    /**
     * For the given account type, does a DEBIT increase (+1) or decrease (-1) the balance?
     */
    private function signFor(AccountType $type, LedgerDirection $direction): int
    {
        $debitPositive = in_array($type, [AccountType::ASSET, AccountType::EXPENSE], true);
        $isDebit = $direction === LedgerDirection::DEBIT;
        return ($debitPositive === $isDebit) ? +1 : -1;
    }

    /**
     * @param JournalLeg[] $legs
     */
    private function assertBalanced(array $legs): void
    {
        $sums = []; // currency => signed minor
        foreach ($legs as $leg) {
            $cur = $leg->amount->currency;
            $sign = $leg->direction === LedgerDirection::DEBIT ? +1 : -1;
            $sums[$cur] = ($sums[$cur] ?? 0) + $sign * $leg->amount->amountMinor;
        }
        foreach ($sums as $cur => $sum) {
            if ($sum !== 0) {
                throw new InvalidArgumentException("Journal is unbalanced for {$cur}: net {$sum} minor units.");
            }
        }
    }
}
