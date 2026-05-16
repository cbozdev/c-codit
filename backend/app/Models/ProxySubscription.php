<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Crypt;

class ProxySubscription extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'public_id', 'user_id', 'service_order_id',
        'provider', 'provider_subscription_id',
        'proxy_type', 'protocol', 'host', 'port',
        'username', 'password_encrypted',
        'location_country', 'location_city',
        'bandwidth_gb_total', 'bandwidth_gb_used',
        'ip_count', 'threads', 'status',
        'auto_renew', 'is_trial', 'duration_days',
        'expires_at', 'last_synced_at', 'provisioned_at', 'config',
    ];

    protected function casts(): array
    {
        return [
            'bandwidth_gb_total' => 'decimal:3',
            'bandwidth_gb_used'  => 'decimal:3',
            'auto_renew'         => 'boolean',
            'is_trial'           => 'boolean',
            'expires_at'         => 'datetime',
            'last_synced_at'     => 'datetime',
            'provisioned_at'     => 'datetime',
            'config'             => 'array',
        ];
    }

    public function user() { return $this->belongsTo(User::class); }
    public function serviceOrder() { return $this->belongsTo(ServiceOrder::class); }
    public function usageLogs() { return $this->hasMany(ProxyUsageLog::class, 'subscription_id'); }

    public function getPassword(): ?string
    {
        if (! $this->password_encrypted) return null;
        try { return Crypt::decryptString($this->password_encrypted); }
        catch (\Throwable) { return null; }
    }

    public function setPassword(string $password): void
    {
        $this->password_encrypted = Crypt::encryptString($password);
    }

    public function getProxyUrl(): string
    {
        $pass = $this->getPassword() ?? '';
        return "{$this->protocol}://{$this->username}:{$pass}@{$this->host}:{$this->port}";
    }

    public function isExpired(): bool
    {
        return $this->expires_at && $this->expires_at->isPast();
    }

    public function bandwidthPercent(): float
    {
        if ($this->bandwidth_gb_total <= 0) return 0;
        return round(($this->bandwidth_gb_used / $this->bandwidth_gb_total) * 100, 1);
    }

    public function bandwidthRemaining(): float
    {
        return max(0, $this->bandwidth_gb_total - $this->bandwidth_gb_used);
    }

    public function toCredentials(): array
    {
        return [
            'host'      => $this->host,
            'port'      => $this->port,
            'username'  => $this->username,
            'password'  => $this->getPassword(),
            'protocol'  => $this->protocol,
            'proxy_url' => $this->getProxyUrl(),
        ];
    }

    public function getRouteKeyName(): string { return 'public_id'; }

    // Proxy type human labels
    public static function typeLabel(string $type): string
    {
        return match ($type) {
            'residential_rotating'  => 'Rotating Residential',
            'residential_sticky'    => 'Sticky Residential',
            'residential_static'    => 'Static Residential',
            'datacenter_shared'     => 'Shared Datacenter',
            'datacenter_dedicated'  => 'Dedicated Datacenter',
            'isp_static'            => 'Static ISP',
            'isp_rotating'          => 'Rotating ISP',
            'mobile_rotating'       => 'Rotating Mobile',
            default                 => ucwords(str_replace('_', ' ', $type)),
        };
    }
}
