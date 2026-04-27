<?php

namespace App\Support;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class Audit
{
    public static function log(
        string $action,
        ?Model $subject = null,
        array $context = [],
        ?int $userId = null,
        string $actorType = 'user',
    ): void {
        /** @var Request|null $req */
        $req = app()->bound('request') ? app('request') : null;

        AuditLog::create([
            'user_id'      => $userId ?? $req?->user()?->id,
            'actor_type'   => $actorType,
            'action'       => $action,
            'subject_type' => $subject?->getMorphClass(),
            'subject_id'   => $subject?->getKey(),
            'ip_address'   => $req?->ip(),
            'user_agent'   => $req ? (string) $req->userAgent() : null,
            'context'      => $context,
        ]);
    }
}
