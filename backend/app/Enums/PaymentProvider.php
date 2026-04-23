<?php

namespace App\Enums;

enum PaymentProvider: string
{
    case FLUTTERWAVE = 'flutterwave';
    case NOWPAYMENTS = 'nowpayments';
    case SYSTEM      = 'system';
}
