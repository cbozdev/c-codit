<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WebhookEvent extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'provider', 'event_id', 'signature', 'signature_hash',
        'payload', 'status', 'error', 'processed_at', 'received_at',
    ];

    protected function casts(): array
    {
        return [
            'payload'      => 'array',
            'received_at'  => 'datetime',
            'processed_at' => 'datetime',
        ];
    }
}
