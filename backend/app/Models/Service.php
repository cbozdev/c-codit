<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Service extends Model
{
    protected $fillable = [
        'code', 'name', 'provider', 'category', 'description',
        'is_active', 'config', 'base_price_minor', 'currency', 'markup_percent',
    ];

    protected function casts(): array
    {
        return [
            'is_active'        => 'boolean',
            'config'           => 'array',
            'base_price_minor' => 'integer',
            'markup_percent'   => 'decimal:2',
        ];
    }

    public function getRouteKeyName(): string { return 'code'; }
}
