<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FeatureFlag extends Model
{
    protected $fillable = ['key', 'enabled', 'description', 'rules'];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'rules'   => 'array',
        ];
    }

    public static function isEnabled(string $key, ?User $user = null): bool
    {
        $flag = static::query()->where('key', $key)->first();
        if (! $flag) return false;
        if (! $flag->enabled) return false;

        $rules = $flag->rules ?? [];
        if (isset($rules['user_ids']) && $user) {
            return in_array($user->id, $rules['user_ids'], true);
        }
        if (isset($rules['percent']) && $user) {
            $bucket = crc32((string) $user->id) % 100;
            return $bucket < (int) $rules['percent'];
        }
        return true;
    }
}
