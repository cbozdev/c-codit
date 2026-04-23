<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WalletResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'              => $this->public_id,
            'currency'        => $this->currency,
            'balance_minor'   => (int) $this->balance_minor,
            'balance'         => $this->balance_decimal,
            'is_frozen'       => (bool) $this->is_frozen,
            'frozen_reason'   => $this->frozen_reason,
            'updated_at'      => $this->updated_at?->toIso8601String(),
        ];
    }
}
