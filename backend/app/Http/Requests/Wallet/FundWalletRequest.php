<?php

namespace App\Http\Requests\Wallet;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class FundWalletRequest extends FormRequest
{
    public function authorize(): bool { return $this->user() !== null; }

    public function rules(): array
    {
        return [
            'amount'       => ['required', 'numeric', 'min:1', 'max:10000'],
            'currency'     => ['nullable', 'string', 'size:3'],
            'provider'     => ['required', Rule::in(['flutterwave', 'nowpayments'])],
            'pay_currency'   => ['nullable', 'string', 'max:10'], // for NowPayments
            'deposit_method' => ['nullable', 'string', Rule::in(['banktransfer', 'ussd', 'card'])],
        ];
    }
}
