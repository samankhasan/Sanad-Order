import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Home, ShoppingBag, ReceiptText, UserRound, LayoutDashboard, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { usePrefs } from '../context/PrefsContext'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { cn } from '../lib/format'

export default function AppShell() {
  const { t } = usePrefs()
  const { count } = useCart()
  const { isAdmin } = useAuth()
  const { pathname } = useLocation()
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const tabs = [
    { to: '/', icon: Home, label: t('home'), end: true },
    { to: '/cart', icon: ShoppingBag, label: t('cart'), badge: count },
    { to: '/orders', icon: ReceiptText, label: t('orders') },
    ...(isAdmin ? [{ to: '/admin', icon: LayoutDashboard, label: t('admin') }] : []),
    { to: '/profile', icon: UserRound, label: t('profile') }
  ]

  return (
    <div className="min-h-dvh pb-28">
      {!online && (
        <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-amber-500 py-1.5 text-xs font-bold text-black safe-top">
          <WifiOff className="size-4" /> {t('offline')}
        </div>
      )}
      <Outlet />
      <nav className="no-print fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),12px)]">
        <div className="mx-auto flex max-w-md items-stretch justify-around rounded-[28px] border border-theme bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] p-1.5 shadow-[0_12px_40px_-12px_rgb(0_0_0/0.25)] backdrop-blur-xl">
          {tabs.map(tab => (
            <NavLink key={tab.to} to={tab.to} end={tab.end}
              className={({ isActive }) => cn(
                'relative flex flex-1 flex-col items-center gap-0.5 rounded-[22px] py-2 text-[11px] font-bold transition',
                isActive ? 'bg-ink text-white dark:bg-white dark:text-ink' : 'text-2'
              )}>
              <tab.icon className="size-5" strokeWidth={2.2} />
              <span className="max-w-full truncate px-1">{tab.label}</span>
              {!!tab.badge && (
                <span key={tab.badge} className="bump absolute top-1 start-[55%] grid min-w-5 place-items-center rounded-full bg-s-red px-1 text-[10px] font-black text-white ring-2 ring-[var(--surface)]">{tab.badge}</span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
