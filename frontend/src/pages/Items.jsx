import React, { useState, useEffect, useContext } from 'react'
import { Plus, Edit2, Trash2, Search, Package } from 'lucide-react'
import { itemService } from '../services/api'
import Modal from '../components/Modal'
import { LanguageContext } from '../App'
import toast from 'react-hot-toast'

export default function Items() {
  const { t } = useContext(LanguageContext)
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  
  const initialFormData = {
    name: '',
    sku: '',
    category: '',
    cost_price: '',
    sell_price: '',
    stock_on_hand: '',
    reorder_level: '',
  }
  const [formData, setFormData] = useState(initialFormData)
  const [autoSku, setAutoSku] = useState(true)

  useEffect(() => {
    fetchItems()
  }, [])

  const fetchNextSku = async () => {
    try {
      const res = await itemService.nextSku()
      setFormData((prev) => ({ ...prev, sku: res.data.sku }))
    } catch { /* fall back to manual entry */ }
  }

  const openCreate = () => {
    setEditingId(null)
    setFormData(initialFormData)
    setShowModal(true)
    if (autoSku) fetchNextSku()
  }

  const toggleAutoSku = () => {
    const next = !autoSku
    setAutoSku(next)
    if (next) fetchNextSku()
    else setFormData((prev) => ({ ...prev, sku: '' }))
  }

  const fetchItems = async () => {
    setLoading(true)
    try {
      const response = await itemService.getAll()
      const payload = response.data
      setItems(Array.isArray(payload) ? payload : payload.data || [])
    } catch (error) {
      toast.error(t.failed_load)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingId) {
        await itemService.update(editingId, formData)
        toast.success(t.success_update)
      } else {
        await itemService.create(formData)
        toast.success(t.success_create)
      }
      setShowModal(false)
      setEditingId(null)
      setFormData(initialFormData)
      fetchItems()
    } catch (error) {
      toast.error(error.response?.data?.message || t.failed_op)
    }
  }

  const handleEdit = (item) => {
    setFormData(item)
    setEditingId(item.id)
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (window.confirm(t.confirm_delete)) {
      try {
        await itemService.delete(id)
        toast.success(t.success_delete)
        fetchItems()
      } catch (error) {
        toast.error(t.failed_op)
      }
    }
  }

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.sku.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Package size={28} className="text-sky-600" />
            {t.items_title}
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage and track your products and inventory levels.</p>
        </div>
        <button
          onClick={openCreate}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>{t.add_item}</span>
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          placeholder={t.search_items}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-12"
        />
      </div>

      {loading ? (
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-600 mx-auto"></div>
          <p className="mt-4 text-sm font-medium text-slate-400">{t.loading}</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-900 rounded-xl border border-dashed border-slate-200 dark:border-gray-800">
          <Package size={40} className="mx-auto text-slate-200 mb-4" />
          <p className="text-lg font-bold text-slate-400">{t.no_results}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-800 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-gray-800 border-b border-slate-100 dark:border-gray-800">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">{t.item_name}</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">{t.sku}</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">{t.category}</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">{t.cost_price}</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">{t.sell_price}</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">{t.stock_level}</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white">
                    {item.name}
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-slate-500 dark:text-gray-400">
                    {item.sku}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-gray-700 rounded-md text-[10px] font-bold text-slate-600 dark:text-gray-300 uppercase tracking-wider">
                      {item.category || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 dark:text-gray-400 font-medium">
                    ${item.cost_price}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">
                    ${item.sell_price}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        item.stock_on_hand < item.reorder_level
                          ? 'bg-rose-50 text-rose-700 border border-rose-100'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      }`}
                    >
                      {item.stock_on_hand}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end space-x-1">
                      <button
                        onClick={() => handleEdit(item)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-400 rounded-lg transition-colors"
                        title={t.edit}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 hover:bg-rose-50 dark:hover:bg-gray-800 text-rose-400 rounded-lg transition-colors"
                        title={t.delete}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setEditingId(null)
        }}
        title={editingId ? t.edit_item : t.add_item}
        size="full"
      >
        <form onSubmit={handleSubmit} className="space-y-8 max-w-[800px] mx-auto animate-fade-in pt-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">{t.item_name}</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-field !py-4 text-lg font-semibold"
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between pl-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.sku}</label>
                {!editingId && (
                  <button
                    type="button"
                    onClick={toggleAutoSku}
                    className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border transition-all ${autoSku ? 'bg-sky-50 text-sky-600 border-sky-200' : 'bg-slate-100 dark:bg-gray-800 text-slate-500 border-slate-200 dark:border-gray-700'}`}
                    title="Toggle automatic SKU"
                  >
                    {autoSku ? '⚡ Auto' : '✎ Manual'}
                  </button>
                )}
              </div>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                readOnly={autoSku && !editingId}
                placeholder="Item-000"
                className={`input-field !py-4 font-mono text-lg font-semibold ${autoSku && !editingId ? 'bg-slate-50 dark:bg-gray-800 text-slate-500 cursor-not-allowed' : ''}`}
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">{t.category}</label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="input-field"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">{t.cost_price}</label>
              <input
                type="number"
                step="0.01"
                value={formData.cost_price}
                onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                className="input-field"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">{t.sell_price}</label>
              <input
                type="number"
                step="0.01"
                value={formData.sell_price}
                onChange={(e) => setFormData({ ...formData, sell_price: e.target.value })}
                className="input-field"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">{t.stock_on_hand}</label>
              <input
                type="number"
                value={formData.stock_on_hand}
                onChange={(e) => setFormData({ ...formData, stock_on_hand: e.target.value })}
                className="input-field"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">{t.reorder_level}</label>
              <input
                type="number"
                value={formData.reorder_level}
                onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })}
                className="input-field"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-10 border-t border-slate-100 dark:border-gray-800">
            <button 
              type="button" 
              onClick={() => setShowModal(false)}
              className="flex-1 btn-secondary !py-4"
            >
              {t.cancel}
            </button>
            <button 
              type="submit" 
              className="flex-1 btn-primary !py-4"
            >
              {editingId ? t.update : t.create}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
