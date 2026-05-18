<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'two_factor_secret'))
                $table->string('two_factor_secret', 64)->nullable()->after('password');
            if (!Schema::hasColumn('users', 'two_factor_confirmed_at'))
                $table->timestamp('two_factor_confirmed_at')->nullable()->after('two_factor_secret');
            if (!Schema::hasColumn('users', 'referral_code'))
                $table->string('referral_code', 12)->nullable()->unique()->after('two_factor_confirmed_at');
            if (!Schema::hasColumn('users', 'referred_by'))
                $table->unsignedBigInteger('referred_by')->nullable()->after('referral_code');
            if (!Schema::hasColumn('users', 'deleted_at'))
                $table->softDeletes()->after('updated_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(array_filter(
                ['two_factor_secret', 'two_factor_confirmed_at', 'referral_code', 'referred_by', 'deleted_at'],
                fn($col) => Schema::hasColumn('users', $col)
            ));
        });
    }
};
