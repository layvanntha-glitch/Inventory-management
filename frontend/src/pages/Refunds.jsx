import React, { useState, useEffect, useContext } from 'react'
import { RotateCcw, Search, Undo2, PackageCheck } from 'lucide-react'
import { saleService, refundService, settingsService } from '../services/api'
import { LanguageContext } from '../App'
import { formatCurrency, formatDate } from '../utils/helpers'
import toast from 'react-hot-toast'

export default function Refunds() {
  const { t } = useContext(LanguageContext)
  const [search, setSearch] = useState('')
  const [sales, setSales] = useState([])
  const [selected, setSelected] = useState(null)
  const [qtys, setQtys] = useState({})
  const [reason, setReason] = useState('')
  const [refunds, setRefunds] = useState([])
  const [currency, setCurrency] = useState('USD')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadRefunds()
    settingsService.getSettings().then((r) => r.data?.currency && setCurrency(r.data.currency)).catch(() => {})
  }, [])

  const loadRefunds = async () => {
    try {
      const res = await refundService.getAll()
      setRefunds(res.data.data ? res.data.data : res.data)
    } catch { /* ignore */ }
  }

  const doSearch = async () => {
    if (!search.trim()) return
    setLoading(true)
    try {
      const res = await saleService.getAll({ search })
      setSales(res.data.data ? res.data.data : res.data)
    } catch {
      toast.error('Search failed')
    } finally {
      setLoading(false)
    }
  }

  const selectSale = (sale) => {
    setSelected(sale)
    const init = {}
    ;(sale.items || []).forEach((it) => { init[it.id] = 0 })
    setQtys(init)
    setReason('')
  }

  const soldQty = (it) => it.pivot?.quantity ?? it.quantity ?? 0
  const unitPrice = (it) => Number(it.pivot?.unit_price ?? it.unit_price ?? it.sell_price ?? 0)

  const refundTotal = selected
    ? (selected.items || []).reduce((sum, it) => sum + (Number(qtys[it.id]) || 0) * unitPrice(it), 0)
    : 0

  const setQty = (id, val, max) => {
    let q = parseInt(val) || 0
    q = Math.max(0, Math.min(q, max))
    setQtys((prev) => ({ ...prev, [id]: q }))
  }

  const process = async () => {
    const items = (selected.items || [])
      .filter((it) => (Number(qtys[it.id]) || 0) > 0)
      .map((it) => ({ item_id: it.id, quantity: Number(qtys[it.id]) }))
    if (!items.length) { toast.error('Select at least one item to return'); return }

    setSubmitting(true)
    try {
      await refundService.create({ sale_id: selected.id, reason, items })
      toast.success('Refund processed & stock restored')
      setSelected(null)
      setQtys({})
      setReason('')
      loadRefunds()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Refund failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <RotateCcw size={28} className="text-sky-600" /> Refunds & Returns
        </h1>
        <p className="text-sm text-slate-500 mt-1">Look up a sale, return items and restock automatically.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lookup + process */}
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search by receipt # or customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doSearch()}
                className="input-field pl-12"
              />
            </div>
            <button onClick={doSearch} className="btn-primary px-6">Search</button>
          </div>

          {/* Search results */}
          {!selected && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-800 divide-y divide-slate-50 dark:divide-gray-800 overflow-hidden">
              {loading ? (
                <div className="p-8 text-center text-slate-400 text-sm">Searching...</div>
              ) : sales.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">No sales found. Search above.</div>
              ) : (
                sales.map((s) => (
                  <button key={s.id} onClick={() => selectSale(s)} className="w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-gray-800/50 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white text-sm">{s.sale_number}</p>
                      <p className="text-xs text-slate-400">{formatDate(s.sale_date)} · {s.contact?.name || 'Walk-in'}</p>
                    </div>
                    <span className="font-black text-sky-600">{formatCurrency(s.total_amount, currency)}</span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Selected sale return form */}
          {selected && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-800 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{selected.sale_number}</p>
                  <p className="text-xs text-slate-400">{formatDate(selected.sale_date)} · {selected.contact?.name || 'Walk-in'}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase">Back</button>
              </div>

              <div className="space-y-2">
                {(selected.items || []).map((it) => (
                  <div key={it.id} className="flex items-center gap-3 bg-slate-50 dark:bg-gray-800/50 rounded-lg p-3">
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{it.name}</p>
                      <p className="text-xs text-slate-400">Sold: {soldQty(it)} × {formatCurrency(unitPrice(it), currency)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Return</span>
                      <input
                        type="number"
                        min="0"
                        max={soldQty(it)}
                        value={qtys[it.id] ?? 0}
                        onChange={(e) => setQty(it.id, e.target.value, soldQty(it))}
                        className="w-16 text-center input-field !py-1.5 !px-2"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <input
                type="text"
                placeholder="Reason (optional)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="input-field"
              />

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-gray-800">
                <span className="text-sm font-bold text-slate-500">Refund Total</span>
                <span className="text-xl font-black text-rose-600">{formatCurrency(refundTotal, currency)}</span>
              </div>

              <button onClick={process} disabled={submitting || refundTotal <= 0} className="w-full btn-primary !bg-rose-600 hover:!bg-rose-700 !py-3.5 flex items-center justify-center gap-2 disabled:opacity-40">
                <Undo2 size={18} /> {submitting ? 'Processing...' : 'Process Refund'}
              </button>
            </div>
          )}
        </div>

        {/* Recent refunds */}
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <PackageCheck size={16} /> Recent Refunds
          </h3>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-800 divide-y divide-slate-50 dark:divide-gray-800 overflow-hidden">
            {refunds.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">No refunds yet.</div>
            ) : (
              refunds.map((r) => (
                <div key={r.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">{r.sale_number}</p>
                    <p className="text-xs text-slate-400">
                      {formatDate(r.created_at)} · {(r.items || []).reduce((s, i) => s + i.quantity, 0)} item(s)
                      {r.reason ? ` · ${r.reason}` : ''}
                    </p>
                  </div>
                  <span className="font-black text-rose-600">-{formatCurrency(r.total_amount, currency)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
