<?php

namespace App\Services\Ledger;

use App\Enums\LedgerDirection;
use App\Support\Money;
use InvalidArgumentException;

final class JournalLeg
{
    public function __construct(
        public readonly int $accountId,
        public readonly LedgerDirection $direction,
        public readonly Money $amount,
        public readonly ?string $memo = null,
        public readonly array $meta = [],
    ) {
        if (! $amount->isPositive()) {
            throw new InvalidArgumentException('Ledger leg amount must be strictly positive.');
        }
    }
}
