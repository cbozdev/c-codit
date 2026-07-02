<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('proxy_listings', function (Blueprint $t) {
            $t->string('proxy_host', 120)->nullable()->after('ip_display');
            $t->unsignedSmallInteger('proxy_port')->nullable()->after('proxy_host');
            $t->string('proxy_username', 120)->nullable()->after('proxy_port');
            $t->text('proxy_password_encrypted')->nullable()->after('proxy_username');
        });
    }

    public function down(): void
    {
        Schema::table('proxy_listings', function (Blueprint $t) {
            $t->dropColumn(['proxy_host', 'proxy_port', 'proxy_username', 'proxy_password_encrypted']);
        });
    }
};
