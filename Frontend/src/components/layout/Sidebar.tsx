import { NavLink, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import {
  LayoutDashboard,
  Users,
  CreditCard,
  FileText,
  Cpu,
  BarChart3,
  Settings,
  LogOut,
  Tag,
  Package,
  PhoneCall,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['owner', 'staff', 'trainer'] },
  { to: '/members', label: 'Members', icon: Users, roles: ['owner', 'staff', 'trainer'] },
  { to: '/leads', label: 'Leads', icon: PhoneCall, roles: ['owner', 'staff'] },
  { to: '/plans', label: 'Plans', icon: Tag, roles: ['owner', 'staff'] },
  { to: '/billing', label: 'Billing', icon: FileText, roles: ['owner', 'staff'] },
  { to: '/inventory', label: 'Inventory', icon: Package, roles: ['owner', 'staff'] },
  { to: '/devices', label: 'Devices', icon: Cpu, roles: ['owner', 'staff'] },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, roles: ['owner', 'staff'] },
  { to: '/settings', label: 'Settings', icon: Settings, roles: ['owner'] },
]

export function Sidebar() {
  const location = useLocation()
  const logout = useAuthStore((s) => s.logout)
  const role = useAuthStore((s) => s.user_role)
  const activeRole = role ?? 'owner'

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-60 flex flex-col z-30"
      style={{ backgroundColor: '#0D1117' }}
    >
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/5">
        <h1 className="font-syne font-extrabold text-2xl tracking-tight" 
          style={{ color: 'rgba(255,255,255,0.95)' }}>
          FIT
        </h1>
        <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Gym Management OS
        </p>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.filter((item) => item.roles.includes(activeRole)).map((item) => {
          const isActive = location.pathname === item.to || 
            (item.to !== '/dashboard' && location.pathname.startsWith(item.to))
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group',
                isActive
                  ? 'text-white bg-white/10'
                  : 'hover:bg-white/5'
              )}
              style={{ color: isActive ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.45)' }}
            >
              <item.icon
                size={18}
                className={cn(
                  'transition-colors',
                  isActive ? 'text-[#00B894]' : 'group-hover:text-white/70',
                )}
                style={isActive ? { color: '#00B894' } : undefined}
              />
              {item.label}
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#00B894]" />
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-white/5">
        <button
          onClick={() => {
            const refreshToken = useAuthStore.getState().refresh_token
            if (refreshToken) {
              // Fire and forget logout
              import('@/lib/api').then(({ api }) => {
                api.post('/v1/auth/logout', { refresh_token: refreshToken }).catch(() => {})
              })
            }
            logout()
          }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full transition-all duration-150 hover:bg-white/5"
          style={{ color: 'rgba(255,255,255,0.45)' }}
        >
          <LogOut size={18} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
