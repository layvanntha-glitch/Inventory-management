<?php

namespace App\Models;

use App\Models\Concerns\BelongsToUser;
use Illuminate\Database\Eloquent\Model;

class CashMovement extends Model
{
    use BelongsToUser;

    protected $fillable = ['shift_id', 'type', 'amount', 'reason'];

    protected $casts = [
        'amount' => 'decimal:2',
    ];

    public function shift()
    {
        return $this->belongsTo(Shift::class);
    }
}
