<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                => $this->public_id,
            'name'              => $this->name,
            'email'             => $this->email,
            'phone'             => $this->phone,
            'country'           => $this->country,
            'email_verified'    => $this->email_verified_at !== null,
            'is_active'         => $this->is_active,
            'is_suspended'      => $this->is_suspended,
            'roles'             => $this->getRoleNames(),
            'last_login_at'     => $this->last_login_at?->toIso8601String(),
            'terms_accepted_at' => $this->terms_accepted_at?->toIso8601String(),
            'created_at'        => $this->created_at?->toIso8601String(),
        ];
    }
}
