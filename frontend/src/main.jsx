import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'
import useDesignStore from './store/designStore'

// Dizayn sozlamalarini ilova ochilishida qo'llash
useDesignStore.getState().init()

// ── 6.3 PWA: Service Worker ro'yxatga olish ──────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
  <BrowserRouter>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3500,
        style: {
          borderRadius: '12px',
          padding: '12px 16px',
          fontSize: '13px',
          fontWeight: '500',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          maxWidth: '360px',
        },
        success: { style: { background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' } },
        error:   { style: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' } },
      }}
    />
  </BrowserRouter>
  </ErrorBoundary>
)
