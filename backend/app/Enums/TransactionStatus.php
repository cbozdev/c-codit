<?php

namespace App\Enums;

enum TransactionStatus: string
{
    case PENDING    = 'pending';
    case PROCESSING = 'processing';
    case SUCCESS    = 'success';
    case FAILED     = 'failed';
    case REFUNDED   = 'refunded';
    case REVERSED   = 'reversed';
}
