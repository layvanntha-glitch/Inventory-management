import React, { useState, useEffect, useContext } from 'react'
import { Plus, Edit2, Trash2, Search, Users, UserPlus } from 'lucide-react'
import { contactService } from '../services/api'
import Modal from '../components/Modal'
import { LanguageContext } from '../App'
import toast from 'react-hot-toast'

export default function Contacts() {
  const { t } = useContext(LanguageContext)
  const [contacts, setContacts] = useState([])
  const [type, setType] = useState('customer')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  
  const initialFormData = {
    name: '',
    phone: '',
    email: '',
    address: '',
    note: '',
    active: true,
  }
  const [formData, setFormData] = useState(initialFormData)

  useEffect(() => {
    fetchContacts()
  }, [type])

  const fetchContacts = async () => {
    setLoading(true)
    try {
      const response = await contactService.getAll(type)
      setContacts(response.data.data ? response.data.data : response.data)
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
        await contactService.update(editingId, { ...formData, type })
        toast.success(t.success_update)
      } else {
        await contactService.create({ ...formData, type })
        toast.success(t.success_create)
      }
      setShowModal(false)
      setEditingId(null)
      setFormData(initialFormData)
      fetchContacts()
    } catch (error) {
      toast.error(error.response?.data?.message || t.failed_op)
    }
  }

  const handleEdit = (contact) => {
    setFormData(contact)
    setEditingId(contact.id)
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (window.confirm(t.confirm_delete)) {
      try {
        await contactService.delete(id)
        toast.success(t.success_delete)
        fetchContacts()
      } catch (error) {
        toast.error(t.failed_op)
      }
    }
  }

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  )

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Users size={28} className="text-sky-600" />
            {type === 'customer' ? t.type_customer : t.type_supplier}
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage your business contacts and communication history.</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null)
            setFormData(initialFormData)
            setShowModal(true)
          }}
          className="btn-primary flex items-center space-x-2"
        >
          <UserPlus size={20} />
          <span>{t.add_new}</span>
        </button>
      </div>

      <div className="flex p-1 bg-slate-100 dark:bg-gray-800 rounded-lg w-fit">
        <button
          onClick={() => setType('customer')}
          className={`px-6 py-2 rounded-md font-bold text-sm transition-all ${type === 'customer'
              ? 'bg-white dark:bg-gray-700 text-sky-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-gray-300'
            }`}
        >
          {t.type_customer}
        </button>
        <button
          onClick={() => setType('supplier')}
          className={`px-6 py-2 rounded-md font-bold text-sm transition-all ${type === 'supplier'
              ? 'bg-white dark:bg-gray-700 text-sky-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-gray-300'
            }`}
        >
          {t.type_supplier}
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          placeholder={t.search_contacts}
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
      ) : filteredContacts.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-900 rounded-xl border border-dashed border-slate-200 dark:border-gray-800">
          <Users size={40} className="mx-auto text-slate-200 mb-4" />
          <p className="text-lg font-bold text-slate-400">{t.no_results}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-800 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-gray-800 border-b border-slate-100 dark:border-gray-800">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">{t.contact_name}</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">{t.contact_email}</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">{t.contact_phone}</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">{t.contact_address}</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">{t.status}</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
              {filteredContacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white">
                    {contact.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 dark:text-gray-400">
                    {contact.email}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 dark:text-gray-400 font-medium">
                    {contact.phone}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 dark:text-gray-400 truncate max-w-xs">
                    {contact.address || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${contact.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                      {contact.active ? t.active : t.inactive}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end space-x-1">
                      <button
                        onClick={() => handleEdit(contact)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-400 rounded-lg transition-colors"
                        title={t.edit}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(contact.id)}
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
        title={editingId ? t.edit_contact : t.add_contact}
        size="full"
      >
        <form onSubmit={handleSubmit} className="space-y-8 max-w-[800px] mx-auto animate-fade-in pt-10">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">{t.contact_name}</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input-field !py-4 text-lg font-semibold"
              required
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">{t.contact_email}</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input-field"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">{t.contact_phone}</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="input-field"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">{t.contact_address}</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="input-field"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">{t.note}</label>
            <textarea
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              className="input-field"
              rows="3"
            />
          </div>

          <div className="flex items-center gap-2 p-5 bg-slate-50 dark:bg-gray-800 rounded-xl border border-slate-100 dark:border-gray-800">
             <input
              type="checkbox"
              checked={formData.active}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              className="w-5 h-5 rounded text-sky-600 border-slate-200 outline-none transition-all cursor-pointer"
            />
            <span className="text-slate-700 dark:text-gray-300 font-semibold text-xs uppercase tracking-widest">{t.active_status}</span>
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
