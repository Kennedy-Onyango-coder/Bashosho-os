import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// @ts-ignore - virtual module injected by vite-plugin-pwa
import { registerSW } from 'virtual:pwa-register';

if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  const isDev = (import.meta as any).env?.DEV || process.env.NODE_ENV !== "production";
  if (isDev) {
    // In dev mode, unregister existing service workers to prevent 404 sw.js fetch errors
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().catch(() => {});
      }
    }).catch(() => {});
  } else {
    // Register PWA service worker in production
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        console.log("[PWA] New version detected! Refreshing service worker...");
        updateSW(true);
      },
      onRegisteredSW(_swScriptUrl: string, registration: ServiceWorkerRegistration | undefined) {
        if (registration) {
          setInterval(() => {
            registration.update().catch(() => {});
          }, 60000);
        }
      },
      onRegisterError(error: any) {
        console.warn("[PWA] Service worker registration error:", error);
      }
    });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      console.log("[PWA] Service Worker controller changed. Reloading app to apply update...");
      window.location.reload();
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
