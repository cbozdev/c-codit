<?php

namespace App\Models;

use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Transaction extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'public_id', 'reference', 'user_id', 'wallet_id',
        'type', 'status', 'amount_minor', 'currency',
        'description', 'journal_id', 'related_type', 'related_id',
        'idempotency_key', 'parent_transaction_id',
        'meta', 'completed_at', 'failed_at', 'failure_reason',
    ];

    protected function casts(): array
    {
        return [
            'amount_minor' => 'integer',
            'meta'         => 'array',
            'type'         => TransactionType::class,
            'status'       => TransactionStatus::class,
            'completed_at' => 'datetime',
            'failed_at'    => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $t) {
            if (! $t->public_id) $t->public_id = (string) Str::uuid();
            if (! $t->reference) $t->reference = static::generateReference($t->type);
        });
    }

    public static function generateReference(TransactionType|string $type): string
    {
        $prefix = match ($type instanceof TransactionType ? $type : TransactionType::from($type)) {
            TransactionType::WALLET_FUNDING   => 'FUN',
            TransactionType::SERVICE_PURCHASE => 'SVC',
            TransactionType::REFUND           => 'RFD',
            TransactionType::REVERSAL         => 'REV',
            TransactionType::ADJUSTMENT       => 'ADJ',
        };
        return $prefix.'-'.strtoupper(Str::random(10)).'-'.now()->format('ymd');
    }

    public function user(): BelongsTo    { return $this->belongsTo(User::class); }
    public function wallet(): BelongsTo  { return $this->belongsTo(Wallet::class); }
    public function related(): MorphTo   { return $this->morphTo(); }
    public function parent(): BelongsTo  { return $this->belongsTo(self::class, 'parent_transaction_id'); }

    public function getRouteKeyName(): string { return 'public_id'; }
}
