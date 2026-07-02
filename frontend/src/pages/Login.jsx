import React, { useState, useContext } from 'react'
import { Mail, Lock, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { authService } from '../services/api'
import toast from 'react-hot-toast'
import { LanguageContext } from '../App'

export default function Login({ setUser }) {
  const { t } = useContext(LanguageContext)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await authService.login(email, password)
      localStorage.setItem('auth_token', response.data.token)
      localStorage.setItem('auth_user', JSON.stringify(response.data.user))
      setUser({ token: response.data.token, ...response.data.user })
      toast.success(t.login_success)
      navigate('/')
    } catch (error) {
      const msg = error.response?.data?.message || t.login_failed
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex items-center justify-center p-6 selection:bg-sky-100 selection:text-sky-900">
      <div className="w-full max-w-md animate-fade-in">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-slate-200 dark:border-gray-800 p-10">
          <div className="text-center mb-10">
            <div className="inline-flex p-3 rounded-lg bg-sky-600 mb-6 shadow-md shadow-sky-100 dark:shadow-none">
              <ShieldCheck size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white uppercase tracking-tight mb-1">{t.inventory_title}</h1>
            <p className="text-sm text-slate-500 font-medium dark:text-gray-400">{t.login_subtitle}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                {t.email_label}
              </label>
              <div className="relative group">
                <Mail className="absolute left-4 top-3 text-slate-400 group-focus-within:text-sky-500 transition-colors" size={20} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="input-field pl-12"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                {t.password_label}
              </label>
              <div className="relative group">
                <Lock className="absolute left-4 top-3 text-slate-400 group-focus-within:text-sky-500 transition-colors" size={20} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pl-12"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3.5 !rounded-lg font-bold text-lg shadow-lg shadow-sky-100 dark:shadow-none transition-all hover:bg-sky-700 active:scale-95 disabled:opacity-50"
            >
              {loading ? t.btn_logging_in : t.btn_login}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-slate-50 dark:border-gray-800 text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {t.demo_credentials}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
