<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Pending ABA PayWay checkouts. A real Sale is only created once ABA confirms
 * the payment as approved, so unpaid orders never touch stock or revenue.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payway_transactions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable()->index();
            $table->string('tran_id')->unique();
            $table->decimal('amount', 12, 2)->default(0);
            $table->string('currency', 3)->default('USD');
            $table->string('status')->default('pending'); // pending | approved | declined
            $table->unsignedBigInteger('sale_id')->nullable();
            $table->longText('payload')->nullable();       // the intended sale (items, discount, tax, contact)
            $table->longText('gateway_response')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payway_transactions');
    }
};
