<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Store all 5sim countries with their API codes
        Schema::create('fivesim_countries', function (Blueprint $t) {
            $t->id();
            $t->string('api_code', 50)->unique()->index();   // e.g. 'usa', 'england', 'india'
            $t->string('name');                              // e.g. 'USA', 'England', 'India'
            $t->string('iso_code', 2)->nullable()->index();  // e.g. 'US', 'GB', 'IN'
            $t->integer('phone_prefix')->nullable();         // e.g. 1, 44, 91
            $t->boolean('is_active')->default(true);
            $t->json('metadata')->nullable();                // any additional data from API
            $t->timestamps();
        });

        // Store all 5sim products/services
        Schema::create('fivesim_products', function (Blueprint $t) {
            $t->id();
            $t->string('api_code', 100)->unique()->index();  // e.g. 'telegram', 'facebook', 'amazon'
            $t->string('name');                              // e.g. 'Telegram', 'Facebook', 'Amazon'
            $t->text('description')->nullable();
            $t->integer('service_id')->nullable();           // 5sim internal service ID if available
            $t->boolean('is_active')->default(true);
            $t->json('metadata')->nullable();
            $t->timestamps();
        });

        // Store operators per country (often carriers like Vodafone, Verizon, etc.)
        Schema::create('fivesim_operators', function (Blueprint $t) {
            $t->id();
            $t->foreignId('country_id')->constrained('fivesim_countries')->cascadeOnDelete();
            $t->string('api_code', 100)->index();            // e.g. 'virtual28', 'mts', 'verizon'
            $t->string('name');                              // e.g. 'Virtual Operator', 'MTS', 'Verizon'
            $t->integer('product_count')->nullable();        // number of products available
            $t->boolean('is_active')->default(true);
            $t->json('metadata')->nullable();
            $t->timestamps();

            $t->unique(['country_id', 'api_code']);
            $t->index(['country_id', 'is_active']);
        });

        // Pricing cache: stores latest price for each country/product/operator combo
        Schema::create('fivesim_prices', function (Blueprint $t) {
            $t->id();
            $t->foreignId('country_id')->constrained('fivesim_countries')->cascadeOnDelete();
            $t->foreignId('product_id')->constrained('fivesim_products')->cascadeOnDelete();
            $t->foreignId('operator_id')->constrained('fivesim_operators')->cascadeOnDelete();
            $t->decimal('price_rub', 10, 4);                 // Price in RUB (5sim's native currency)
            $t->integer('available_count')->default(0);       // Number of numbers in stock
            $t->timestamp('last_fetched_at')->nullable();
            $t->timestamps();

            $t->unique(['country_id', 'product_id', 'operator_id']);
            $t->index(['country_id', 'product_id', 'available_count']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fivesim_prices');
        Schema::dropIfExists('fivesim_operators');
        Schema::dropIfExists('fivesim_products');
        Schema::dropIfExists('fivesim_countries');
    }
};
