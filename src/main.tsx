import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import {ErrorBoundary} from './components/ErrorBoundary.tsx';
import './index.css';

if (typeof window !== 'undefined') {
  registerSW({immediate: true});
}

// Prevent transient Vite HMR WebSocket disconnects in managed environments from surfacing noisy errors
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const msg =
      event.reason instanceof Error
        ? event.reason.message
        : String(event.reason ?? '');
    if (
      msg.includes('WebSocket closed without opened') ||
      msg.includes('WebSocket is closed') ||
      msg.includes('vite')
    ) {
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
