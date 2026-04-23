<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ServiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'code'        => $this->code,
            'name'        => $this->name,
            'category'    => $this->category,
            'provider'    => $this->provider,
            'description' => $this->description,
            'is_active'   => (bool) $this->is_active,
            'currency'    => $this->currency,
        ];
    }
}
