<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class ServiceOrder extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'public_id', 'user_id', 'service_id', 'transaction_id',
        'status', 'amount_minor', 'currency',
        'provider_order_id', 'request', 'provider_response', 'delivery',
        'idempotency_key', 'failure_reason',
        'provisioned_at', 'refunded_at',
    ];

    protected function casts(): array
    {
        return [
            'amount_minor'     => 'integer',
            'request'          => 'array',
            'provider_response'=> 'array',
            'delivery'         => 'array',
            'provisioned_at'   => 'datetime',
            'refunded_at'      => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $o) {
            if (! $o->public_id) $o->public_id = (string) Str::uuid();
        });
    }

    public function user(): BelongsTo        { return $this->belongsTo(User::class); }
    public function service(): BelongsTo     { return $this->belongsTo(Service::class); }
    public function transaction(): BelongsTo { return $this->belongsTo(Transaction::class); }

    public function getRouteKeyName(): string { return 'public_id'; }
}
