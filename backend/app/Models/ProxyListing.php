<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

class ProxyListing extends Model
{
    protected $fillable = [
        'public_id', 'country_code', 'country_name',
        'state_code', 'state_name', 'city', 'isp', 'zip',
        'ip_display', 'connection_type', 'protocol',
        'speed_ms', 'price_minor', 'is_available', 'sort_order',
        'proxy_host', 'proxy_port', 'proxy_username', 'proxy_password_encrypted',
    ];

    protected function casts(): array
    {
        return [
            'is_available' => 'boolean',
            'speed_ms'     => 'integer',
            'price_minor'  => 'integer',
            'sort_order'   => 'integer',
            'proxy_port'   => 'integer',
        ];
    }

    public function getRouteKeyName(): string { return 'public_id'; }

    public function isIspProxy(): bool
    {
        return ! empty($this->proxy_host) && ! empty($this->proxy_port);
    }

    public function getProxyPassword(): ?string
    {
        if (! $this->proxy_password_encrypted) return null;
        try {
            return Crypt::decryptString($this->proxy_password_encrypted);
        } catch (\Exception) {
            return null;
        }
    }

    public function setProxyPassword(string $password): void
    {
        $this->proxy_password_encrypted = Crypt::encryptString($password);
    }

    public function priceFormatted(): string
    {
        return '$' . number_format($this->price_minor / 100, 2);
    }

    public function toMarketplaceArray(): array
    {
        return [
            'id'              => $this->public_id,
            'country_code'    => $this->country_code,
            'country_name'    => $this->country_name,
            'state_code'      => $this->state_code,
            'state_name'      => $this->state_name,
            'city'            => $this->city,
            'isp'             => $this->isp,
            'zip'             => $this->zip,
            'ip_display'      => $this->ip_display,
            'connection_type' => $this->connection_type,
            'protocol'        => $this->protocol,
            'speed_ms'        => $this->speed_ms,
            'price_minor'     => $this->price_minor,
            'price'           => $this->priceFormatted(),
            'is_available'    => $this->is_available,
        ];
    }
}
