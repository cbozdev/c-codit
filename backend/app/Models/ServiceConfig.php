<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

class ServiceConfig extends Model
{
    protected $table = 'service_configs';

    protected $fillable = ['group', 'key', 'value', 'is_secret', 'label', 'updated_by'];

    // Store value encrypted if is_secret, plain otherwise
    public function setValueAttribute(?string $value): void
    {
        if ($value === null || $value === '') {
            $this->attributes['value'] = null;
            return;
        }
        $this->attributes['value'] = $this->is_secret ? Crypt::encryptString($value) : $value;
    }

    public function getDecryptedValue(): ?string
    {
        $raw = $this->attributes['value'] ?? null;
        if ($raw === null) return null;
        try {
            return $this->is_secret ? Crypt::decryptString($raw) : $raw;
        } catch (\Throwable) {
            return null;
        }
    }

    // Map group.key => config path
    public static function configPath(string $group, string $key): string
    {
        return "services.{$group}.{$key}";
    }
}
