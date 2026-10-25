import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline support for the app itself (your songs are stored separately in IndexedDB)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* the app still works without it, just not offline */
    });
  });
}

// Lock pinch-zoom and double-tap zoom so it behaves like an app, not a web page.
['gesturestart', 'gesturechange', 'gestureend'].forEach((name) => document.addEventListener(name, (e) => e.preventDefault()));
let lastTouch = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouch < 300) e.preventDefault();
  lastTouch = now;
}, { passive: false });
