import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Globe, Home, ShoppingBag, ReceiptText, UserRound, LayoutDashboard, WifiOff } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { COMPANY_WEBSITE } from '../lib/contact'
import { useEffect, useState } from 'react'
import { usePrefs } from '../context/PrefsContext'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { assetUrl } from '../lib/format'
import { initBackButton } from '../lib/native'
import UpdateBanner from './UpdateBanner'

const ROOTS = ['/', '/cart', '/orders', '/profile', '/admin']

export default function AppShell() {
  const { t } = usePrefs()
  const { count } = useCart()
  const { isStaff } = useAuth()
  const { pathname } = useLocation()
  const nav = useNavigate()
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  // Android hardware back: sheet → previous page → tab root → home → minimise
  useEffect(() => {
    let off = () => {}
    initBackButton(
      () => { const p = window.location.hash.replace(/^#/, ''); return p === '' || p === '/' },
      () => {
        const p = window.location.hash.replace(/^#/, '') || '/'
        if (ROOTS.includes(p)) nav('/', { replace: true })
        else nav(-1)
      }
    ).then(f => { off = f })
    return () => off()
  }, [nav])

  const tabs = [
    { to: '/', icon: Home, label: t('home'), end: true },
    { to: '/cart', icon: ShoppingBag, label: t('cart'), badge: count },
    { to: '/orders', icon: ReceiptText, label: t('orders') },
    ...(isStaff ? [{ to: '/admin', icon: LayoutDashboard, label: t('admin') }] : []),
    { to: '/profile', icon: UserRound, label: t('profile') }
  ]

  // company website: opens outside the app (Chrome custom tab on Android, a new tab on the web)
  const openWebsite = () => Capacitor.isNativePlatform()
    ? Browser.open({ url: COMPANY_WEBSITE }).catch(() => { window.open(COMPANY_WEBSITE, '_blank', 'noopener') })
    : window.open(COMPANY_WEBSITE, '_blank', 'noopener')
  const website = (
    <button key="website" type="button" onClick={openWebsite} className="nav-item" aria-label={`${t('website')} – sanadcompany.com`}>
      <span className="nav-indicator"><Globe className="size-[22px]" strokeWidth={2} /></span>
      <span className="nav-label">{t('website')}</span>
    </button>
  )

  const links = tabs.map(tab => (
    <NavLink key={tab.to} to={tab.to} end={tab.end} replace className="nav-item">
      {({ isActive }) => (
        <>
          <span className="nav-indicator">
            <tab.icon className="size-[22px]" strokeWidth={isActive ? 2.5 : 2} />
            {!!tab.badge && (
              <span key={tab.badge} className="bump absolute -top-1 start-[34px] grid h-[18px] min-w-[18px] place-items-center rounded-full bg-s-red px-1 text-[10px] font-black leading-none text-white">
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}
          </span>
          <span className="nav-label">{tab.label}</span>
        </>
      )}
    </NavLink>
  ))
  // website sits just before "profile"
  const items = [...links.slice(0, -1), website, links[links.length - 1]]

  return (
    <div className="with-rail min-h-dvh">
      {!online && (
        <div className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-amber-500 pb-1.5 pt-[calc(var(--sat)+6px)] text-xs font-bold text-black">
          <WifiOff className="size-4" /> {t('offline')}
        </div>
      )}
      <main className="pb-nav"><Outlet /></main>
      <UpdateBanner />

      {/* phones: bottom navigation bar */}
      <nav className="nav-bar no-print md:hidden" aria-label="main">
        <div className="mx-auto flex max-w-xl ps-[var(--sal)] pe-[var(--sar)]">{items}</div>
      </nav>

      {/* tablets & desktop: navigation rail */}
      <nav className="nav-rail no-print max-md:hidden" aria-label="main">
        <img src={assetUrl('brands/sanad-mark.png')} alt="Sanad" className="mb-4 size-11 object-contain" />
        {items}
      </nav>
    </div>
  )
}
