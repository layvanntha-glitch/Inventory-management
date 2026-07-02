<?php

namespace App\Models;

use App\Models\Concerns\BelongsToUser;
use Illuminate\Database\Eloquent\Model;

class RefundItem extends Model
{
    use BelongsToUser;

    protected $fillable = ['refund_id', 'item_id', 'quantity', 'unit_price', 'subtotal'];

    protected $casts = [
        'quantity' => 'integer',
        'unit_price' => 'decimal:2',
        'subtotal' => 'decimal:2',
    ];

    public function refund()
    {
        return $this->belongsTo(Refund::class);
    }

    public function item()
    {
        return $this->belongsTo(Item::class);
    }
}
