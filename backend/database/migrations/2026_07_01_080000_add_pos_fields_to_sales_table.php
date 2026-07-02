<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds point-of-sale fields to sales: order-level discount, tax and the
 * payment method used at checkout.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->decimal('discount', 12, 2)->default(0)->after('total_amount');
            $table->decimal('tax', 12, 2)->default(0)->after('discount');
            $table->string('payment_method')->default('cash')->after('paid_amount');
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropColumn(['discount', 'tax', 'payment_method']);
        });
    }
};
