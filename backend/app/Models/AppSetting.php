<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AppSetting extends Model
{
    protected $primaryKey = 'key';
    public $incrementing  = false;
    protected $keyType    = 'string';
    protected $fillable   = ['key', 'value'];

    public static function getValue(string $key, mixed $default = null): mixed
    {
        return static::find($key)?->value ?? $default;
    }

    public static function setValue(string $key, mixed $value): void
    {
        static::updateOrCreate(['key' => $key], ['value' => $value]);
    }

    /** Returns all public-facing settings safe to expose without auth. */
    public static function publicSettings(): array
    {
        $keys = ['logo_url', 'app_name', 'support_email'];
        $rows = static::whereIn('key', $keys)->pluck('value', 'key');
        return $rows->toArray();
    }

    /** Returns admin-only settings including provider API keys (masked). */
    public static function adminSettings(): array
    {
        $public = static::publicSettings();
        $smspoolKey = static::getValue('smspool_api_key');
        $public['smspool_api_key_set'] = !empty($smspoolKey);
        return $public;
    }
}
