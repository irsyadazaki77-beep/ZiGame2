import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { ToastProvider } from './utils/ToastContext';
import { ConfirmProvider } from './utils/ConfirmContext';
import { registerSW } from 'virtual:pwa-register';

// Automatically recover from stale Vite/Rollup chunk preloads (e.g. after server updates)
window.addEventListener('vite:preloadError', () => {
  const lastReload = sessionStorage.getItem('vite_chunk_reload');
  const now = Date.now();
  if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
    sessionStorage.setItem('vite_chunk_reload', String(now));
    window.location.reload();
  }
});

// Register PWA Service Worker only in production; in dev, unregister any stale SW that could intercept module fetches
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    registerSW({ immediate: true });
  } else {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister().catch(() => {});
        });
      })
      .catch(() => {});
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
