<?php

namespace App\Models;

use App\Models\Concerns\BelongsToUser;
use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    use BelongsToUser;

    // Settings are per-user, so the row id is the primary key and the
    // "key" column is only unique within a single user's settings.
    protected $fillable = ['key', 'value', 'type', 'description'];
}
