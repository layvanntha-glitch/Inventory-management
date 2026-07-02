import React, { useContext } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { 
  Home, Users, Package, ShoppingCart, Settings,
  LogOut, Menu, X, ShoppingBag, PieChart, ShieldCheck, UserCog, Calculator,
  RotateCcw, Wallet, Barcode
} from 'lucide-react'
import { AuthContext } from '../context/AuthContext'
import { LanguageContext } from '../App'

export default function Sidebar() {
  const [isOpen, setIsOpen] = React.useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { logout, user } = useContext(AuthContext)
  const { t } = useContext(LanguageContext)

  const isMasterAdmin = user?.role === 'master_admin'

  const menuItems = [
    { icon: Home, label: t.dashboard, path: '/' },
    { icon: Calculator, label: t.pos || 'POS Register', path: '/pos' },
    { icon: RotateCcw, label: t.refunds || 'Refunds', path: '/refunds' },
    { icon: Wallet, label: t.shift || 'Cash Drawer', path: '/shift' },
    { icon: Users, label: t.contacts, path: '/contacts' },
    { icon: Package, label: t.items, path: '/items' },
    { icon: Barcode, label: t.labels || 'Barcode Labels', path: '/labels' },
    { icon: ShoppingCart, label: t.purchases, path: '/purchases' },
    { icon: ShoppingBag, label: t.sales, path: '/sales' },
    { icon: PieChart, label: t.reports, path: '/reports' },
    { icon: Settings, label: t.settings, path: '/settings' },
    // Account management is reserved for the master admin.
    ...(isMasterAdmin
      ? [{ icon: UserCog, label: t.user_management || 'User Management', path: '/users' }]
      : []),
  ]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isActive = (path) => location.pathname === path

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-gray-700 hover:bg-slate-50 transition-all"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <aside className={`
        fixed md:static inset-y-0 left-0 w-64 bg-white dark:bg-gray-950 border-r border-slate-200 dark:border-gray-900
        transition-transform duration-300 ease-in-out z-40
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
      `}>
        <div className="h-screen flex flex-col pt-8 pb-6 px-4">
          <div className="flex items-center gap-3 px-4 mb-10">
            <ShieldCheck className="text-sky-600" size={32} />
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                {t.inventory_title}
              </h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">v2.0 Stable</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar">
            {menuItems.map((item) => {
              const active = isActive(item.path)
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path)
                    setIsOpen(false)
                  }}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all group
                    ${active 
                      ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 font-semibold' 
                      : 'text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-900/50 hover:text-slate-900 dark:hover:text-white'}
                  `}
                >
                  <item.icon size={18} className={active ? 'text-sky-600' : 'text-slate-400 group-hover:text-slate-600'} />
                  <span className="text-sm font-medium">
                    {item.label}
                  </span>
                  {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-600"></div>}
                </button>
              )
            })}
          </nav>

          <div className="pt-6 mt-6 border-t border-slate-100 dark:border-gray-900">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-500 hover:bg-rose-50 dark:hover:bg-red-900/10 hover:text-rose-600 transition-all font-medium"
            >
              <LogOut size={18} />
              <span className="text-sm">{t.logout}</span>
            </button>
          </div>
        </div>
      </aside>

      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm md:hidden z-30 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
