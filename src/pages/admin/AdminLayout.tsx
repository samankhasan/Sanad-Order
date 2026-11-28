import { NavLink, Outlet } from 'react-router-dom'
import { usePrefs } from '../../context/PrefsContext'
import { cn } from '../../lib/format'
import { useAuth } from '../../context/AuthContext'

export default function AdminLayout() {
  const { t } = usePrefs()
  const { isAdmin } = useAuth()
  const all = [
    { to: '/admin', label: t('dashboard'), end: true },
    { to: '/admin/orders', label: t('manageOrders') },
    { to: '/admin/products', label: t('manageProducts') },
    { to: '/admin/categories', label: t('categories') },
    { to: '/admin/customers', label: t('customers') },
    { to: '/admin/support', label: t('messages') },
    { to: '/admin/challenges', label: t('challenges') },
    { to: '/admin/payments', label: t('paymentSettings') },
    { to: '/admin/banners', label: t('ads') },
    { to: '/admin/notify', label: t('notifications') }
  ]
  // operators only add products and members
  // operators: receive orders, answer messages, add products and members
  const OPERATOR = ['/admin/orders', '/admin/support', '/admin/products', '/admin/customers']
  const tabs = isAdmin ? all : OPERATOR.map(to => all.find(x => x.to === to)!).filter(Boolean)
  return (
    <div>
      <div className="app-bar !border-theme border-b" data-scrolled="true"><div className="page px-g pb-3">
        <div className="flex min-h-[56px] items-center gap-2">
          <h1 className="text-xl font-extrabold">{isAdmin ? t('admin') : t('role_operator')}</h1>
          <span className="h-1.5 w-10 rounded-full sanad-stripe" />
        </div>
        <nav className="no-scrollbar -mx-[var(--gutter)] flex gap-2 overflow-x-auto px-[var(--gutter)]">
          {tabs.map(tab => (
            <NavLink key={tab.to} to={tab.to} end={tab.end}
              replace className={({ isActive }) => cn('filter-chip', isActive && '!border-transparent !bg-[var(--primary)] !text-[var(--on-primary)]')}>
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div></div>
      <div className="page px-g pt-4"><Outlet /></div>
    </div>
  )
}
