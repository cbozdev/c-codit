<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProxyApiKey extends Model
{
    protected $fillable = [
        'public_id', 'user_id', 'name', 'key_hash', 'key_prefix',
        'scopes', 'ip_whitelist', 'request_count', 'is_active', 'last_used_at',
    ];

    protected function casts(): array
    {
        return [
            'scopes'       => 'array',
            'ip_whitelist' => 'array',
            'is_active'    => 'boolean',
            'last_used_at' => 'datetime',
        ];
    }

    public function user() { return $this->belongsTo(User::class); }

    public function hasScope(string $scope): bool
    {
        if (empty($this->scopes)) return true; // null = all scopes
        return in_array($scope, $this->scopes, true);
    }

    public function isAllowedIp(string $ip): bool
    {
        if (empty($this->ip_whitelist)) return true;
        return in_array($ip, $this->ip_whitelist, true);
    }

    public static function generateRawKey(): string
    {
        return 'pk_' . bin2hex(random_bytes(24));
    }

    public static function hashKey(string $rawKey): string
    {
        return hash('sha256', $rawKey);
    }

    public function getRouteKeyName(): string { return 'public_id'; }
}
