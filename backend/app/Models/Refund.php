<?php

namespace App\Models;

use App\Models\Concerns\BelongsToUser;
use Illuminate\Database\Eloquent\Model;

class Refund extends Model
{
    use BelongsToUser;

    protected $fillable = ['sale_id', 'sale_number', 'total_amount', 'reason'];

    protected $casts = [
        'total_amount' => 'decimal:2',
    ];

    public function items()
    {
        return $this->hasMany(RefundItem::class);
    }

    public function sale()
    {
        return $this->belongsTo(Sale::class);
    }
}
