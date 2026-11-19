import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Wand2,
  Library,
  ShieldCheck,
  CalendarDays,
  Bot,
  Settings,
  ScrollText,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { db } from '@/lib/supabase'
import { Logo } from './Logo'
import { cn } from '../ui/cn'

const NAV = [
  { to: '/', label: 'Inicio', icon: LayoutDashboard, end: true },
  { to: '/estudio', label: 'Estudio creativo', icon: Wand2 },
  { to: '/contenidos', label: 'Contenidos', icon: Library },
  { to: '/aprobaciones', label: 'Aprobaciones', icon: ShieldCheck, badge: 'pending' as const },
  { to: '/calendario', label: 'Calendario', icon: CalendarDays },
  { to: '/agente', label: 'Agente de contenido', icon: Bot },
  { to: '/configuracion', label: 'Configuración', icon: Settings },
  { to: '/actividad', label: 'Actividad', icon: ScrollText },
]
const MOBILE_MAIN = ['/', '/estudio', '/aprobaciones', '/calendario']

function usePendingCount() {
  const [n, setN] = useState(0)
  const { pathname } = useLocation()
  useEffect(() => {
    db()
      .from('content_items')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending_approval')
      .then(({ count }) => setN(count ?? 0))
  }, [pathname])
  return n
}

export function AppShell() {
  const { profile, signOut, session } = useAuth()
  const pending = usePendingCount()
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => setMenuOpen(false), [pathname])

  const name = profile?.full_name || session?.user.email || ''
  const initials = name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('')

  const navList = (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          className={({ isActive }) =>
            cn(
              'group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[0.88rem] transition',
              isActive ? 'bg-cocoa-700/70 text-cream-50' : 'text-cream-200/75 hover:bg-cocoa-700/40 hover:text-cream-50',
            )
          }
        >
          {({ isActive }) => (
            <>
              <n.icon className={cn('size-[1.1rem]', isActive ? 'text-champagne-300' : 'text-cream-200/60')} strokeWidth={1.5} />
              <span className="flex-1">{n.label}</span>
              {n.badge === 'pending' && pending > 0 && (
                <span className="rounded-full bg-champagne-300 px-2 text-[0.7rem] font-medium text-cocoa-900">{pending}</span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )

  const userBox = (
    <div className="flex items-center gap-3 rounded-2xl bg-cocoa-900/40 p-3 ring-1 ring-cocoa-700/60">
      <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-champagne-200 to-gold-500 text-xs font-medium text-cocoa-900">
        {initials || '·'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.82rem] text-cream-50">{name}</p>
        <p className="text-[0.68rem] uppercase tracking-[0.18em] text-champagne-300/80">
          {profile?.role === 'admin' ? 'Administrador' : 'Editor'}
        </p>
      </div>
      <button onClick={signOut} className="rounded-full p-2 text-cream-200/70 hover:bg-cocoa-700 hover:text-cream-50" aria-label="Cerrar sesión" title="Cerrar sesión">
        <LogOut className="size-4" strokeWidth={1.5} />
      </button>
    </div>
  )

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      {/* Barra lateral (escritorio) */}
      <aside className="sticky top-0 hidden h-dvh flex-col justify-between bg-cocoa-800 px-4 py-7 lg:flex">
        <div>
          <Logo light className="mb-10 px-2" />
          {navList}
        </div>
        {userBox}
      </aside>

      {/* Encabezado (móvil) */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-cocoa-800 px-4 py-3 lg:hidden" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <Logo light />
        <button onClick={() => setMenuOpen(true)} className="rounded-full p-2 text-cream-100" aria-label="Abrir menú">
          <Menu className="size-5" strokeWidth={1.5} />
        </button>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-cocoa-900/40" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-[82%] max-w-xs flex-col justify-between bg-cocoa-800 px-4 py-6 animate-fade-in">
            <div>
              <div className="mb-8 flex items-center justify-between px-2">
                <Logo light />
                <button onClick={() => setMenuOpen(false)} className="text-cream-100" aria-label="Cerrar menú">
                  <X className="size-5" />
                </button>
              </div>
              {navList}
            </div>
            {userBox}
          </div>
        </div>
      )}

      <main className="min-w-0 px-4 pb-28 pt-6 sm:px-8 lg:px-12 lg:pb-14 lg:pt-12">
        <div className="mx-auto max-w-[1240px]">
          <Outlet />
        </div>
      </main>

      {/* Navegación inferior (móvil) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-cream-300 bg-cream-50/95 backdrop-blur lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {NAV.filter((n) => MOBILE_MAIN.includes(n.to)).map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              cn('relative flex flex-col items-center gap-1 py-2.5 text-[0.66rem]', isActive ? 'text-cocoa-900' : 'text-cocoa-400')
            }
          >
            <n.icon className="size-5" strokeWidth={1.5} />
            {n.label.split(' ')[0]}
            {n.badge === 'pending' && pending > 0 && (
              <span className="absolute right-[28%] top-1.5 rounded-full bg-gold-500 px-1.5 text-[0.6rem] text-white">{pending}</span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
