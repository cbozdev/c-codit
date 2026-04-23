<?php

namespace App\Models;

use App\Enums\AccountType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class LedgerAccount extends Model
{
    protected $fillable = [
        'code', 'name', 'type', 'currency',
        'owner_type', 'owner_id',
        'is_system', 'is_active', 'meta',
    ];

    protected function casts(): array
    {
        return [
            'is_system' => 'boolean',
            'is_active' => 'boolean',
            'meta'      => 'array',
            'type'      => AccountType::class,
        ];
    }

    public function entries(): HasMany { return $this->hasMany(LedgerEntry::class, 'account_id'); }
    public function owner(): MorphTo   { return $this->morphTo(); }

    /**
     * Natural balance of the account based on its type.
     * Asset/Expense:  balance = debits - credits
     * Liability/Equity/Revenue: balance = credits - debits
     */
    public function normalBalance(): int
    {
        $debits  = (int) $this->entries()->where('direction', 'debit')->sum('amount_minor');
        $credits = (int) $this->entries()->where('direction', 'credit')->sum('amount_minor');

        return match ($this->type) {
            AccountType::ASSET, AccountType::EXPENSE => $debits - $credits,
            default                                  => $credits - $debits,
        };
    }
}
