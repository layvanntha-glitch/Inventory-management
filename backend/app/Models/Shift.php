<?php

namespace App\Models;

use App\Models\Concerns\BelongsToUser;
use Illuminate\Database\Eloquent\Model;

class Shift extends Model
{
    use BelongsToUser;

    protected $fillable = ['opening_cash', 'closing_cash', 'expected_cash', 'difference', 'status', 'note', 'opened_at', 'closed_at'];

    protected $casts = [
        'opening_cash' => 'decimal:2',
        'closing_cash' => 'decimal:2',
        'expected_cash' => 'decimal:2',
        'difference' => 'decimal:2',
        'opened_at' => 'datetime',
        'closed_at' => 'datetime',
    ];

    public function movements()
    {
        return $this->hasMany(CashMovement::class);
    }
}
