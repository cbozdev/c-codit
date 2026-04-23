<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class Wallet extends Model
{
    use HasFactory;

    protected $fillable = [
        'public_id', 'user_id', 'currency',
        'balance_minor', 'pending_balance_minor',
        'is_frozen', 'frozen_reason', 'frozen_at', 'version',
    ];

    protected function casts(): array
    {
        return [
            'balance_minor'         => 'integer',
            'pending_balance_minor' => 'integer',
            'version'               => 'integer',
            'is_frozen'             => 'boolean',
            'frozen_at'             => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $w) {
            if (! $w->public_id) $w->public_id = (string) Str::uuid();
        });
    }

    public function user(): BelongsTo { return $this->belongsTo(User::class); }

    public function getBalanceDecimalAttribute(): string
    {
        return number_format($this->balance_minor / 100, 2, '.', '');
    }
}
