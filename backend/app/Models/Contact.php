<?php

namespace App\Models;

use App\Models\Concerns\BelongsToUser;
use Illuminate\Database\Eloquent\Model;

class Contact extends Model
{
    use BelongsToUser;

    protected $fillable = ['name', 'email', 'phone', 'address', 'note', 'type', 'active'];

    public function purchases()
    {
        return $this->hasMany(Purchase::class);
    }

    public function sales()
    {
        return $this->hasMany(Sale::class);
    }
}
