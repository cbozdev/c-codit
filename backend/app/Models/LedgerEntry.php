<?php

namespace App\Models;

use App\Enums\LedgerDirection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Str;
use RuntimeException;

class LedgerEntry extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'public_id', 'journal_id', 'account_id', 'direction',
        'amount_minor', 'currency', 'balance_after_minor',
        'reference_type', 'reference_id', 'idempotency_key',
        'memo', 'meta',
    ];

    protected function casts(): array
    {
        return [
            'amount_minor'        => 'integer',
            'balance_after_minor' => 'integer',
            'meta'                => 'array',
            'direction'           => LedgerDirection::class,
            'created_at'          => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $e) {
            if (! $e->public_id) $e->public_id = (string) Str::uuid();
        });

        // Application-level immutability (DB trigger enforces it too)
        static::updating(function () {
            throw new RuntimeException('LedgerEntry is immutable.');
        });
        static::deleting(function () {
            throw new RuntimeException('LedgerEntry cannot be deleted.');
        });
    }

    public function account(): BelongsTo { return $this->belongsTo(LedgerAccount::class, 'account_id'); }
    public function reference(): MorphTo { return $this->morphTo(); }
}
