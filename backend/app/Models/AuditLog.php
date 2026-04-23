<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Str;
use RuntimeException;

class AuditLog extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'public_id', 'user_id', 'actor_type', 'action',
        'subject_type', 'subject_id',
        'ip_address', 'user_agent', 'context',
    ];

    protected function casts(): array
    {
        return [
            'context'    => 'array',
            'created_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $a) {
            if (! $a->public_id) $a->public_id = (string) Str::uuid();
        });
        static::updating(function () { throw new RuntimeException('AuditLog is immutable.'); });
        static::deleting(function () { throw new RuntimeException('AuditLog cannot be deleted.'); });
    }

    public function user(): BelongsTo    { return $this->belongsTo(User::class); }
    public function subject(): MorphTo   { return $this->morphTo(); }
}
