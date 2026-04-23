<?php

namespace Tests\Feature;

use App\Enums\LedgerDirection;
use App\Models\User;
use App\Services\Ledger\ChartOfAccounts;
use App\Services\Ledger\InsufficientFundsException;
use App\Services\Ledger\JournalLeg;
use App\Services\Ledger\LedgerService;
use App\Services\Wallet\WalletService;
use App\Support\Money;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LedgerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);
        $this->seed(\Database\Seeders\ChartOfAccountsSeeder::class);
    }

    public function test_unbalanced_journal_is_rejected(): void
    {
        $coa = app(ChartOfAccounts::class);
        $cash = $coa->system(ChartOfAccounts::CASH_FLUTTERWAVE);
        $rev  = $coa->system(ChartOfAccounts::REVENUE_MARKUP);

        $this->expectException(\InvalidArgumentException::class);
        app(LedgerService::class)->post([
            new JournalLeg($cash->id, LedgerDirection::DEBIT,  Money::minor(100)),
            new JournalLeg($rev->id,  LedgerDirection::CREDIT, Money::minor(99)),
        ]);
    }

    public function test_funding_then_purchase_then_refund_flow(): void
    {
        $user = User::factory()->create();
        $wallets = app(WalletService::class);
        $wallet = $wallets->getOrCreate($user);

        // Fund $50.
        $wallets->fundFromPayment(
            wallet: $wallet,
            amount: Money::fromDecimal('50.00', 'USD'),
            cashAccountCode: ChartOfAccounts::CASH_FLUTTERWAVE,
            idempotencyKey: 'test-fund-1',
        );
        $wallet->refresh();
        $this->assertSame(5000, $wallet->balance_minor);

        // Hold $20.
        $hold = $wallets->holdForPurchase(
            wallet: $wallet,
            amount: Money::fromDecimal('20.00', 'USD'),
            idempotencyKey: 'test-hold-1',
        );
        $wallet->refresh();
        $this->assertSame(3000, $wallet->balance_minor);

        // Refund.
        $wallets->refundSuspense($hold, 'test-refund-1', 'Provider failed');
        $wallet->refresh();
        $this->assertSame(5000, $wallet->balance_minor);
    }

    public function test_insufficient_funds_blocks_hold(): void
    {
        $user = User::factory()->create();
        $wallets = app(WalletService::class);
        $wallet = $wallets->getOrCreate($user);

        $this->expectException(InsufficientFundsException::class);
        $wallets->holdForPurchase($wallet, Money::fromDecimal('1.00', 'USD'), 'test-hold-2');
    }

    public function test_idempotent_funding_does_not_double_credit(): void
    {
        $user = User::factory()->create();
        $wallets = app(WalletService::class);
        $wallet = $wallets->getOrCreate($user);

        $wallets->fundFromPayment($wallet, Money::fromDecimal('10.00'), ChartOfAccounts::CASH_FLUTTERWAVE, 'same-key');
        $wallets->fundFromPayment($wallet, Money::fromDecimal('10.00'), ChartOfAccounts::CASH_FLUTTERWAVE, 'same-key');

        $wallet->refresh();
        $this->assertSame(1000, $wallet->balance_minor);
    }
}
