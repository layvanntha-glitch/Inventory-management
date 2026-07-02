<?php

namespace App\Models\Concerns;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;

/**
 * Scopes a model's data to the authenticated user, giving every account its
 * own isolated workspace.
 *
 * - Reads are automatically filtered to rows owned by the logged-in user.
 * - New rows are automatically stamped with the logged-in user's id.
 *
 * When there is no authenticated user (console commands, seeders, the login
 * request itself) no scoping is applied.
 */
trait BelongsToUser
{
    protected static function bootBelongsToUser(): void
    {
        static::creating(function ($model) {
            if (empty($model->user_id) && Auth::check()) {
                $model->user_id = Auth::id();
            }
        });

        static::addGlobalScope('user', function (Builder $builder) {
            if (Auth::check()) {
                $model = $builder->getModel();
                // Qualify the column so it stays unambiguous inside joins.
                $builder->where($model->getTable() . '.user_id', Auth::id());
            }
        });
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
