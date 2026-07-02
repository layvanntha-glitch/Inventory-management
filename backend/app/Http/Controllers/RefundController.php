<?php

namespace App\Http\Controllers;

use App\Models\Refund;
use App\Models\RefundItem;
use App\Models\Sale;
use App\Models\Item;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RefundController extends Controller
{
    public function index()
    {
        return response()->json(
            Refund::with('items.item')->latest()->paginate(20)
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'sale_id' => 'required|exists:sales,id',
            'reason' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.item_id' => 'required|integer',
            'items.*.quantity' => 'required|integer|min:1',
        ]);

        return DB::transaction(function () use ($validated) {
            // Scoped: only the current user's sale can be found.
            $sale = Sale::with('saleItems')->find($validated['sale_id']);
            if (!$sale) {
                return response()->json(['message' => 'Sale not found.'], 404);
            }

            // What was sold, and at what price.
            $sold = [];
            foreach ($sale->saleItems as $si) {
                $sold[$si->item_id] = ['qty' => $si->quantity, 'price' => (float) $si->unit_price];
            }

            // Quantities already refunded for this sale, per item.
            $refundIds = Refund::where('sale_id', $sale->id)->pluck('id');
            $alreadyRefunded = RefundItem::whereIn('refund_id', $refundIds)
                ->select('item_id', DB::raw('SUM(quantity) as q'))
                ->groupBy('item_id')
                ->pluck('q', 'item_id');

            $total = 0;
            $lines = [];
            foreach ($validated['items'] as $ri) {
                $itemId = $ri['item_id'];
                $qty = $ri['quantity'];

                if (!isset($sold[$itemId])) {
                    return response()->json(['message' => 'One of the items was not part of this sale.'], 422);
                }

                $refundable = $sold[$itemId]['qty'] - (int) ($alreadyRefunded[$itemId] ?? 0);
                if ($qty > $refundable) {
                    return response()->json([
                        'message' => "Cannot refund more than was sold (max {$refundable}).",
                    ], 422);
                }

                $price = $sold[$itemId]['price'];
                $subtotal = $qty * $price;
                $total += $subtotal;
                $lines[] = ['item_id' => $itemId, 'quantity' => $qty, 'unit_price' => $price, 'subtotal' => $subtotal];
            }

            $refund = Refund::create([
                'sale_id' => $sale->id,
                'sale_number' => $sale->sale_number,
                'total_amount' => $total,
                'reason' => $validated['reason'] ?? null,
            ]);

            foreach ($lines as $l) {
                RefundItem::create(array_merge(['refund_id' => $refund->id], $l));
                // Return the stock.
                $item = Item::find($l['item_id']);
                if ($item) {
                    $item->stock_on_hand += $l['quantity'];
                    $item->save();
                }
            }

            return response()->json($refund->load('items.item'), 201);
        });
    }
}
