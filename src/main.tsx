import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App'
import { PrefsProvider } from './context/PrefsContext'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { ToastProvider } from './context/ToastContext'
import { initNative } from './lib/native'

initNative()

// Service worker only on the web (Capacitor serves files locally)
if (!('Capacitor' in window)) registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrefsProvider>
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
            <App />
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    </PrefsProvider>
  </StrictMode>
)
