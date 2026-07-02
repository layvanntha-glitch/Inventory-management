<?php

namespace App\Http\Controllers;

use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Models\Item;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    public function dashboard()
    {
        $today = now()->startOfDay();
        $monthStart = now()->startOfMonth();

        $today_sales = Sale::where('sale_date', '>=', $today)->sum('total_amount');
        $today_purchases = Purchase::where('purchase_date', '>=', $today)->sum('total_amount');
        
        $month_sales = Sale::where('sale_date', '>=', $monthStart)->sum('total_amount');
        $month_purchases = Purchase::where('purchase_date', '>=', $monthStart)->sum('total_amount');
        $low_stock_count = Item::whereRaw('stock_on_hand < reorder_level')->count();

        // Calculate total stock value
        $stock_value = Item::selectRaw('SUM(stock_on_hand * average_cost) as total_value')->value('total_value') ?? 0;

        $sales_trend = Sale::selectRaw('DATE(sale_date) as date, SUM(total_amount) as amount')
            ->where('sale_date', '>=', now()->subDays(30))
            ->groupBy('sale_date')
            ->orderBy('sale_date')
            ->get();

        $top_items = SaleItem::selectRaw('items.name, SUM(sale_items.quantity) as quantity')
            ->join('items', 'items.id', '=', 'sale_items.item_id')
            ->groupBy('items.name', 'sale_items.item_id')
            ->orderByDesc('quantity')
            ->limit(5)
            ->get();

        $low_stock = Item::whereRaw('stock_on_hand < reorder_level')
            ->selectRaw('id, name, stock_on_hand')
            ->get();

        return response()->json([
            'today_sales' => (float) $today_sales,
            'today_purchases' => (float) $today_purchases,
            'stock_value' => (float) $stock_value,
            'low_stock_count' => $low_stock_count,
            'sales_chart' => $sales_trend,
            'top_items' => $top_items,
            'low_stock_items' => $low_stock,
        ]);
    }

    /**
     * Resolve the [start, end] date range from the request, defaulting to the
     * last 12 months. Dates are compared against the business sale/purchase
     * date, not the row insert time.
     */
    private function resolveRange(array $validated): array
    {
        $start = ($validated['start_date'] ?? null)
            ? \Carbon\Carbon::parse($validated['start_date'])->startOfDay()
            : now()->subMonths(12)->startOfDay();

        $end = ($validated['end_date'] ?? null)
            ? \Carbon\Carbon::parse($validated['end_date'])->endOfDay()
            : now()->endOfDay();

        return [$start, $end];
    }

    /**
     * Item Sales Report — quantity sold and revenue, aggregated per item
     * over the selected date range.
     */
    public function itemSales(Request $request)
    {
        $validated = $request->validate([
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
        ]);
        [$start, $end] = $this->resolveRange($validated);

        $rows = SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->join('items', 'items.id', '=', 'sale_items.item_id')
            ->whereBetween('sales.sale_date', [$start, $end])
            ->groupBy('sale_items.item_id', 'items.name', 'items.sku')
            ->selectRaw('sale_items.item_id, items.name as item_name, items.sku,
                         SUM(sale_items.quantity) as total_quantity,
                         SUM(sale_items.subtotal) as total_revenue')
            ->orderByDesc('total_revenue')
            ->get()
            ->map(function ($r) {
                $qty = (float) $r->total_quantity;
                $rev = (float) $r->total_revenue;
                $r->total_quantity = (int) $qty;
                $r->total_revenue = $rev;
                $r->avg_price = $qty > 0 ? round($rev / $qty, 2) : 0;
                return $r;
            });

        return response()->json([
            'summary' => [
                'item_count' => $rows->count(),
                'total_quantity' => (int) $rows->sum('total_quantity'),
                'total_revenue' => (float) $rows->sum('total_revenue'),
            ],
            'rows' => $rows,
        ]);
    }

    /**
     * Item Purchase Report — quantity bought and cost, aggregated per item
     * over the selected date range.
     */
    public function itemPurchases(Request $request)
    {
        $validated = $request->validate([
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
        ]);
        [$start, $end] = $this->resolveRange($validated);

        $rows = PurchaseItem::query()
            ->join('purchases', 'purchases.id', '=', 'purchase_items.purchase_id')
            ->join('items', 'items.id', '=', 'purchase_items.item_id')
            ->whereBetween('purchases.purchase_date', [$start, $end])
            ->groupBy('purchase_items.item_id', 'items.name', 'items.sku')
            ->selectRaw('purchase_items.item_id, items.name as item_name, items.sku,
                         SUM(purchase_items.quantity) as total_quantity,
                         SUM(purchase_items.subtotal) as total_cost')
            ->orderByDesc('total_cost')
            ->get()
            ->map(function ($r) {
                $qty = (float) $r->total_quantity;
                $cost = (float) $r->total_cost;
                $r->total_quantity = (int) $qty;
                $r->total_cost = $cost;
                $r->avg_cost = $qty > 0 ? round($cost / $qty, 2) : 0;
                return $r;
            });

        return response()->json([
            'summary' => [
                'item_count' => $rows->count(),
                'total_quantity' => (int) $rows->sum('total_quantity'),
                'total_cost' => (float) $rows->sum('total_cost'),
            ],
            'rows' => $rows,
        ]);
    }

    /**
     * Profit & Loss — revenue vs. cost of goods sold (COGS) using the
     * simplified average-cost method, plus a combined line-item breakdown.
     */
    public function profitLoss(Request $request)
    {
        $validated = $request->validate([
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
        ]);
        [$start, $end] = $this->resolveRange($validated);

        $revenue = (float) SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->whereBetween('sales.sale_date', [$start, $end])
            ->sum('sale_items.subtotal');

        // COGS = quantity sold × the item's average cost.
        $cogs = (float) (SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->join('items', 'items.id', '=', 'sale_items.item_id')
            ->whereBetween('sales.sale_date', [$start, $end])
            ->selectRaw('SUM(sale_items.quantity * items.average_cost) as c')
            ->value('c') ?? 0);

        $purchaseSpend = (float) PurchaseItem::query()
            ->join('purchases', 'purchases.id', '=', 'purchase_items.purchase_id')
            ->whereBetween('purchases.purchase_date', [$start, $end])
            ->sum('purchase_items.subtotal');

        $gross = $revenue - $cogs;
        $margin = $revenue > 0 ? ($gross / $revenue) * 100 : 0;

        $saleRows = SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->join('items', 'items.id', '=', 'sale_items.item_id')
            ->whereBetween('sales.sale_date', [$start, $end])
            ->selectRaw("sales.sale_date as date, 'sale' as type, items.name as item_name, items.sku,
                         sale_items.quantity, sale_items.unit_price, sale_items.subtotal as amount")
            ->get();

        $purchaseRows = PurchaseItem::query()
            ->join('purchases', 'purchases.id', '=', 'purchase_items.purchase_id')
            ->join('items', 'items.id', '=', 'purchase_items.item_id')
            ->whereBetween('purchases.purchase_date', [$start, $end])
            ->selectRaw("purchases.purchase_date as date, 'purchase' as type, items.name as item_name, items.sku,
                         purchase_items.quantity, purchase_items.unit_price, purchase_items.subtotal as amount")
            ->get();

        $rows = $saleRows->concat($purchaseRows)->sortByDesc('date')->values();

        return response()->json([
            'summary' => [
                'total_revenue' => round($revenue, 2),
                'total_cogs' => round($cogs, 2),
                'gross_profit' => round($gross, 2),
                'profit_margin' => round($margin, 2),
                'total_purchases' => round($purchaseSpend, 2),
            ],
            'rows' => $rows,
        ]);
    }

    /**
     * Stock Report — current stock, valuation and low-stock status per item.
     */
    public function stock()
    {
        $rows = Item::orderBy('name')->get()->map(function ($item) {
            $value = (float) $item->stock_on_hand * (float) $item->average_cost;
            return [
                'id' => $item->id,
                'name' => $item->name,
                'sku' => $item->sku,
                'stock_on_hand' => (int) $item->stock_on_hand,
                'reorder_level' => (int) $item->reorder_level,
                'average_cost' => (float) $item->average_cost,
                'inventory_value' => round($value, 2),
                'status' => $item->stock_on_hand < $item->reorder_level ? 'low' : 'ok',
            ];
        });

        return response()->json([
            'summary' => [
                'total_items' => $rows->count(),
                'low_stock_count' => $rows->where('status', 'low')->count(),
                'total_inventory_value' => round($rows->sum('inventory_value'), 2),
            ],
            'rows' => $rows->values(),
        ]);
    }

    public function salesByDate(Request $request)
    {
        $validated = $request->validate([
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
        ]);

        $start = $validated['start_date'] ?? now()->subDays(30)->toDateString();
        $end = $validated['end_date'] ?? now()->toDateString();

        $data = Sale::selectRaw('DATE(sale_date) as date, COUNT(*) as count, SUM(total_amount) as total')
            ->whereBetween('sale_date', [$start, $end])
            ->groupBy('sale_date')
            ->orderBy('sale_date')
            ->get();

        return response()->json($data);
    }
}
