<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * SKUs only need to be unique within a single user's workspace, so replace the
 * global unique index on items.sku with a per-user composite unique index.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('items', function (Blueprint $table) {
            $table->dropUnique('items_sku_unique');
            $table->unique(['user_id', 'sku']);
        });
    }

    public function down(): void
    {
        Schema::table('items', function (Blueprint $table) {
            $table->dropUnique(['user_id', 'sku']);
            $table->unique('sku');
        });
    }
};
