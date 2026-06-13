<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FiveSimPrice extends Model
{
    protected $fillable = ['country_id', 'product_id', 'operator_id', 'price_rub', 'available_count', 'last_fetched_at'];
    protected $casts = ['price_rub' => 'decimal:4', 'last_fetched_at' => 'datetime'];

    public function country(): BelongsTo
    {
        return $this->belongsTo(FiveSimCountry::class, 'country_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(FiveSimProduct::class, 'product_id');
    }

    public function operator(): BelongsTo
    {
        return $this->belongsTo(FiveSimOperator::class, 'operator_id');
    }
}
