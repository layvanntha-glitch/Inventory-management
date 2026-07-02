<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // master_admin | admin | staff
            $table->string('role')->default('staff')->after('password');
            $table->boolean('active')->default(true)->after('role');
        });

        // Promote the bootstrap admin (or the very first account) to master_admin
        // so the system is never left without a top-level administrator.
        $promoted = DB::table('users')->where('email', 'admin@example.com')->update(['role' => 'master_admin']);

        if (! $promoted) {
            $first = DB::table('users')->orderBy('id')->first();
            if ($first) {
                DB::table('users')->where('id', $first->id)->update(['role' => 'master_admin']);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['role', 'active']);
        });
    }
};
