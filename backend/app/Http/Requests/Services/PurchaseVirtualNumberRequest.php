<?php

namespace App\Http\Requests\Services;

use Illuminate\Foundation\Http\FormRequest;

class PurchaseVirtualNumberRequest extends FormRequest
{
    public function authorize(): bool { return $this->user() !== null; }

    public function rules(): array
    {
        return [
            'service_code' => ['required', 'string', 'exists:services,code'],
            'service'      => ['required', 'string', 'max:40'],   // provider service id, e.g. 'telegram'
            'country'      => ['required', 'string', 'min:2', 'max:8'],
        ];
    }
}
