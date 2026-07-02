import React, { useState, useEffect, useContext } from 'react'
import { Wallet, ArrowDownCircle, ArrowUpCircle, Lock, Unlock, Clock } from 'lucide-react'
import { shiftService, settingsService } from '../services/api'
import { LanguageContext } from '../App'
import { formatCurrency, formatDate } from '../utils/helpers'
import toast from 'react-hot-toast'

export default function Shift() {
  const { t } = useContext(LanguageContext)
  const [shift, setShift] = useState(null)
  const [history, setHistory] = useState([])
  const [currency, setCurrency] = useState('USD')
  const [loading, setLoading] = useState(true)

  const [openingCash, setOpeningCash] = useState('')
  const [move, setMove] = useState({ type: 'in', amount: '', reason: '' })
  const [countedCash, setCountedCash] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [cur, hist, set] = await Promise.all([
        shiftService.current(),
        shiftService.history(),
        settingsService.getSettings(),
      ])
      setShift(cur.data || null)
      setHistory((hist.data.data ? hist.data.data : hist.data).filter((s) => s.status === 'closed'))
      if (set.data?.currency) setCurrency(set.data.currency)
    } catch { /* ignore */ } finally { setLoading(false) }
  }

  const openShift = async () => {
    setBusy(true)
    try {
      await shiftService.open({ opening_cash: Number(openingCash) || 0 })
      setOpeningCash('')
      toast.success('Shift opened')
      loadAll()
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to open shift') } finally { setBusy(false) }
  }

  const addMovement = async () => {
    if (!move.amount || Number(move.amount) <= 0) { toast.error('Enter an amount'); return }
    setBusy(true)
    try {
      await shiftService.movement({ type: move.type, amount: Number(move.amount), reason: move.reason })
      setMove({ type: 'in', amount: '', reason: '' })
      const cur = await shiftService.current()
      setShift(cur.data || null)
    } catch (e) { toast.error(e.response?.data?.message || 'Failed') } finally { setBusy(false) }
  }

  const closeShift = async () => {
    if (countedCash === '') { toast.error('Enter counted cash'); return }
    setBusy(true)
    try {
      const res = await shiftService.close({ closing_cash: Number(countedCash) })
      const diff = Number(res.data.difference)
      toast.success(`Shift closed. Difference: ${formatCurrency(diff, currency)}`)
      setCountedCash('')
      loadAll()
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to close') } finally { setBusy(false) }
  }

  const s = shift?.summary || {}

  const Row = ({ label, value, cls = '' }) => (
    <div className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-gray-800 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-bold ${cls || 'text-slate-900 dark:text-white'}`}>{value}</span>
    </div>
  )

  if (loading) {
    return <div className="p-10 text-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-600 mx-auto" /></div>
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-[1100px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <Wallet size={28} className="text-sky-600" /> Cash Drawer & Shifts
        </h1>
        <p className="text-sm text-slate-500 mt-1">Open a register shift, track cash, and reconcile at close.</p>
      </div>

      {!shift ? (
        /* Open shift */
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-800 p-8 max-w-md">
          <div className="flex items-center gap-3 mb-6 text-sky-600">
            <Unlock size={22} /><h3 className="font-bold text-lg">Open a New Shift</h3>
          </div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Opening Cash (float)</label>
          <input type="number" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} className="input-field text-2xl font-black text-center my-3" placeholder="0.00" />
          <button onClick={openShift} disabled={busy} className="w-full btn-primary !py-3.5 disabled:opacity-40">Open Shift</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Summary + close */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-800 p-6 space-y-1">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2"><Clock size={18} className="text-emerald-500" /> Current Shift</h3>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">Open</span>
            </div>
            <Row label="Opened" value={formatDate(shift.opened_at)} />
            <Row label="Opening cash" value={formatCurrency(shift.opening_cash, currency)} />
            <Row label="Cash sales" value={formatCurrency(s.cash_sales, currency)} cls="text-emerald-600" />
            <Row label="Cash in" value={formatCurrency(s.cash_in, currency)} cls="text-emerald-600" />
            <Row label="Cash out" value={`-${formatCurrency(s.cash_out, currency)}`} cls="text-rose-600" />
            <Row label="Refunds" value={`-${formatCurrency(s.cash_refunds, currency)}`} cls="text-rose-600" />
            <div className="flex justify-between items-center pt-3 mt-2 border-t border-slate-100 dark:border-gray-800">
              <span className="font-bold text-slate-900 dark:text-white">Expected in drawer</span>
              <span className="text-2xl font-black text-sky-600">{formatCurrency(s.expected_cash, currency)}</span>
            </div>

            <div className="pt-4 mt-2 border-t border-slate-100 dark:border-gray-800">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Counted cash at close</label>
              <input type="number" value={countedCash} onChange={(e) => setCountedCash(e.target.value)} className="input-field text-center font-bold my-2" placeholder="Count the drawer..." />
              {countedCash !== '' && (
                <p className="text-xs text-center mb-2 font-bold">
                  Difference:{' '}
                  <span className={Number(countedCash) - s.expected_cash === 0 ? 'text-emerald-600' : 'text-rose-600'}>
                    {formatCurrency(Number(countedCash) - s.expected_cash, currency)}
                  </span>
                </p>
              )}
              <button onClick={closeShift} disabled={busy} className="w-full btn-primary !bg-slate-900 hover:!bg-slate-800 !py-3 flex items-center justify-center gap-2 disabled:opacity-40">
                <Lock size={16} /> Close Shift
              </button>
            </div>
          </div>

          {/* Movements */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-800 p-5">
              <h3 className="font-bold text-slate-900 dark:text-white mb-4">Cash In / Out</h3>
              <div className="flex gap-2 mb-3">
                <button onClick={() => setMove({ ...move, type: 'in' })} className={`flex-1 py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 border-2 ${move.type === 'in' ? 'border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-200 dark:border-gray-800 text-slate-500'}`}><ArrowDownCircle size={16} /> Cash In</button>
                <button onClick={() => setMove({ ...move, type: 'out' })} className={`flex-1 py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 border-2 ${move.type === 'out' ? 'border-rose-500 text-rose-600 bg-rose-50 dark:bg-rose-900/20' : 'border-slate-200 dark:border-gray-800 text-slate-500'}`}><ArrowUpCircle size={16} /> Cash Out</button>
              </div>
              <input type="number" value={move.amount} onChange={(e) => setMove({ ...move, amount: e.target.value })} className="input-field mb-2" placeholder="Amount" />
              <input type="text" value={move.reason} onChange={(e) => setMove({ ...move, reason: e.target.value })} className="input-field mb-3" placeholder="Reason (e.g. float, payout)" />
              <button onClick={addMovement} disabled={busy} className="w-full btn-secondary !py-2.5 disabled:opacity-40">Record</button>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-800 p-5">
              <h3 className="font-bold text-slate-900 dark:text-white mb-3 text-sm uppercase tracking-wide">Movements this shift</h3>
              {(shift.movements || []).length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No cash movements yet.</p>
              ) : (
                <div className="space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar">
                  {shift.movements.map((m) => (
                    <div key={m.id} className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">{m.reason || (m.type === 'in' ? 'Cash in' : 'Cash out')}</span>
                      <span className={`font-bold ${m.type === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {m.type === 'in' ? '+' : '-'}{formatCurrency(m.amount, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* History */}
      <div>
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Shift History</h3>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-800 overflow-hidden">
          {history.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No closed shifts yet.</div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-gray-800 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">Opened</th><th className="px-6 py-3">Closed</th>
                  <th className="px-6 py-3 text-right">Expected</th><th className="px-6 py-3 text-right">Counted</th><th className="px-6 py-3 text-right">Difference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-gray-800">
                {history.map((h) => (
                  <tr key={h.id} className="text-sm">
                    <td className="px-6 py-3 text-slate-500">{formatDate(h.opened_at)}</td>
                    <td className="px-6 py-3 text-slate-500">{formatDate(h.closed_at)}</td>
                    <td className="px-6 py-3 text-right font-medium">{formatCurrency(h.expected_cash, currency)}</td>
                    <td className="px-6 py-3 text-right font-medium">{formatCurrency(h.closing_cash, currency)}</td>
                    <td className={`px-6 py-3 text-right font-bold ${Number(h.difference) === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(h.difference, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
