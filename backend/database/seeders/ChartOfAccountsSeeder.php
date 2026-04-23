<?php

namespace Database\Seeders;

use App\Services\Ledger\ChartOfAccounts;
use Illuminate\Database\Seeder;

class ChartOfAccountsSeeder extends Seeder
{
    public function run(): void
    {
        $coa = app(ChartOfAccounts::class);
        foreach (array_keys(ChartOfAccounts::SYSTEM_ACCOUNTS) as $code) {
            $coa->system($code, 'USD');
        }
    }
}
