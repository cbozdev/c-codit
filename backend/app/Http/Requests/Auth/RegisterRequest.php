<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name'         => ['required', 'string', 'min:2', 'max:120'],
            'email'        => ['required', 'email:rfc,strict', 'max:190', 'unique:users,email'],
            'password'     => ['required', 'confirmed', Password::min(10)->mixedCase()->numbers()->symbols()],
            'country'      => ['nullable', 'string', 'size:2'],
            'phone'        => ['nullable', 'string', 'max:32'],
            'accept_terms' => ['accepted'],
        ];
    }
}
