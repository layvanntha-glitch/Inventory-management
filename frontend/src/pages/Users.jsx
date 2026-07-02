import React, { useState, useEffect, useContext } from 'react'
import { Edit2, Trash2, Search, UserCog, UserPlus, ShieldCheck } from 'lucide-react'
import { userService } from '../services/api'
import Modal from '../components/Modal'
import { LanguageContext } from '../App'
import toast from 'react-hot-toast'

const ROLES = [
  { value: 'master_admin', label: 'Master Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'staff', label: 'Staff' },
]

const roleBadge = {
  master_admin: 'bg-violet-50 text-violet-700 border-violet-100',
  admin: 'bg-sky-50 text-sky-700 border-sky-100',
  staff: 'bg-slate-50 text-slate-600 border-slate-200',
}

export default function Users() {
  const { t } = useContext(LanguageContext)
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const initialFormData = {
    name: '',
    email: '',
    password: '',
    role: 'staff',
    active: true,
  }
  const [formData, setFormData] = useState(initialFormData)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const response = await userService.getAll()
      setUsers(response.data.data ? response.data.data : response.data)
    } catch (error) {
      toast.error(t.failed_load || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingId) {
        const payload = { ...formData }
        if (!payload.password) delete payload.password
        await userService.update(editingId, payload)
        toast.success(t.success_update || 'Updated successfully')
      } else {
        await userService.create(formData)
        toast.success(t.success_create || 'Created successfully')
      }
      setShowModal(false)
      setEditingId(null)
      setFormData(initialFormData)
      fetchUsers()
    } catch (error) {
      toast.error(error.response?.data?.message || t.failed_op || 'Operation failed')
    }
  }

  const handleEdit = (user) => {
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      active: !!user.active,
    })
    setEditingId(user.id)
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (window.confirm(t.confirm_delete || 'Are you sure you want to delete this?')) {
      try {
        await userService.delete(id)
        toast.success(t.success_delete || 'Deleted successfully')
        fetchUsers()
      } catch (error) {
        toast.error(error.response?.data?.message || t.failed_op || 'Operation failed')
      }
    }
  }

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  const roleLabel = (value) => (ROLES.find(r => r.value === value)?.label || value)

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <UserCog size={28} className="text-sky-600" />
            {t.user_management || 'User Management'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Create and manage system accounts, roles and access.
          </p>
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
          <span>{t.add_new || 'Add New'}</span>
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          placeholder={t.search || 'Search users...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-12"
        />
      </div>

      {loading ? (
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-600 mx-auto"></div>
          <p className="mt-4 text-sm font-medium text-slate-400">{t.loading || 'Loading...'}</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-900 rounded-xl border border-dashed border-slate-200 dark:border-gray-800">
          <UserCog size={40} className="mx-auto text-slate-200 mb-4" />
          <p className="text-lg font-bold text-slate-400">{t.no_results || 'No results found'}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-800 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-gray-800 border-b border-slate-100 dark:border-gray-800">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">{t.contact_name || 'Name'}</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">{t.email_label || 'Email'}</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">{t.role || 'Role'}</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">{t.status || 'Status'}</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">{t.actions || 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    {user.role === 'master_admin' && <ShieldCheck size={16} className="text-violet-500" />}
                    {user.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 dark:text-gray-400">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${roleBadge[user.role] || roleBadge.staff}`}>
                      {roleLabel(user.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${user.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                      {user.active ? (t.active || 'Active') : (t.inactive || 'Inactive')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end space-x-1">
                      <button
                        onClick={() => handleEdit(user)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-400 rounded-lg transition-colors"
                        title={t.edit || 'Edit'}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="p-2 hover:bg-rose-50 dark:hover:bg-gray-800 text-rose-400 rounded-lg transition-colors"
                        title={t.delete || 'Delete'}
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
        title={editingId ? (t.edit || 'Edit') + ' ' + (t.user || 'User') : (t.add_new || 'Add') + ' ' + (t.user || 'User')}
        size="full"
      >
        <form onSubmit={handleSubmit} className="space-y-8 max-w-[800px] mx-auto animate-fade-in pt-10">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">{t.contact_name || 'Name'}</label>
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
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">{t.email_label || 'Email'}</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input-field"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                {t.password_label || 'Password'}{editingId ? ' (leave blank to keep)' : ''}
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="input-field"
                placeholder="••••••••"
                required={!editingId}
                minLength={6}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">{t.role || 'Role'}</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="input-field"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <p className="text-xs text-slate-400 pl-1 pt-1">
              Master Admin: full control incl. user management · Admin: all modules · Staff: sales &amp; purchases.
            </p>
          </div>

          <div className="flex items-center gap-2 p-5 bg-slate-50 dark:bg-gray-800 rounded-xl border border-slate-100 dark:border-gray-800">
            <input
              type="checkbox"
              checked={formData.active}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              className="w-5 h-5 rounded text-sky-600 border-slate-200 outline-none transition-all cursor-pointer"
            />
            <span className="text-slate-700 dark:text-gray-300 font-semibold text-xs uppercase tracking-widest">{t.active_status || 'Active'}</span>
          </div>

          <div className="flex justify-end gap-3 pt-10 border-t border-slate-100 dark:border-gray-800">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="flex-1 btn-secondary !py-4"
            >
              {t.cancel || 'Cancel'}
            </button>
            <button type="submit" className="flex-1 btn-primary !py-4">
              {editingId ? (t.update || 'Update') : (t.create || 'Create')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
