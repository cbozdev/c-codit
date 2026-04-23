<?php

namespace App\Enums;

enum LedgerDirection: string
{
    case DEBIT  = 'debit';
    case CREDIT = 'credit';
}
