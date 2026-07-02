<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Gives every account its own isolated data by adding an owning user_id to
 * each data table. Existing rows are assigned to the master admin so the
 * current workspace is preserved, and new accounts start empty.
 */
return new class extends Migration
{
    private array $tables = [
        'contacts',
        'items',
        'purchases',
        'purchase_items',
        'sales',
        'sale_items',
        'settings',
    ];

    public function up(): void
    {
        // The master admin inherits all pre-existing data.
        $ownerId = DB::table('users')->where('role', 'master_admin')->orderBy('id')->value('id')
            ?? DB::table('users')->orderBy('id')->value('id');

        foreach ($this->tables as $table) {
            if (! Schema::hasColumn($table, 'user_id')) {
                Schema::table($table, function (Blueprint $t) {
                    $t->unsignedBigInteger('user_id')->nullable()->index()->after('id');
                });
            }

            if ($ownerId) {
                DB::table($table)->whereNull('user_id')->update(['user_id' => $ownerId]);
            }
        }

        // Settings become per-user: the key is no longer globally unique,
        // it is unique per (user_id, key) instead.
        Schema::table('settings', function (Blueprint $t) {
            $t->dropUnique('settings_key_unique');
            $t->unique(['user_id', 'key']);
        });
    }

    public function down(): void
    {
        Schema::table('settings', function (Blueprint $t) {
            $t->dropUnique(['user_id', 'key']);
            $t->unique('key');
        });

        foreach ($this->tables as $table) {
            if (Schema::hasColumn($table, 'user_id')) {
                Schema::table($table, function (Blueprint $t) {
                    $t->dropColumn('user_id');
                });
            }
        }
    }
};
