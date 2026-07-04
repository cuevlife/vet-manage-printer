import { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Printer, Wrench, Settings, Home } from 'lucide-react'
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
  return (
    <div className="flex h-screen bg-gray-50">
      <div className="titlebar fixed top-0 left-0 right-0 h-8 bg-brand-700 flex items-center justify-center z-50">
        <span className="text-white text-xs font-medium">VET MANAGE Printer Driver</span>
      </div>

      <aside className="w-56 bg-white border-r border-gray-200 pt-8 flex flex-col">
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

      <main className="flex-1 pt-8 overflow-auto">
        <div className="p-6 max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
