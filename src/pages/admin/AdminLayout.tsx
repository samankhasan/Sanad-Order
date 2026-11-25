import { NavLink, Outlet } from 'react-router-dom'
import { usePrefs } from '../../context/PrefsContext'
import { cn } from '../../lib/format'

export default function AdminLayout() {
  const { t } = usePrefs()
  const tabs = [
    { to: '/admin', label: t('dashboard'), end: true },
    { to: '/admin/orders', label: t('manageOrders') },
    { to: '/admin/products', label: t('manageProducts') },
    { to: '/admin/customers', label: t('customers') },
    { to: '/admin/notify', label: t('notifications') }
  ]
  return (
    <div className="mx-auto max-w-5xl">
      <div className="sticky top-0 z-30 border-b border-theme bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] backdrop-blur-xl">
        <div className="mb-3 flex items-center gap-2">
          <h1 className="text-xl font-extrabold">{t('admin')}</h1>
          <span className="h-1.5 w-10 rounded-full sanad-stripe" />
        </div>
        <nav className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {tabs.map(tab => (
            <NavLink key={tab.to} to={tab.to} end={tab.end}
              className={({ isActive }) => cn('chip shrink-0 px-4 py-2 text-sm transition', isActive ? 'bg-ink text-white dark:bg-white dark:text-ink' : 'surface border border-theme text-2')}>
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="p-4"><Outlet /></div>
    </div>
  )
}
