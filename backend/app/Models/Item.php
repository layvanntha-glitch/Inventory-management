<?php

namespace App\Models;

use App\Models\Concerns\BelongsToUser;
use Illuminate\Database\Eloquent\Model;

class Item extends Model
{
    use BelongsToUser;

    protected $fillable = ['name', 'sku', 'description', 'category', 'stock_on_hand', 'reorder_level', 'average_cost', 'cost_price', 'sell_price'];

    protected $casts = [
        'stock_on_hand' => 'integer',
        'reorder_level' => 'integer',
        'average_cost' => 'decimal:2',
        'cost_price' => 'decimal:2',
        'sell_price' => 'decimal:2',
    ];

    public function purchases()
    {
        return $this->belongsToMany(Purchase::class, 'purchase_items')->withPivot('quantity', 'unit_price', 'subtotal');
    }

    public function sales()
    {
        return $this->belongsToMany(Sale::class, 'sale_items')->withPivot('quantity', 'unit_price', 'subtotal');
    }

    public function purchaseItems()
    {
        return $this->hasMany(PurchaseItem::class);
    }

    public function saleItems()
    {
        return $this->hasMany(SaleItem::class);
    }
}
