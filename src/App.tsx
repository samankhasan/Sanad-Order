import { lazy, Suspense, type ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import AppShell from './components/AppShell'
import Login from './pages/Login'
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

function AdminOnly({ children }: { children: ReactNode }) {
  const { isAdmin, profile } = useAuth()
  if (!profile) return <Splash />
  return isAdmin ? <>{children}</> : <Navigate to="/" replace />
}

export default function App() {
  const { session, loading } = useAuth()
  if (loading) return <Splash />
  if (!session) return <Login />
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
            <Route path="admin" element={<AdminOnly><AdminLayout /></AdminOnly>}>
              <Route index element={<AdminDashboard />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="customers" element={<AdminCustomers />} />
              <Route path="notify" element={<AdminNotify />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
      </NotificationsProvider>
    </HashRouter>
  )
}
