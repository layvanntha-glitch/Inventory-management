import React, { useState, useEffect, useContext, useRef } from 'react'
import JsBarcode from 'jsbarcode'
import { Barcode, Printer, Search } from 'lucide-react'
import { itemService, settingsService } from '../services/api'
import { LanguageContext } from '../App'
import { formatCurrency } from '../utils/helpers'
import toast from 'react-hot-toast'

export default function Labels() {
  const { t } = useContext(LanguageContext)
  const [products, setProducts] = useState([])
  const [counts, setCounts] = useState({})
  const [search, setSearch] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [store, setStore] = useState('My Store')
  const [labels, setLabels] = useState([])
  const printRef = useRef(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      const [prod, set] = await Promise.all([itemService.getAllProducts(), settingsService.getSettings()])
      setProducts(Array.isArray(prod.data) ? prod.data : (prod.data.data || []))
      if (set.data?.currency) setCurrency(set.data.currency)
      if (set.data?.business_name) setStore(set.data.business_name)
    } catch { toast.error('Failed to load products') }
  }

  // Render barcodes whenever the label set changes.
  useEffect(() => {
    if (!labels.length) return
    labels.forEach((l, i) => {
      const el = document.getElementById(`bc-${i}`)
      if (el && l.sku) {
        try {
          JsBarcode(el, l.sku, { format: 'CODE128', width: 1.6, height: 40, fontSize: 12, margin: 0, displayValue: true })
        } catch { /* invalid value */ }
      }
    })
  }, [labels])

  const setCount = (id, val) => setCounts((prev) => ({ ...prev, [id]: Math.max(0, parseInt(val) || 0) }))

  const generate = () => {
    const list = []
    products.forEach((p) => {
      const n = counts[p.id] || 0
      for (let i = 0; i < n; i++) list.push(p)
    })
    if (!list.length) { toast.error('Set a label quantity for at least one product'); return }
    if (list.length > 200) { toast.error('Max 200 labels at a time'); return }
    setLabels(list)
    setTimeout(() => window.scrollTo({ top: printRef.current?.offsetTop || 0, behavior: 'smooth' }), 100)
  }

  const filtered = products.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-[1600px] mx-auto">
      <div className="no-print">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <Barcode size={28} className="text-sky-600" /> Barcode Labels
        </h1>
        <p className="text-sm text-slate-500 mt-1">Choose how many labels to print per product, then print.</p>
      </div>

      <div className="no-print relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input type="text" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-12" />
      </div>

      <div className="no-print bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-800 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-gray-800 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            <tr><th className="px-6 py-3">Product</th><th className="px-6 py-3">SKU</th><th className="px-6 py-3 text-right">Price</th><th className="px-6 py-3 text-center">Labels</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-gray-800">
            {filtered.map((p) => (
              <tr key={p.id}>
                <td className="px-6 py-3 text-sm font-semibold text-slate-900 dark:text-white">{p.name}</td>
                <td className="px-6 py-3 text-sm text-slate-400 font-mono">{p.sku}</td>
                <td className="px-6 py-3 text-sm text-right">{formatCurrency(p.sell_price, currency)}</td>
                <td className="px-6 py-3 text-center">
                  <input type="number" min="0" value={counts[p.id] || ''} onChange={(e) => setCount(p.id, e.target.value)} placeholder="0" className="w-20 text-center input-field !py-1.5 !px-2" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="no-print flex gap-3">
        <button onClick={generate} className="btn-primary flex items-center gap-2"><Barcode size={18} /> Generate Labels</button>
        {labels.length > 0 && (
          <button onClick={() => window.print()} className="btn-secondary flex items-center gap-2"><Printer size={18} /> Print {labels.length} Labels</button>
        )}
      </div>

      {/* Print area */}
      {labels.length > 0 && (
        <div ref={printRef} id="labels-print-area" className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {labels.map((l, i) => (
              <div key={i} className="border border-slate-200 rounded p-2 text-center break-inside-avoid">
                <p className="text-[11px] font-bold text-slate-900 truncate">{store}</p>
                <p className="text-xs font-semibold text-slate-800 truncate">{l.name}</p>
                <svg id={`bc-${i}`} className="mx-auto"></svg>
                <p className="text-sm font-black text-slate-900">{formatCurrency(l.sell_price, currency)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
