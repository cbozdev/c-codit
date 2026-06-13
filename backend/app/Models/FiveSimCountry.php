<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FiveSimCountry extends Model
{
    protected $fillable = ['api_code', 'name', 'iso_code', 'phone_prefix', 'is_active', 'metadata'];
    protected $casts = ['metadata' => 'array', 'is_active' => 'boolean'];

    public function operators(): HasMany
    {
        return $this->hasMany(FiveSimOperator::class, 'country_id');
    }

    public function prices(): HasMany
    {
        return $this->hasMany(FiveSimPrice::class, 'country_id');
    }

    public function activeOperators(): HasMany
    {
        return $this->operators()->where('is_active', true);
    }
}
