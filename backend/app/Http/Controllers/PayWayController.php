<?php

namespace App\Http\Controllers;

use App\Models\PaywayTransaction;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Item;
use App\Services\PayWayService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PayWayController extends Controller
{
    public function __construct(private PayWayService $payway)
    {
    }

    /**
     * Start an ABA PayWay KHQR checkout: returns a QR for the customer to scan.
     * The Sale is NOT created yet — only after ABA confirms payment.
     */
    public function createCheckout(Request $request)
    {
        if (!$this->payway->isConfigured()) {
            return response()->json(['message' => 'ABA PayWay is not configured. Add your keys to the server .env file.'], 422);
        }

        $validated = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.item_id' => 'required|integer',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.name' => 'nullable|string',
            'discount' => 'nullable|numeric|min:0',
            'tax' => 'nullable|numeric|min:0',
            'contact_id' => 'nullable|exists:contacts,id',
            'currency' => 'nullable|in:USD,KHR',
        ]);

        $currency = $validated['currency'] ?? 'USD';
        $subtotal = collect($validated['items'])->sum(fn ($i) => $i['quantity'] * $i['unit_price']);
        $discount = $validated['discount'] ?? 0;
        $tax = $validated['tax'] ?? 0;
        $total = max(0, $subtotal - $discount + $tax);

        if ($total <= 0) {
            return response()->json(['message' => 'Total must be greater than zero.'], 422);
        }

        $tranId = 'TXN' . now()->format('YmdHis') . random_int(1000, 9999);

        $tx = PaywayTransaction::create([
            'tran_id' => $tranId,
            'amount' => $total,
            'currency' => $currency,
            'status' => 'pending',
            'payload' => $validated,
        ]);

        $qr = $this->payway->createKhqr(
            $tranId,
            (float) $total,
            $currency,
            array_map(fn ($i) => [
                'name' => $i['name'] ?? 'Item',
                'quantity' => $i['quantity'],
                'price' => $i['unit_price'],
            ], $validated['items'])
        );

        $tx->update(['gateway_response' => $qr['raw']]);

        if (!$qr['ok']) {
            return response()->json(['message' => $qr['message'] ?? 'Failed to generate QR. Check PayWay credentials.'], 502);
        }

        return response()->json([
            'tran_id' => $tranId,
            'amount' => $total,
            'currency' => $currency,
            'qr_string' => $qr['qr_string'],
            'qr_image' => $qr['qr_image'],
            'deeplink' => $qr['deeplink'],
        ]);
    }

    /**
     * Poll a checkout's status. When ABA reports APPROVED we finalise the Sale
     * (idempotently), decrement stock and return the invoice.
     */
    public function status(Request $request, string $tranId)
    {
        $tx = PaywayTransaction::where('tran_id', $tranId)->first();
        if (!$tx) {
            return response()->json(['message' => 'Transaction not found.'], 404);
        }

        if ($tx->status === 'approved' && $tx->sale_id) {
            return response()->json(['status' => 'approved', 'sale' => Sale::with(['items', 'contact'])->find($tx->sale_id)]);
        }

        $check = $this->payway->checkTransaction($tranId);

        if ($check['approved']) {
            $sale = $this->finalize($tx);
            return response()->json(['status' => 'approved', 'sale' => $sale]);
        }

        return response()->json(['status' => strtolower($check['status'])]);
    }

    /**
     * ABA pushback webhook (public). We record it, but the authenticated status
     * poll + server-to-server check is the source of truth for finalising a sale.
     */
    public function callback(Request $request)
    {
        $tranId = $request->input('tran_id');
        if ($tranId) {
            PaywayTransaction::where('tran_id', $tranId)->update(['gateway_response' => $request->all()]);
        }
        return response()->json(['ok' => true]);
    }

    private function finalize(PaywayTransaction $tx): Sale
    {
        return DB::transaction(function () use ($tx) {
            if ($tx->sale_id) {
                return Sale::with(['items', 'contact'])->find($tx->sale_id);
            }

            $p = $tx->payload;
            $subtotal = collect($p['items'])->sum(fn ($i) => $i['quantity'] * $i['unit_price']);
            $discount = $p['discount'] ?? 0;
            $tax = $p['tax'] ?? 0;
            $total = max(0, $subtotal - $discount + $tax);

            $sale = Sale::create([
                'sale_number' => 'SAL-' . now()->format('YmdHis') . '-' . random_int(100, 999),
                'contact_id' => $p['contact_id'] ?? null,
                'sale_date' => now()->toDateString(),
                'due_date' => now()->toDateString(),
                'total_amount' => $total,
                'discount' => $discount,
                'tax' => $tax,
                'paid_amount' => $total,
                'payment_method' => 'aba_payway',
                'status' => 'completed',
                'payment_status' => 'paid',
            ]);

            foreach ($p['items'] as $item) {
                SaleItem::create([
                    'sale_id' => $sale->id,
                    'item_id' => $item['item_id'],
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['unit_price'],
                    'subtotal' => $item['quantity'] * $item['unit_price'],
                ]);

                $record = Item::find($item['item_id']); // scoped to the cashier's user
                if ($record) {
                    $record->stock_on_hand -= $item['quantity'];
                    $record->save();
                }
            }

            $tx->update(['status' => 'approved', 'sale_id' => $sale->id]);

            return $sale->load(['items', 'contact']);
        });
    }
}
