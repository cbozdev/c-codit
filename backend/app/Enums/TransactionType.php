<?php

namespace App\Enums;

enum TransactionType: string
{
    case WALLET_FUNDING          = 'wallet_funding';
    case SERVICE_PURCHASE        = 'service_purchase';
    case REFUND                  = 'refund';
    case ADJUSTMENT              = 'adjustment';
    case REVERSAL                = 'reversal';
}
