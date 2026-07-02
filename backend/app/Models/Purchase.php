<?php

namespace App\Models;

use App\Models\Concerns\BelongsToUser;
use Illuminate\Database\Eloquent\Model;

class Purchase extends Model
{
    use BelongsToUser;

    protected $fillable = ['purchase_number', 'contact_id', 'purchase_date', 'due_date', 'total_amount', 'status', 'note'];

    protected $casts = [
        'purchase_date' => 'datetime',
        'due_date' => 'datetime',
        'total_amount' => 'decimal:2',
    ];

    public function contact()
    {
        return $this->belongsTo(Contact::class);
    }

    public function items()
    {
        return $this->belongsToMany(Item::class, 'purchase_items')->withPivot('quantity', 'unit_price', 'subtotal');
    }

    public function purchaseItems()
    {
        return $this->hasMany(PurchaseItem::class);
    }
}
