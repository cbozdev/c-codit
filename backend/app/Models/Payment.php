<?php

namespace App\Models;

use App\Enums\PaymentProvider;
use App\Enums\PaymentStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Payment extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'public_id', 'user_id', 'provider', 'provider_reference', 'provider_payment_id',
        'status', 'amount_minor', 'currency',
        'requested_amount_minor', 'requested_currency',
        'pay_currency', 'pay_address', 'checkout_url',
        'idempotency_key',
        'request_payload', 'response_payload', 'webhook_payload',
        'verified_at', 'expires_at',
    ];

    protected $hidden = ['request_payload', 'response_payload', 'webhook_payload'];

    protected function casts(): array
    {
        return [
            'amount_minor'           => 'integer',
            'requested_amount_minor' => 'integer',
            'provider'               => PaymentProvider::class,
            'status'                 => PaymentStatus::class,
            'request_payload'        => 'array',
            'response_payload'       => 'array',
            'webhook_payload'        => 'array',
            'verified_at'            => 'datetime',
            'expires_at'             => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $p) {
            if (! $p->public_id) $p->public_id = (string) Str::uuid();
        });
    }

    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function getRouteKeyName(): string { return 'public_id'; }
}
