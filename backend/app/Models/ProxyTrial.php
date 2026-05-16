<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProxyTrial extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'user_id', 'subscription_id', 'claimed_at', 'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'claimed_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    public function user() { return $this->belongsTo(User::class); }
    public function subscription() { return $this->belongsTo(ProxySubscription::class); }
}
