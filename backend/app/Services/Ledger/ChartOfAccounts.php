<?php

namespace App\Services\Ledger;

use App\Enums\AccountType;
use App\Models\LedgerAccount;
use App\Models\User;
use App\Models\Wallet;

/**
 * Provides access to named system accounts and ensures per-user wallet
 * ledger accounts exist. Keeps ledger account codes consistent across the app.
 */
class ChartOfAccounts
{
    public const CASH_FLUTTERWAVE   = 'cash.flutterwave';
    public const CASH_NOWPAYMENTS   = 'cash.nowpayments';
    public const REVENUE_MARKUP     = 'revenue.markup';
    public const EXPENSE_PROVIDER   = 'expense.provider_cost';
    public const PENDING_ORDERS     = 'liability.pending_orders';
    public const REFUND_POOL        = 'liability.refund_pool';

    /** System accounts that must exist for the app to function. */
    public const SYSTEM_ACCOUNTS = [
        self::CASH_FLUTTERWAVE => ['name' => 'Cash at Flutterwave',       'type' => AccountType::ASSET],
        self::CASH_NOWPAYMENTS => ['name' => 'Cash at NowPayments',       'type' => AccountType::ASSET],
        self::REVENUE_MARKUP   => ['name' => 'Revenue - Markup',          'type' => AccountType::REVENUE],
        self::EXPENSE_PROVIDER => ['name' => 'Provider Cost',             'type' => AccountType::EXPENSE],
        self::PENDING_ORDERS   => ['name' => 'Pending Order Obligations', 'type' => AccountType::LIABILITY],
        self::REFUND_POOL      => ['name' => 'Refund Liability Pool',     'type' => AccountType::LIABILITY],
    ];

    public function system(string $code, string $currency = 'USD'): LedgerAccount
    {
        $def = self::SYSTEM_ACCOUNTS[$code] ?? null;
        if (! $def) {
            throw new \InvalidArgumentException("Unknown system account code: {$code}");
        }

        return LedgerAccount::firstOrCreate(
            ['code' => $code, 'currency' => $currency],
            [
                'name'      => $def['name'],
                'type'      => $def['type']->value,
                'is_system' => true,
                'is_active' => true,
            ],
        );
    }

    public function userWallet(User|Wallet $subject, string $currency = 'USD'): LedgerAccount
    {
        $wallet = $subject instanceof User ? $subject->wallet : $subject;
        $code = "user.wallet.{$wallet->id}";

        return LedgerAccount::firstOrCreate(
            ['code' => $code, 'currency' => $currency],
            [
                'name'       => "User wallet #{$wallet->id}",
                'type'       => AccountType::LIABILITY->value,
                'owner_type' => Wallet::class,
                'owner_id'   => $wallet->id,
                'is_system'  => false,
                'is_active'  => true,
            ],
        );
    }
}
