<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TransactionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'             => $this->public_id,
            'reference'      => $this->reference,
            'type'           => $this->type instanceof \BackedEnum ? $this->type->value : $this->type,
            'status'         => $this->status instanceof \BackedEnum ? $this->status->value : $this->status,
            'amount_minor'   => (int) $this->amount_minor,
            'amount'         => number_format($this->amount_minor / 100, 2, '.', ''),
            'currency'       => $this->currency,
            'description'    => $this->description,
            'failure_reason' => $this->failure_reason,
            'completed_at'   => $this->completed_at?->toIso8601String(),
            'failed_at'      => $this->failed_at?->toIso8601String(),
            'created_at'     => $this->created_at?->toIso8601String(),
        ];
    }
}
