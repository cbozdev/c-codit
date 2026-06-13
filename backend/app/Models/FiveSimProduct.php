<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FiveSimProduct extends Model
{
    protected $table = 'fivesim_products';
    protected $fillable = ['api_code', 'name', 'description', 'service_id', 'is_active', 'metadata'];
    protected $casts = ['metadata' => 'array', 'is_active' => 'boolean'];

    public function prices(): HasMany
    {
        return $this->hasMany(FiveSimPrice::class, 'product_id');
    }
}
