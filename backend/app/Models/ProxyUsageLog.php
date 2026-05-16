<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProxyUsageLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'subscription_id', 'user_id', 'event_type', 'bandwidth_mb', 'data', 'created_at',
    ];

    protected function casts(): array
    {
        return [
            'bandwidth_mb' => 'decimal:3',
            'data'         => 'array',
            'created_at'   => 'datetime',
        ];
    }

    public function subscription() { return $this->belongsTo(ProxySubscription::class); }
    public function user() { return $this->belongsTo(User::class); }
}
