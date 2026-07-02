import React, { useState, useEffect, useContext } from 'react'
import {
  PieChart,
  TrendingUp,
  ShoppingBag,
  ShoppingCart,
  Package,
  Download,
  Printer,
  Calendar,
  Filter,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react'
import { reportService } from '../services/api'
import { LanguageContext } from '../App'
import { formatCurrency, formatDate } from '../utils/helpers'
import toast from 'react-hot-toast'

const REPORT_TYPES = [
  { id: 'profit_loss', label: 'Profit & Loss', icon: TrendingUp, needsDate: true },
  { id: 'item_sales', label: 'Item Sales', icon: ShoppingBag, needsDate: true },
  { id: 'item_purchases', label: 'Item Purchases', icon: ShoppingCart, needsDate: true },
  { id: 'stock', label: 'Stock', icon: Package, needsDate: false },
]

const SummaryCard = ({ title, value, icon: Icon, color }) => (
  <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-slate-200 dark:border-gray-800 shadow-sm">
    <div className={`inline-flex p-2.5 rounded-lg ${color} bg-opacity-10 mb-4`}>
      <Icon size={24} className={color.replace('bg-', 'text-')} />
    </div>
    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
    <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{value}</h3>
  </div>
)

export default function Reports() {
  const { t } = useContext(LanguageContext)
  const [report, setReport] = useState('profit_loss')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    start_date: new Date(new Date().setDate(new Date().getDate() - 365)).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
  })

  const activeType = REPORT_TYPES.find((r) => r.id === report)

  useEffect(() => {
    fetchReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report])

  const fetchReport = async () => {
    setLoading(true)
    try {
      const params = { start_date: dateRange.start_date, end_date: dateRange.end_date }
      let res
      if (report === 'profit_loss') res = await reportService.getProfitLoss(params)
      else if (report === 'item_sales') res = await reportService.getItemSales(params)
      else if (report === 'item_purchases') res = await reportService.getItemPurchases(params)
      else res = await reportService.getStock()
      setData(res.data)
    } catch (e) {
      toast.error(t.failed_report || 'Failed to generate report')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  // ---- Per-report presentation config -------------------------------------
  const getSummaryCards = () => {
    if (!data) return []
    const s = data.summary || {}
    switch (report) {
      case 'profit_loss':
        return [
          { title: 'Revenue', value: formatCurrency(s.total_revenue), icon: ShoppingBag, color: 'bg-emerald-500' },
          { title: 'Cost of Goods Sold', value: formatCurrency(s.total_cogs), icon: ShoppingCart, color: 'bg-sky-500' },
          { title: 'Gross Profit', value: formatCurrency(s.gross_profit), icon: TrendingUp, color: 'bg-indigo-500' },
          { title: 'Profit Margin', value: `${s.profit_margin ?? 0}%`, icon: PieChart, color: 'bg-amber-500' },
        ]
      case 'item_sales':
        return [
          { title: 'Items Sold', value: s.item_count ?? 0, icon: Package, color: 'bg-sky-500' },
          { title: 'Total Quantity', value: s.total_quantity ?? 0, icon: ShoppingBag, color: 'bg-indigo-500' },
          { title: 'Total Revenue', value: formatCurrency(s.total_revenue), icon: TrendingUp, color: 'bg-emerald-500' },
        ]
      case 'item_purchases':
        return [
          { title: 'Items Bought', value: s.item_count ?? 0, icon: Package, color: 'bg-sky-500' },
          { title: 'Total Quantity', value: s.total_quantity ?? 0, icon: ShoppingCart, color: 'bg-indigo-500' },
          { title: 'Total Cost', value: formatCurrency(s.total_cost), icon: TrendingUp, color: 'bg-amber-500' },
        ]
      case 'stock':
        return [
          { title: 'Total Items', value: s.total_items ?? 0, icon: Package, color: 'bg-sky-500' },
          { title: 'Low Stock', value: s.low_stock_count ?? 0, icon: AlertTriangle, color: 'bg-rose-500' },
          { title: 'Inventory Value', value: formatCurrency(s.total_inventory_value), icon: TrendingUp, color: 'bg-emerald-500' },
        ]
      default:
        return []
    }
  }

  const getColumns = () => {
    switch (report) {
      case 'profit_loss':
        return [
          { label: t.table_date || 'Date', value: (r) => formatDate(r.date) },
          {
            label: t.table_type || 'Type',
            value: (r) => (r.type === 'sale' ? (t.type_sale || 'Sale') : (t.type_purchase || 'Purchase')),
            render: (r) => (
              <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase ${r.type === 'sale' ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'}`}>
                {r.type === 'sale' ? (t.type_sale || 'Sale') : (t.type_purchase || 'Purchase')}
              </span>
            ),
          },
          { label: t.table_item || 'Item', value: (r) => r.item_name || `#${r.item_id}` },
          { label: 'SKU', value: (r) => r.sku || '-' },
          { label: t.table_qty || 'Qty', align: 'center', value: (r) => r.quantity },
          { label: t.table_price || 'Unit Price', align: 'right', value: (r) => formatCurrency(r.unit_price) },
          { label: t.table_total || 'Amount', align: 'right', bold: true, value: (r) => formatCurrency(r.amount) },
        ]
      case 'item_sales':
        return [
          { label: t.table_item || 'Item', value: (r) => r.item_name },
          { label: 'SKU', value: (r) => r.sku || '-' },
          { label: 'Qty Sold', align: 'center', value: (r) => r.total_quantity },
          { label: 'Avg Price', align: 'right', value: (r) => formatCurrency(r.avg_price) },
          { label: 'Revenue', align: 'right', bold: true, value: (r) => formatCurrency(r.total_revenue) },
        ]
      case 'item_purchases':
        return [
          { label: t.table_item || 'Item', value: (r) => r.item_name },
          { label: 'SKU', value: (r) => r.sku || '-' },
          { label: 'Qty Bought', align: 'center', value: (r) => r.total_quantity },
          { label: 'Avg Cost', align: 'right', value: (r) => formatCurrency(r.avg_cost) },
          { label: 'Total Cost', align: 'right', bold: true, value: (r) => formatCurrency(r.total_cost) },
        ]
      case 'stock':
        return [
          { label: t.table_item || 'Item', value: (r) => r.name },
          { label: 'SKU', value: (r) => r.sku || '-' },
          { label: 'Stock', align: 'center', value: (r) => r.stock_on_hand },
          { label: 'Reorder', align: 'center', value: (r) => r.reorder_level },
          { label: 'Avg Cost', align: 'right', value: (r) => formatCurrency(r.average_cost) },
          { label: 'Value', align: 'right', bold: true, value: (r) => formatCurrency(r.inventory_value) },
          {
            label: 'Status',
            align: 'center',
            value: (r) => (r.status === 'low' ? 'Low' : 'OK'),
            render: (r) => (
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${r.status === 'low' ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                {r.status === 'low' ? 'Low' : 'OK'}
              </span>
            ),
          },
        ]
      default:
        return []
    }
  }

  const rows = data?.rows || []
  const columns = getColumns()
  const summaryCards = getSummaryCards()

  const exportCSV = () => {
    if (!rows.length) {
      toast.error('No data to export')
      return
    }
    const header = columns.map((c) => `"${c.label}"`).join(',')
    const lines = rows.map((r) =>
      columns
        .map((c) => {
          // Use the plain value accessor; fall back to a sensible field for render-only cols.
          const raw = c.value ? c.value(r) : (r.type ?? r.status ?? '')
          return `"${String(raw).replace(/"/g, '""')}"`
        })
        .join(',')
    )
    const csv = [header, ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${report}_${dateRange.start_date}_to_${dateRange.end_date}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const align = (a) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left')

  return (
    <div className="p-6 space-y-8 animate-fade-in max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <PieChart size={28} className="text-sky-600" />
            {t.reports_title || 'Reports'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{t.reports_desc || 'Analyze your business performance.'}</p>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          {activeType?.needsDate && (
            <div className="flex flex-wrap gap-3 p-1 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl shadow-sm">
              <div className="flex items-center gap-2 px-3 py-2">
                <Calendar size={16} className="text-slate-400" />
                <input
                  type="date"
                  value={dateRange.start_date}
                  onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })}
                  className="bg-transparent border-none text-xs font-bold focus:ring-0 outline-none text-slate-600 dark:text-gray-300"
                />
              </div>
              <div className="flex items-center border-l border-slate-100 dark:border-gray-800 px-3 py-2">
                <ArrowRight size={14} className="text-slate-300 mr-2" />
                <input
                  type="date"
                  value={dateRange.end_date}
                  onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })}
                  className="bg-transparent border-none text-xs font-bold focus:ring-0 outline-none text-slate-600 dark:text-gray-300"
                />
              </div>
            </div>
          )}
          <button onClick={fetchReport} className="btn-primary flex items-center gap-2 text-xs !py-2.5 px-6">
            <Filter size={14} /> {t.generate_report || 'Generate'}
          </button>
        </div>
      </div>

      {/* Report type tabs */}
      <div className="flex flex-wrap gap-2 no-print">
        {REPORT_TYPES.map((rt) => {
          const active = rt.id === report
          return (
            <button
              key={rt.id}
              onClick={() => setReport(rt.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all border
                ${active
                  ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                  : 'bg-white dark:bg-gray-900 text-slate-500 dark:text-gray-400 border-slate-200 dark:border-gray-800 hover:text-slate-900 dark:hover:text-white'}`}
            >
              <rt.icon size={16} />
              {rt.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="text-center py-20 no-print">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-600 mx-auto mb-4"></div>
          <p className="text-sm font-medium text-slate-400">{t.generating || 'Generating...'}</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 no-print">
            {summaryCards.map((c, i) => (
              <SummaryCard key={i} {...c} />
            ))}
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between no-print">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              {activeType?.label} — {rows.length} {t.records || 'Records'}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={exportCSV}
                className="p-2.5 bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-300 rounded-lg hover:bg-emerald-50 hover:text-emerald-600 transition-colors border border-slate-200 dark:border-gray-700"
                title="Export CSV"
              >
                <Download size={18} />
              </button>
              <button
                onClick={() => window.print()}
                className="p-2.5 bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-300 rounded-lg hover:bg-sky-50 hover:text-sky-600 transition-colors border border-slate-200 dark:border-gray-700"
                title="Print"
              >
                <Printer size={18} />
              </button>
            </div>
          </div>

          {/* Data table */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-800 overflow-hidden shadow-sm no-print">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-gray-800 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-gray-800">
                  <tr>
                    {columns.map((c, i) => (
                      <th key={i} className={`px-6 py-3 ${align(c.align)}`}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-gray-800">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="px-6 py-16 text-center text-sm font-medium text-slate-400">
                        {t.no_results || 'No data for this period'}
                      </td>
                    </tr>
                  ) : (
                    rows.map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors">
                        {columns.map((c, i) => (
                          <td
                            key={i}
                            className={`px-6 py-4 text-sm ${align(c.align)} ${c.bold ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-gray-300'}`}
                          >
                            {c.render ? c.render(r) : c.value(r)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Print area */}
          <div id="report-print-area" className="hidden print:block p-10 bg-white text-slate-900">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tighter">{activeType?.label} {t.reports_title || 'Report'}</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">{t.inventory_title || 'Inventory Pro'}</p>
              </div>
              <div className="text-right">
                {activeType?.needsDate && (
                  <p className="text-lg font-black tracking-tight">{dateRange.start_date} → {dateRange.end_date}</p>
                )}
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-widest">
                  {t.generated_on || 'Generated'}: {new Date().toLocaleString()}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-8">
              {summaryCards.map((c, i) => (
                <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{c.title}</p>
                  <p className="text-lg font-black text-slate-900">{c.value}</p>
                </div>
              ))}
            </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  {columns.map((c, i) => (
                    <th key={i} className={`px-4 py-3 text-[10px] uppercase font-bold tracking-widest ${align(c.align)}`}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 border border-slate-100">
                {rows.map((r, idx) => (
                  <tr key={idx}>
                    {columns.map((c, i) => (
                      <td key={i} className={`px-4 py-3 text-xs ${align(c.align)} ${c.bold ? 'font-black' : ''}`}>
                        {c.render ? (c.value ? c.value(r) : '') : c.value(r)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
