import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ToastProvider } from './context/ToastContext.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { ShopProvider } from './context/ShopContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ShopProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ShopProvider>
    </AuthProvider>
  </StrictMode>,
)
