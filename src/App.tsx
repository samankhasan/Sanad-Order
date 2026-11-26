import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { Ban } from 'lucide-react'
import { supabase } from './lib/supabase'
import { deviceId } from './lib/analytics'
import { usePrefs } from './context/PrefsContext'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import AppShell from './components/AppShell'
import Login from './pages/Login'
import SetPassword from './pages/SetPassword'
import CompleteProfile, { needsProfileCompletion } from './pages/CompleteProfile'
import Home from './pages/Home'
import Category from './pages/Category'
import Cart from './pages/Cart'
import Orders from './pages/Orders'
import OrderDetail from './pages/OrderDetail'
import Profile from './pages/Profile'
import Notifications from './pages/Notifications'
import { NotificationsProvider } from './context/NotificationsContext'
import { assetUrl } from './lib/format'

// admin code is only downloaded by admins
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'))
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'))
const AdminCustomers = lazy(() => import('./pages/admin/AdminCustomers'))
const AdminNotify = lazy(() => import('./pages/admin/AdminNotify'))
const AdminCategories = lazy(() => import('./pages/admin/AdminCategories'))
const AdminBanners = lazy(() => import('./pages/admin/AdminBanners'))

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="flex flex-col items-center gap-5">
        <img src={assetUrl('brands/sanad-mark.png')} alt="Sanad" className="h-24 animate-pulse" />
        <div className="h-1.5 w-20 rounded-full sanad-stripe" />
      </div>
    </div>
  )
}

/** Blocked members (and their devices / connection) see only this screen. */
function useBlocked(userId: string | null, profileBlocked: boolean) {
  const [blocked, setBlocked] = useState(false)
  useEffect(() => {
    let live = true
    supabase.rpc('access_check', { p_device: deviceId() }).then(({ data }) => { if (live) setBlocked(data === true) }, () => {})
    return () => { live = false }
  }, [userId, profileBlocked])
  return blocked || profileBlocked
}

function Blocked() {
  const { t } = usePrefs()
  const { session } = useAuth()
  // a still-valid session is dropped so nothing else can be used
  useEffect(() => { if (session) supabase.auth.signOut({ scope: 'local' }) }, [session])
  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="flex max-w-sm flex-col items-center gap-4">
        <span className="grid size-20 place-items-center rounded-[28px] bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400"><Ban className="size-10" /></span>
        <h1 className="text-xl font-black">{t('accountBlockedTitle')}</h1>
        <p className="text-sm leading-7 text-2">{t('accountBlocked')}</p>
      </div>
    </div>
  )
}

function AdminOnly({ children }: { children: ReactNode }) {
  const { isAdmin, isStaff, profile } = useAuth()
  if (!profile) return <Splash />
  return isAdmin ? <>{children}</> : <Navigate to={isStaff ? '/admin/products' : '/'} replace />
}

function StaffOnly({ children }: { children: ReactNode }) {
  const { isStaff, profile } = useAuth()
  if (!profile) return <Splash />
  return isStaff ? <>{children}</> : <Navigate to="/" replace />
}

export default function App() {
  const { session, loading, recovery, profile } = useAuth()
  const blocked = useBlocked(session?.user.id ?? null, !!profile?.blocked_at && profile.role !== 'admin')
  if (loading) return <Splash />
  if (blocked) return <Blocked />
  if (!session) return <Login />
  if (recovery) return <SetPassword />
  if (needsProfileCompletion(profile)) return <CompleteProfile />
  return (
    <HashRouter>
      <NotificationsProvider>
      <Suspense fallback={<Splash />}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Home />} />
            <Route path="c/:slug" element={<Category />} />
            <Route path="cart" element={<Cart />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="profile" element={<Profile />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="admin" element={<StaffOnly><AdminLayout /></StaffOnly>}>
              <Route index element={<AdminOnly><AdminDashboard /></AdminOnly>} />
              <Route path="orders" element={<AdminOnly><AdminOrders /></AdminOnly>} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="customers" element={<AdminCustomers />} />
              <Route path="notify" element={<AdminOnly><AdminNotify /></AdminOnly>} />
              <Route path="banners" element={<AdminOnly><AdminBanners /></AdminOnly>} />
              <Route path="categories" element={<AdminOnly><AdminCategories /></AdminOnly>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
      </NotificationsProvider>
    </HashRouter>
  )
}
