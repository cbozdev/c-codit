<?php

namespace App\Support;

use InvalidArgumentException;

/**
 * Immutable money value. Stored internally in integer MINOR units (e.g. cents).
 * Never use floats for money anywhere in the application.
 */
final class Money
{
    private function __construct(
        public readonly int $amountMinor,
        public readonly string $currency,
    ) {
        if (strlen($currency) !== 3) {
            throw new InvalidArgumentException("Currency must be a 3-letter ISO code, got '{$currency}'.");
        }
    }

    public static function minor(int $minor, string $currency = 'USD'): self
    {
        return new self($minor, strtoupper($currency));
    }

    public static function fromDecimal(string|float|int $amount, string $currency = 'USD'): self
    {
        // String math to avoid float rounding.
        $s = is_string($amount) ? $amount : sprintf('%.8F', $amount);
        if (! preg_match('/^-?\d+(\.\d+)?$/', $s)) {
            throw new InvalidArgumentException("Invalid decimal amount: {$amount}");
        }
        [$whole, $frac] = array_pad(explode('.', $s, 2), 2, '0');
        $frac = substr(str_pad($frac, 2, '0'), 0, 2);
        $sign = str_starts_with($whole, '-') ? -1 : 1;
        $whole = ltrim($whole, '-');
        $minor = $sign * ((int) $whole * 100 + (int) $frac);
        return new self($minor, strtoupper($currency));
    }

    public function toDecimal(): string
    {
        $sign = $this->amountMinor < 0 ? '-' : '';
        $abs = abs($this->amountMinor);
        return $sign.intdiv($abs, 100).'.'.str_pad((string)($abs % 100), 2, '0', STR_PAD_LEFT);
    }

    public function isPositive(): bool { return $this->amountMinor > 0; }
    public function isNegative(): bool { return $this->amountMinor < 0; }
    public function isZero(): bool     { return $this->amountMinor === 0; }

    public function add(self $other): self
    {
        $this->assertSameCurrency($other);
        return new self($this->amountMinor + $other->amountMinor, $this->currency);
    }

    public function subtract(self $other): self
    {
        $this->assertSameCurrency($other);
        return new self($this->amountMinor - $other->amountMinor, $this->currency);
    }

    public function mulPercent(float|int|string $percent): self
    {
        // Round half-up.
        $result = (int) round(($this->amountMinor * (float) $percent) / 100, 0, PHP_ROUND_HALF_UP);
        return new self($result, $this->currency);
    }

    private function assertSameCurrency(self $other): void
    {
        if ($this->currency !== $other->currency) {
            throw new InvalidArgumentException("Currency mismatch: {$this->currency} vs {$other->currency}");
        }
    }

    public function __toString(): string { return $this->toDecimal().' '.$this->currency; }
}
