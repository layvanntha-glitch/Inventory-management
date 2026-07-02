<?php

namespace App\Http\Controllers;

use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Item;
use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SaleController extends Controller
{
    public function index(Request $request)
    {
        $query = Sale::with(['contact', 'items']);

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('payment_status')) {
            $query->where('payment_status', $request->payment_status);
        }

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('sale_number', 'like', "%$search%")
                  ->orWhereHas('contact', function ($c) use ($search) {
                      $c->where('name', 'like', "%$search%");
                  });
            });
        }

        return response()->json($query->paginate(20));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'contact_id' => 'nullable|exists:contacts,id',
            'sale_date' => 'required|date',
            'due_date' => 'nullable|date',
            'items' => 'required|array|min:1',
            'items.*.item_id' => 'required|exists:items,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'discount' => 'nullable|numeric|min:0',
            'tax' => 'nullable|numeric|min:0',
            'paid_amount' => 'nullable|numeric|min:0',
            'payment_method' => 'nullable|string',
            'status' => 'nullable|in:pending,completed,cancelled',
            'payment_status' => 'nullable|in:pending,unpaid,partial,paid',
            'note' => 'nullable|string',
        ]);

        return DB::transaction(function () use ($validated) {
            $blockNegativeStock = Setting::where('key', 'block_negative_stock')->value('value') === 'true';

            // Check stock availability first
            foreach ($validated['items'] as $item) {
                $itemRecord = Item::find($item['item_id']);
                if (!$itemRecord) {
                    return response()->json(['message' => 'Item not found in your inventory.'], 422);
                }
                if ($blockNegativeStock && $itemRecord->stock_on_hand < $item['quantity']) {
                    return response()->json([
                        'message' => 'Insufficient stock: ' . $itemRecord->name,
                        'item' => $itemRecord->name,
                        'requested' => $item['quantity'],
                        'available' => $itemRecord->stock_on_hand,
                    ], 422);
                }
            }

            $subtotal = 0;
            foreach ($validated['items'] as $item) {
                $subtotal += $item['quantity'] * $item['unit_price'];
            }

            $discount = $validated['discount'] ?? 0;
            $tax = $validated['tax'] ?? 0;
            $total = max(0, $subtotal - $discount + $tax);
            $paid = $validated['paid_amount'] ?? 0;

            // Never record over-payment (cash tendered) as amount paid.
            $paidRecorded = min($paid, $total);

            $paymentStatus = $validated['payment_status']
                ?? ($paidRecorded >= $total && $total > 0 ? 'paid' : ($paidRecorded > 0 ? 'partial' : 'pending'));

            $sale = Sale::create([
                'sale_number' => 'SAL-' . date('YmdHis') . '-' . random_int(100, 999),
                'contact_id' => $validated['contact_id'] ?? null,
                'sale_date' => $validated['sale_date'],
                'due_date' => $validated['due_date'] ?? $validated['sale_date'],
                'total_amount' => $total,
                'discount' => $discount,
                'tax' => $tax,
                'paid_amount' => $paidRecorded,
                'payment_method' => $validated['payment_method'] ?? 'cash',
                'status' => $validated['status'] ?? 'pending',
                'payment_status' => $paymentStatus,
                'note' => $validated['note'] ?? null,
            ]);

            foreach ($validated['items'] as $item) {
                SaleItem::create([
                    'sale_id' => $sale->id,
                    'item_id' => $item['item_id'],
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['unit_price'],
                    'subtotal' => $item['quantity'] * $item['unit_price'],
                ]);

                $itemRecord = Item::find($item['item_id']);
                $itemRecord->stock_on_hand -= $item['quantity'];
                $itemRecord->save();
            }

            return response()->json($sale->load(['items', 'contact']), 201);
        });
    }

    public function show($id)
    {
        $sale = Sale::with(['contact', 'items'])->findOrFail($id);
        return response()->json($sale);
    }

    public function update(Request $request, $id)
    {
        $sale = Sale::findOrFail($id);

        $validated = $request->validate([
            'status' => 'in:pending,completed,cancelled',
            'payment_status' => 'in:pending,partial,paid',
            'paid_amount' => 'nullable|numeric|min:0',
            'note' => 'nullable|string',
        ]);

        $sale->update($validated);
        return response()->json($sale);
    }

    public function destroy($id)
    {
        return DB::transaction(function () use ($id) {
            $sale = Sale::find($id);

            foreach ($sale->items as $item) {
                $item->stock_on_hand += $item->pivot->quantity;
                $item->save();
            }

            $sale->delete();
            return response()->json(['message' => 'Deleted successfully']);
        });
    }
}
