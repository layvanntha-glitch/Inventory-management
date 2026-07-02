import React, { useState, useEffect, useContext, useMemo, useRef } from 'react'
import {
  Search, Plus, Minus, Trash2, X, CreditCard, Banknote,
  ShoppingCart, Printer, CheckCircle2, User, Package, ScanLine,
  Pause, Layers, QrCode, Loader2,
} from 'lucide-react'
import QRCode from 'qrcode'
import { itemService, contactService, saleService, settingsService, paywayService } from '../services/api'
import { LanguageContext } from '../App'
import { AuthContext } from '../context/AuthContext'
import { formatCurrency } from '../utils/helpers'
import toast from 'react-hot-toast'

export default function POS() {
  const { t } = useContext(LanguageContext)
  const { user } = useContext(AuthContext)

  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [settings, setSettings] = useState({ currency: 'USD', tax_rate: 0, business_name: 'My Store' })
  const [loading, setLoading] = useState(true)

  const [cart, setCart] = useState([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [customerId, setCustomerId] = useState('')
  const [discount, setDiscount] = useState(0)

  const [payOpen, setPayOpen] = useState(false)
  const [method, setMethod] = useState('cash')
  const [tendered, setTendered] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [receipt, setReceipt] = useState(null)
  const [held, setHeld] = useState([])
  const [heldOpen, setHeldOpen] = useState(false)
  const [qr, setQr] = useState(null)          // { qr_image, qr_string, tran_id }
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [waiting, setWaiting] = useState(false)
  const pollRef = useRef(null)
  const searchRef = useRef(null)

  const currency = settings.currency || 'USD'
  const taxRate = Number(settings.tax_rate) || 0
  const heldKey = `held_orders_${user?.id || 'x'}`

  useEffect(() => {
    loadData()
    try { setHeld(JSON.parse(localStorage.getItem(heldKey)) || []) } catch { setHeld([]) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveHeld = (list) => {
    setHeld(list)
    localStorage.setItem(heldKey, JSON.stringify(list))
  }

  const holdOrder = () => {
    if (!cart.length) return
    const order = {
      id: `${new Date().getTime()}`,
      at: new Date().toLocaleString(),
      label: `${cart.reduce((s, c) => s + c.qty, 0)} items · ${formatCurrency(subtotal, currency)}`,
      cart, customerId, discount,
    }
    saveHeld([order, ...held])
    clearCart()
    setCustomerId('')
    toast.success('Order held')
  }

  const recallOrder = (order) => {
    if (cart.length && !window.confirm('Replace the current cart with the held order?')) return
    setCart(order.cart || [])
    setCustomerId(order.customerId || '')
    setDiscount(order.discount || 0)
    saveHeld(held.filter((h) => h.id !== order.id))
    setHeldOpen(false)
  }

  const deleteHeld = (id) => saveHeld(held.filter((h) => h.id !== id))

  const loadData = async () => {
    setLoading(true)
    try {
      const [prodRes, custRes, setRes] = await Promise.all([
        itemService.getAllProducts(),
        contactService.getAll('customer'),
        settingsService.getSettings(),
      ])
      setProducts(Array.isArray(prodRes.data) ? prodRes.data : (prodRes.data.data || []))
      const custList = custRes.data.data ? custRes.data.data : custRes.data
      setCustomers(Array.isArray(custList) ? custList : [])
      if (setRes.data && typeof setRes.data === 'object') {
        setSettings((prev) => ({ ...prev, ...setRes.data }))
      }
    } catch (e) {
      toast.error(t.failed_load || 'Failed to load POS data')
    } finally {
      setLoading(false)
    }
  }

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean))
    return ['all', ...Array.from(set)]
  }, [products])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((p) => {
      const matchCat = category === 'all' || p.category === category
      const matchQ = !q || p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)
      return matchCat && matchQ
    })
  }, [products, search, category])

  // ── Cart operations ──────────────────────────────────────────────────────
  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === product.id)
      if (existing) {
        return prev.map((c) => (c.id === product.id ? { ...c, qty: c.qty + 1 } : c))
      }
      return [...prev, {
        id: product.id,
        name: product.name,
        sku: product.sku,
        price: Number(product.sell_price) || 0,
        stock: Number(product.stock_on_hand) || 0,
        qty: 1,
      }]
    })
  }

  const changeQty = (id, delta) => {
    setCart((prev) =>
      prev
        .map((c) => (c.id === id ? { ...c, qty: c.qty + delta } : c))
        .filter((c) => c.qty > 0)
    )
  }

  const setQty = (id, value) => {
    const qty = Math.max(0, parseInt(value) || 0)
    setCart((prev) => prev.map((c) => (c.id === id ? { ...c, qty } : c)).filter((c) => c.qty > 0))
  }

  const removeLine = (id) => setCart((prev) => prev.filter((c) => c.id !== id))
  const clearCart = () => { setCart([]); setDiscount(0) }

  const handleSearchKey = (e) => {
    if (e.key !== 'Enter') return
    const q = search.trim().toLowerCase()
    if (!q) return
    // Barcode / SKU exact match → add straight to cart.
    const exact = products.find((p) => (p.sku || '').toLowerCase() === q)
    const target = exact || (filtered.length === 1 ? filtered[0] : null)
    if (target) {
      addToCart(target)
      setSearch('')
    }
  }

  // ── Totals ───────────────────────────────────────────────────────────────
  const subtotal = cart.reduce((sum, c) => sum + c.price * c.qty, 0)
  const discountAmt = Math.min(Number(discount) || 0, subtotal)
  const taxAmt = ((subtotal - discountAmt) * taxRate) / 100
  const total = Math.max(0, subtotal - discountAmt + taxAmt)
  const change = method === 'cash' ? Math.max(0, (Number(tendered) || 0) - total) : 0
  const cartCount = cart.reduce((s, c) => s + c.qty, 0)

  // ── Checkout ─────────────────────────────────────────────────────────────
  const openPayment = () => {
    if (!cart.length) return
    setTendered(total.toFixed(2))
    setMethod('cash')
    setPayOpen(true)
  }

  const completeSale = async () => {
    const paid = method === 'cash' ? (Number(tendered) || 0) : total
    if (method === 'cash' && paid < total) {
      toast.error('Amount tendered is less than the total')
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        contact_id: customerId || null,
        sale_date: new Date().toISOString().split('T')[0],
        items: cart.map((c) => ({ item_id: c.id, quantity: c.qty, unit_price: c.price })),
        discount: discountAmt,
        tax: Number(taxAmt.toFixed(2)),
        paid_amount: paid,
        payment_method: method,
        status: 'completed',
        payment_status: 'paid',
      }
      const res = await saleService.create(payload)
      const cust = customers.find((c) => String(c.id) === String(customerId))
      setReceipt({
        sale: res.data,
        lines: cart,
        subtotal, discountAmt, taxAmt, total,
        paid, change: method === 'cash' ? Math.max(0, paid - total) : 0,
        method,
        customer: cust ? cust.name : 'Walk-in Customer',
        cashier: user?.name || '—',
        date: new Date().toLocaleString(),
      })
      setPayOpen(false)
      clearCart()
      setCustomerId('')
      loadData() // refresh stock
    } catch (e) {
      toast.error(e.response?.data?.message || 'Checkout failed')
    } finally {
      setSubmitting(false)
    }
  }

  const quickCash = (amt) => setTendered(String(amt))

  const chooseMethod = (m) => {
    stopPolling()
    setWaiting(false)
    setQr(null)
    setQrDataUrl('')
    setMethod(m)
  }

  // ── ABA PayWay KHQR ────────────────────────────────────────────────────────
  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  const closePayment = () => {
    stopPolling()
    setWaiting(false)
    setQr(null)
    setQrDataUrl('')
    setPayOpen(false)
  }

  const buildReceiptFromSnapshot = (sale, snapshot, payMethod) => ({
    sale,
    lines: snapshot.cart,
    subtotal: snapshot.subtotal,
    discountAmt: snapshot.discountAmt,
    taxAmt: snapshot.taxAmt,
    total: snapshot.total,
    paid: snapshot.total,
    change: 0,
    method: payMethod,
    customer: snapshot.customer,
    cashier: user?.name || '—',
    date: new Date().toLocaleString(),
  })

  const startKhqr = async () => {
    const cust = customers.find((c) => String(c.id) === String(customerId))
    const snapshot = {
      cart, subtotal, discountAmt, taxAmt, total,
      customer: cust ? cust.name : 'Walk-in Customer',
    }
    setWaiting(true)
    try {
      const res = await paywayService.checkout({
        items: cart.map((c) => ({ item_id: c.id, quantity: c.qty, unit_price: c.price, name: c.name })),
        discount: discountAmt,
        tax: Number(taxAmt.toFixed(2)),
        contact_id: customerId || null,
        currency: ['USD', 'KHR'].includes(currency) ? currency : 'USD',
      })
      setQr(res.data)
      // Poll for confirmation.
      pollRef.current = setInterval(async () => {
        try {
          const s = await paywayService.status(res.data.tran_id)
          if (s.data.status === 'approved') {
            stopPolling()
            setReceipt(buildReceiptFromSnapshot(s.data.sale, snapshot, 'aba_payway'))
            clearCart()
            setCustomerId('')
            closePayment()
            loadData()
          } else if (s.data.status === 'declined') {
            stopPolling()
            setWaiting(false)
            toast.error('Payment was declined')
          }
        } catch { /* keep polling */ }
      }, 3000)
    } catch (e) {
      setWaiting(false)
      toast.error(e.response?.data?.message || 'Could not start ABA payment')
    }
  }

  // Render the KHQR string to an image if ABA only returned the raw string.
  useEffect(() => {
    if (qr?.qr_string && !qr?.qr_image) {
      QRCode.toDataURL(qr.qr_string, { width: 240, margin: 1 }).then(setQrDataUrl).catch(() => {})
    }
  }, [qr])

  useEffect(() => () => stopPolling(), [])

  return (
    <div className="h-[calc(100vh-4rem)]">
      {/* ── Main register UI (not printed) ──────────────────────────────── */}
      <div className="no-print h-full flex flex-col lg:flex-row gap-4 p-4">
        {/* Left: products */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <ScanLine className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                ref={searchRef}
                autoFocus
                type="text"
                placeholder="Scan barcode or search product..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKey}
                className="input-field pl-12"
              />
            </div>
          </div>

          {/* Category chips */}
          <div className="flex flex-wrap gap-2 mb-4">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border
                  ${category === c
                    ? 'bg-sky-600 text-white border-sky-600'
                    : 'bg-white dark:bg-gray-900 text-slate-500 dark:text-gray-400 border-slate-200 dark:border-gray-800 hover:text-slate-900'}`}
              >
                {c === 'all' ? 'All' : c}
              </button>
            ))}
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
            {loading ? (
              <div className="text-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-600 mx-auto"></div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <Package size={40} className="mx-auto mb-3 text-slate-200" />
                <p className="font-bold">No products found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {filtered.map((p) => {
                  const out = Number(p.stock_on_hand) <= 0
                  return (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p)}
                      className="group text-left bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-800 p-4 hover:border-sky-400 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 rounded-lg bg-sky-50 dark:bg-sky-900/30 flex items-center justify-center text-sky-600 font-black">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${out ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-700'}`}>
                          {out ? 'Out' : `${p.stock_on_hand} left`}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight line-clamp-2">{p.name}</h4>
                      <p className="text-[10px] text-slate-400 font-medium mb-2">{p.sku}</p>
                      <p className="text-base font-black text-sky-600">{formatCurrency(p.sell_price, currency)}</p>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: cart */}
        <div className="w-full lg:w-[400px] bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-800 flex flex-col shadow-sm min-h-0">
          <div className="p-4 border-b border-slate-100 dark:border-gray-800 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShoppingCart size={18} className="text-sky-600" /> Current Order
              {cartCount > 0 && <span className="text-[10px] bg-sky-600 text-white rounded-full px-2 py-0.5">{cartCount}</span>}
            </h3>
            <div className="flex items-center gap-3">
              <button onClick={() => setHeldOpen(true)} className="text-xs font-bold text-slate-500 hover:text-sky-600 uppercase tracking-wide flex items-center gap-1">
                <Layers size={14} /> Held{held.length ? ` (${held.length})` : ''}
              </button>
              {cart.length > 0 && (
                <button onClick={clearCart} className="text-xs font-bold text-rose-500 hover:text-rose-600 uppercase tracking-wide">Clear</button>
              )}
            </div>
          </div>

          {/* Customer */}
          <div className="p-4 border-b border-slate-100 dark:border-gray-800">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="input-field pl-9 !py-2.5 text-sm"
              >
                <option value="">Walk-in Customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Lines */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 min-h-[120px]">
            {cart.length === 0 ? (
              <div className="text-center py-12 text-slate-300">
                <ShoppingCart size={36} className="mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-400">Cart is empty</p>
                <p className="text-xs text-slate-400">Tap a product to add it</p>
              </div>
            ) : (
              cart.map((c) => (
                <div key={c.id} className="flex items-center gap-3 bg-slate-50 dark:bg-gray-800/50 rounded-lg p-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{c.name}</p>
                    <p className="text-xs text-slate-400">{formatCurrency(c.price, currency)}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => changeQty(c.id, -1)} className="w-7 h-7 rounded-md bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 flex items-center justify-center text-slate-500 hover:bg-slate-100"><Minus size={13} /></button>
                    <input
                      value={c.qty}
                      onChange={(e) => setQty(c.id, e.target.value)}
                      className="w-9 text-center text-sm font-bold bg-transparent outline-none text-slate-900 dark:text-white"
                    />
                    <button onClick={() => changeQty(c.id, 1)} className="w-7 h-7 rounded-md bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 flex items-center justify-center text-slate-500 hover:bg-slate-100"><Plus size={13} /></button>
                  </div>
                  <div className="w-20 text-right">
                    <p className="text-sm font-black text-slate-900 dark:text-white">{formatCurrency(c.price * c.qty, currency)}</p>
                  </div>
                  <button onClick={() => removeLine(c.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={15} /></button>
                </div>
              ))
            )}
          </div>

          {/* Totals */}
          <div className="p-4 border-t border-slate-100 dark:border-gray-800 space-y-2">
            <div className="flex justify-between text-sm text-slate-500">
              <span>Subtotal</span><span className="font-semibold text-slate-700 dark:text-gray-300">{formatCurrency(subtotal, currency)}</span>
            </div>
            <div className="flex justify-between items-center text-sm text-slate-500">
              <span>Discount</span>
              <input
                type="number"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-24 text-right input-field !py-1.5 !px-2 text-sm"
              />
            </div>
            <div className="flex justify-between text-sm text-slate-500">
              <span>Tax ({taxRate}%)</span><span className="font-semibold text-slate-700 dark:text-gray-300">{formatCurrency(taxAmt, currency)}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-gray-800">
              <span className="font-bold text-slate-900 dark:text-white">Total</span>
              <span className="text-2xl font-black text-sky-600">{formatCurrency(total, currency)}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={holdOrder}
                disabled={cart.length === 0}
                className="btn-secondary !py-4 px-4 flex items-center justify-center gap-2 disabled:opacity-40"
                title="Hold this order"
              >
                <Pause size={18} />
              </button>
              <button
                onClick={openPayment}
                disabled={cart.length === 0}
                className="flex-1 btn-primary !py-4 text-lg font-bold flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <CreditCard size={20} /> Charge {formatCurrency(total, currency)}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Held orders modal ───────────────────────────────────────────── */}
      {heldOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 no-print">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setHeldOpen(false)}></div>
          <div className="relative bg-white dark:bg-gray-950 rounded-2xl border border-slate-200 dark:border-gray-800 w-full max-w-md p-6 z-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><Layers size={18} /> Held Orders</h2>
              <button onClick={() => setHeldOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            {held.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No held orders.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                {held.map((o) => (
                  <div key={o.id} className="flex items-center gap-3 bg-slate-50 dark:bg-gray-800/50 rounded-lg p-3">
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{o.label}</p>
                      <p className="text-xs text-slate-400">{o.at}</p>
                    </div>
                    <button onClick={() => recallOrder(o)} className="btn-primary !py-1.5 !px-3 text-xs">Recall</button>
                    <button onClick={() => deleteHeld(o.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Payment modal ───────────────────────────────────────────────── */}
      {payOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 no-print">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !waiting && !submitting && closePayment()}></div>
          <div className="relative bg-white dark:bg-gray-950 rounded-2xl border border-slate-200 dark:border-gray-800 w-full max-w-md p-8 z-10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Payment</h2>
              <button onClick={closePayment} className="text-slate-400 hover:text-slate-600"><X size={22} /></button>
            </div>

            <div className="text-center mb-6">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Due</p>
              <p className="text-4xl font-black text-sky-600">{formatCurrency(total, currency)}</p>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-6">
              <button onClick={() => chooseMethod('cash')} className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 font-bold text-sm transition-all ${method === 'cash' ? 'border-sky-600 bg-sky-50 dark:bg-sky-900/20 text-sky-600' : 'border-slate-200 dark:border-gray-800 text-slate-500'}`}>
                <Banknote size={20} /> Cash
              </button>
              <button onClick={() => chooseMethod('card')} className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 font-bold text-sm transition-all ${method === 'card' ? 'border-sky-600 bg-sky-50 dark:bg-sky-900/20 text-sky-600' : 'border-slate-200 dark:border-gray-800 text-slate-500'}`}>
                <CreditCard size={20} /> Card
              </button>
              <button onClick={() => chooseMethod('aba')} className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 font-bold text-sm transition-all ${method === 'aba' ? 'border-sky-600 bg-sky-50 dark:bg-sky-900/20 text-sky-600' : 'border-slate-200 dark:border-gray-800 text-slate-500'}`}>
                <QrCode size={20} /> ABA KHQR
              </button>
            </div>

            {method === 'aba' && qr && (
              <div className="mb-6 text-center">
                <div className="inline-block p-3 bg-white rounded-xl border border-slate-200">
                  {qr.qr_image
                    ? <img src={`data:image/png;base64,${qr.qr_image}`} alt="KHQR" className="w-56 h-56" />
                    : qrDataUrl
                      ? <img src={qrDataUrl} alt="KHQR" className="w-56 h-56" />
                      : <div className="w-56 h-56 flex items-center justify-center text-slate-300"><Loader2 className="animate-spin" size={40} /></div>}
                </div>
                <div className="flex items-center justify-center gap-2 mt-4 text-sky-600 font-bold text-sm">
                  <Loader2 className="animate-spin" size={16} /> Waiting for customer to pay...
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Scan with any bank app · Ref {qr.tran_id}</p>
              </div>
            )}

            {method === 'cash' && (
              <div className="mb-6">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount Tendered</label>
                <input
                  type="number"
                  value={tendered}
                  onChange={(e) => setTendered(e.target.value)}
                  className="input-field text-2xl font-black text-center my-2"
                  autoFocus
                />
                <div className="grid grid-cols-4 gap-2">
                  {[total, Math.ceil(total / 5) * 5, Math.ceil(total / 10) * 10, Math.ceil(total / 50) * 50]
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .map((v) => (
                      <button key={v} onClick={() => quickCash(v.toFixed(2))} className="btn-secondary !py-2 text-xs">
                        {formatCurrency(v, currency)}
                      </button>
                    ))}
                </div>
                <div className="flex justify-between items-center mt-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                  <span className="font-bold text-emerald-700 uppercase text-xs tracking-widest">Change</span>
                  <span className="text-2xl font-black text-emerald-600">{formatCurrency(change, currency)}</span>
                </div>
              </div>
            )}

            {method === 'aba' ? (
              qr ? (
                <button onClick={closePayment} className="w-full btn-secondary !py-3.5 text-sm">Cancel payment</button>
              ) : (
                <button onClick={startKhqr} disabled={waiting} className="w-full btn-primary !py-4 text-lg font-bold disabled:opacity-40 flex items-center justify-center gap-2">
                  {waiting ? <><Loader2 className="animate-spin" size={20} /> Generating QR...</> : <><QrCode size={20} /> Show QR Code</>}
                </button>
              )
            ) : (
              <button
                onClick={completeSale}
                disabled={submitting || (method === 'cash' && (Number(tendered) || 0) < total)}
                className="w-full btn-primary !py-4 text-lg font-bold disabled:opacity-40"
              >
                {submitting ? 'Processing...' : 'Complete Sale'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Receipt (printable) ─────────────────────────────────────────── */}
      {receipt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-auto">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm no-print" onClick={() => setReceipt(null)}></div>
          <div id="receipt-print-area" className="relative bg-white text-slate-900 rounded-2xl w-full max-w-sm p-8 z-10 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3 no-print">
                <CheckCircle2 size={30} />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight">{settings.business_name || 'My Store'}</h2>
              {settings.receipt_header && <p className="text-[11px] text-slate-500 whitespace-pre-line">{settings.receipt_header}</p>}
              <p className="text-[11px] text-slate-400 font-medium">{receipt.date}</p>
              <p className="text-[11px] text-slate-400 font-medium">Receipt: {receipt.sale?.sale_number}</p>
            </div>

            <div className="text-xs text-slate-500 flex justify-between mb-1"><span>Customer</span><span className="font-semibold text-slate-700">{receipt.customer}</span></div>
            <div className="text-xs text-slate-500 flex justify-between mb-4"><span>Cashier</span><span className="font-semibold text-slate-700">{receipt.cashier}</span></div>

            <div className="border-t border-dashed border-slate-200 py-3 space-y-2">
              {receipt.lines.map((l) => (
                <div key={l.id} className="flex justify-between text-sm">
                  <span className="text-slate-600">{l.qty} × {l.name}</span>
                  <span className="font-semibold">{formatCurrency(l.price * l.qty, currency)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-slate-200 pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{formatCurrency(receipt.subtotal, currency)}</span></div>
              {receipt.discountAmt > 0 && <div className="flex justify-between text-slate-500"><span>Discount</span><span>-{formatCurrency(receipt.discountAmt, currency)}</span></div>}
              <div className="flex justify-between text-slate-500"><span>Tax</span><span>{formatCurrency(receipt.taxAmt, currency)}</span></div>
              <div className="flex justify-between font-black text-base pt-1"><span>TOTAL</span><span>{formatCurrency(receipt.total, currency)}</span></div>
              <div className="flex justify-between text-slate-500 pt-1"><span>Paid ({({ cash: 'Cash', card: 'Card', aba_payway: 'ABA KHQR' })[receipt.method] || receipt.method})</span><span>{formatCurrency(receipt.paid, currency)}</span></div>
              {receipt.method === 'cash' && <div className="flex justify-between text-slate-500"><span>Change</span><span>{formatCurrency(receipt.change, currency)}</span></div>}
            </div>

            <p className="text-center text-[11px] text-slate-400 mt-6 mb-4 whitespace-pre-line">{settings.receipt_footer || 'Thank you for your purchase!'}</p>

            <div className="flex gap-3 no-print">
              <button onClick={() => setReceipt(null)} className="flex-1 btn-secondary !py-3">New Sale</button>
              <button onClick={() => window.print()} className="flex-1 btn-primary !py-3 flex items-center justify-center gap-2">
                <Printer size={18} /> Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
