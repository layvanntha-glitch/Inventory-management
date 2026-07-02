<?php

namespace App\Http\Controllers;

use App\Models\Shift;
use App\Models\CashMovement;
use App\Models\Sale;
use App\Models\Refund;
use Illuminate\Http\Request;

class ShiftController extends Controller
{
    /** List closed (historical) shifts. */
    public function index()
    {
        return response()->json(Shift::latest('opened_at')->paginate(20));
    }

    /** The currently open shift (with live summary), or null. */
    public function current()
    {
        $shift = Shift::with('movements')->where('status', 'open')->latest('opened_at')->first();
        return response()->json($shift ? $this->withSummary($shift) : null);
    }

    public function open(Request $request)
    {
        if (Shift::where('status', 'open')->exists()) {
            return response()->json(['message' => 'A shift is already open. Close it first.'], 422);
        }

        $validated = $request->validate(['opening_cash' => 'required|numeric|min:0']);

        $shift = Shift::create([
            'opening_cash' => $validated['opening_cash'],
            'status' => 'open',
            'opened_at' => now(),
        ]);

        return response()->json($this->withSummary($shift->load('movements')), 201);
    }

    public function addMovement(Request $request)
    {
        $shift = Shift::where('status', 'open')->latest('opened_at')->first();
        if (!$shift) {
            return response()->json(['message' => 'No open shift.'], 422);
        }

        $validated = $request->validate([
            'type' => 'required|in:in,out',
            'amount' => 'required|numeric|min:0.01',
            'reason' => 'nullable|string',
        ]);

        CashMovement::create(array_merge(['shift_id' => $shift->id], $validated));

        return response()->json($this->withSummary($shift->fresh()->load('movements')));
    }

    public function close(Request $request)
    {
        $shift = Shift::where('status', 'open')->latest('opened_at')->first();
        if (!$shift) {
            return response()->json(['message' => 'No open shift.'], 422);
        }

        $validated = $request->validate([
            'closing_cash' => 'required|numeric|min:0',
            'note' => 'nullable|string',
        ]);

        $summary = $this->computeSummary($shift);
        $counted = (float) $validated['closing_cash'];

        $shift->update([
            'closing_cash' => $counted,
            'expected_cash' => $summary['expected_cash'],
            'difference' => round($counted - $summary['expected_cash'], 2),
            'status' => 'closed',
            'closed_at' => now(),
            'note' => $validated['note'] ?? null,
        ]);

        return response()->json($this->withSummary($shift->fresh()->load('movements')));
    }

    /**
     * Cash reconciliation for a shift:
     * expected = opening + cash sales + cash in − cash out − cash refunds.
     */
    private function computeSummary(Shift $shift): array
    {
        $end = $shift->closed_at ?? now();

        $cashSales = (float) Sale::where('payment_method', 'cash')
            ->whereBetween('created_at', [$shift->opened_at, $end])
            ->sum('total_amount');

        $cashIn = (float) CashMovement::where('shift_id', $shift->id)->where('type', 'in')->sum('amount');
        $cashOut = (float) CashMovement::where('shift_id', $shift->id)->where('type', 'out')->sum('amount');

        $refunds = (float) Refund::whereBetween('created_at', [$shift->opened_at, $end])->sum('total_amount');

        $expected = (float) $shift->opening_cash + $cashSales + $cashIn - $cashOut - $refunds;

        return [
            'cash_sales' => round($cashSales, 2),
            'cash_in' => round($cashIn, 2),
            'cash_out' => round($cashOut, 2),
            'cash_refunds' => round($refunds, 2),
            'expected_cash' => round($expected, 2),
        ];
    }

    private function withSummary(Shift $shift): array
    {
        return array_merge($shift->toArray(), ['summary' => $this->computeSummary($shift)]);
    }
}
