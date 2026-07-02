<?php

namespace App\Models;

use App\Models\Concerns\BelongsToUser;
use Illuminate\Database\Eloquent\Model;

class PaywayTransaction extends Model
{
    use BelongsToUser;

    protected $fillable = ['tran_id', 'amount', 'currency', 'status', 'sale_id', 'payload', 'gateway_response'];

    protected $casts = [
        'amount' => 'decimal:2',
        'payload' => 'array',
        'gateway_response' => 'array',
    ];
}
