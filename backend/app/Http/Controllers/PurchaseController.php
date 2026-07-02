<?php

namespace App\Http\Controllers;

use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Models\Item;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PurchaseController extends Controller
{
    public function index(Request $request)
    {
        $query = Purchase::with(['contact', 'items']);

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('search')) {
            $search = $request->search;
            $query->whereHas('contact', function ($q) use ($search) {
                $q->where('name', 'like', "%$search%");
            });
        }

        return response()->json($query->paginate(20));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'contact_id' => 'required|exists:contacts,id',
            'purchase_date' => 'required|date',
            'due_date' => 'required|date',
            'items' => 'required|array|min:1',
            'items.*.item_id' => 'required|exists:items,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'note' => 'nullable|string',
        ]);

        return DB::transaction(function () use ($validated) {
            $totalAmount = 0;

            $purchase = Purchase::create([
                'purchase_number' => 'PUR-' . date('YmdHis'),
                'contact_id' => $validated['contact_id'],
                'purchase_date' => $validated['purchase_date'],
                'due_date' => $validated['due_date'],
                'total_amount' => 0,
                'status' => 'pending',
                'note' => $validated['note'] ?? null,
            ]);

            foreach ($validated['items'] as $item) {
                $subtotal = $item['quantity'] * $item['unit_price'];
                $totalAmount += $subtotal;

                PurchaseItem::create([
                    'purchase_id' => $purchase->id,
                    'item_id' => $item['item_id'],
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['unit_price'],
                    'subtotal' => $subtotal,
                ]);

                // Update item stock
                $itemRecord = Item::find($item['item_id']);
                $oldQuantity = $itemRecord->stock_on_hand;
                $newQuantity = $oldQuantity + $item['quantity'];
                
                // Update average cost using weighted average
                if ($oldQuantity > 0) {
                    $itemRecord->average_cost = (($itemRecord->average_cost * $oldQuantity) + ($item['unit_price'] * $item['quantity'])) / $newQuantity;
                } else {
                    $itemRecord->average_cost = $item['unit_price'];
                }

                $itemRecord->stock_on_hand = $newQuantity;
                $itemRecord->save();
            }

            $purchase->total_amount = $totalAmount;
            $purchase->save();

            return response()->json($purchase->load('items'), 201);
        });
    }

    public function show($id)
    {
        $purchase = Purchase::with(['contact', 'items'])->findOrFail($id);
        return response()->json($purchase);
    }

    public function update(Request $request, $id)
    {
        $purchase = Purchase::findOrFail($id);

        $validated = $request->validate([
            'status' => 'in:pending,completed,cancelled',
            'note' => 'nullable|string',
        ]);

        $purchase->update($validated);
        return response()->json($purchase);
    }

    public function destroy($id)
    {
        return DB::transaction(function () use ($id) {
            $purchase = Purchase::find($id);

            foreach ($purchase->items as $item) {
                $item->stock_on_hand -= $item->pivot->quantity;
                $item->save();
            }

            $purchase->delete();
            return response()->json(['message' => 'Deleted successfully']);
        });
    }
}
