<?php

namespace App\Enums;

/**
 * Double-entry accounting requires classifying every ledger account.
 *
 * Asset / Expense  → increase on DEBIT,  decrease on CREDIT
 * Liability / Equity / Revenue → increase on CREDIT, decrease on DEBIT
 *
 * For our platform:
 *  - user_wallet      = LIABILITY (we owe the user their balance)
 *  - cash_flutterwave = ASSET (money we hold at provider)
 *  - cash_nowpayments = ASSET
 *  - revenue_markup   = REVENUE
 *  - expense_provider = EXPENSE (cost of goods from 5sim/sms-activate)
 *  - suspense         = ASSET (holding account for in-flight ops)
 */
enum AccountType: string
{
    case ASSET     = 'asset';
    case LIABILITY = 'liability';
    case EQUITY    = 'equity';
    case REVENUE   = 'revenue';
    case EXPENSE   = 'expense';
}
