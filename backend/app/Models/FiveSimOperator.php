<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FiveSimOperator extends Model
{
    protected $fillable = ['country_id', 'api_code', 'name', 'product_count', 'is_active', 'metadata'];
    protected $casts = ['metadata' => 'array', 'is_active' => 'boolean'];

    public function country(): BelongsTo
    {
        return $this->belongsTo(FiveSimCountry::class, 'country_id');
    }

    public function prices(): HasMany
    {
        return $this->hasMany(FiveSimPrice::class, 'operator_id');
    }
}
