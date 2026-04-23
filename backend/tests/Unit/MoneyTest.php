<?php

namespace Tests\Unit;

use App\Support\Money;
use PHPUnit\Framework\TestCase;

class MoneyTest extends TestCase
{
    public function test_from_decimal_handles_strings_without_float_drift(): void
    {
        $m = Money::fromDecimal('19.99', 'USD');
        $this->assertSame(1999, $m->amountMinor);
        $this->assertSame('19.99', $m->toDecimal());
    }

    public function test_addition_preserves_currency(): void
    {
        $sum = Money::fromDecimal('10.50', 'USD')->add(Money::fromDecimal('0.50', 'USD'));
        $this->assertSame(1100, $sum->amountMinor);
    }

    public function test_currency_mismatch_throws(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        Money::fromDecimal('1.00', 'USD')->add(Money::fromDecimal('1.00', 'NGN'));
    }

    public function test_percent_markup_rounds_half_up(): void
    {
        $with15pct = Money::minor(100, 'USD')->mulPercent(15);
        $this->assertSame(15, $with15pct->amountMinor);
        $tricky = Money::minor(33, 'USD')->mulPercent(15); // 4.95 → 5
        $this->assertSame(5, $tricky->amountMinor);
    }
}
