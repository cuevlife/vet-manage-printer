import { ReactNode, useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { Printer, Wrench, Settings, Home, Minus, Square, X } from 'lucide-react'
import Logo from './Logo'
import { Separator } from './ui/separator'
import { cn } from '../lib/utils'

const navItems = [
  { to: '/', icon: Home, label: 'Dashboard' },
  { to: '/install', icon: Printer, label: 'ติดตั้ง' },
  { to: '/diagnostics', icon: Wrench, label: 'ตรวจสอบ' },
  { to: '/settings', icon: Settings, label: 'ตั้งค่า' },
]

export default function Layout({ children }: { children: ReactNode }) {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    const unsub = window.electronAPI.on('window:maximized-change', (_val: unknown) => {
      setIsMaximized(!!_val)
    })
    return unsub
  }, [])

  const handleMinimize = () => window.electronAPI.windowControls.minimize()
  const handleMaximize = () => window.electronAPI.windowControls.maximize()
  const handleClose = () => window.electronAPI.windowControls.close()

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Title Bar with Window Controls */}
      <div className="titlebar fixed top-0 left-0 right-0 h-9 bg-brand-700 flex items-center z-50 select-none">
        <span className="text-white text-xs font-medium ml-3">VET MANAGE Printer Driver</span>
        <div className="flex ml-auto">
          <button
            onClick={handleMinimize}
            className="titlebar-btn w-11 h-9 flex items-center justify-center text-white/80 hover:bg-brand-600 hover:text-white transition-colors"
          >
            <Minus size={14} />
          </button>
          <button
            onClick={handleMaximize}
            className="titlebar-btn w-11 h-9 flex items-center justify-center text-white/80 hover:bg-brand-600 hover:text-white transition-colors"
          >
            <Square size={12} />
          </button>
          <button
            onClick={handleClose}
            className="titlebar-btn w-11 h-9 flex items-center justify-center text-white/80 hover:bg-red-600 hover:text-white transition-colors"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <aside className="w-56 bg-white border-r border-gray-200 pt-9 flex flex-col">
        <div className="p-4">
          <Logo />
        </div>
        <Separator className="mx-4" />
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200">
          <p className="text-xs text-gray-400">VET MANAGE v1.0.0</p>
        </div>
      </aside>

      <main className="flex-1 pt-9 overflow-auto">
        <div className="p-6 max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
