<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ServiceOrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                => $this->public_id,
            'service'           => $this->whenLoaded('service', fn () => [
                'code' => $this->service->code,
                'name' => $this->service->name,
            ]),
            'status'            => $this->status,
            'amount_minor'      => (int) $this->amount_minor,
            'amount'            => number_format($this->amount_minor / 100, 2, '.', ''),
            'currency'          => $this->currency,
            'request'           => $this->request,
            'delivery'          => $this->delivery,
            'failure_reason'    => $this->failure_reason,
            'provisioned_at'    => $this->provisioned_at?->toIso8601String(),
            'refunded_at'       => $this->refunded_at?->toIso8601String(),
            'created_at'        => $this->created_at?->toIso8601String(),
        ];
    }
}
