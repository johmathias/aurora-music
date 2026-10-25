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
// iPhone Home Screen apps can report a window that is shorter than the real screen,
// which leaves an empty strip under the tab bar. Measure it and stretch the bottom edge.
function fixBottomGap() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  const portrait = window.matchMedia('(orientation: portrait)').matches;
  const raw = standalone && portrait ? Math.round(window.screen.height - window.innerHeight) : 0;
  const gap = raw > 0 && raw <= 100 ? raw : 0;
  document.documentElement.style.setProperty('--gap', `${gap}px`);
}
const gapStyle = document.createElement('style');
gapStyle.textContent = `
  :root { --gap: 0px; }
  .app, .np, .sheet-layer, .menu-layer, .alert-layer { bottom: calc(var(--gap) * -1) !important; }
  .tabbar { bottom: calc(var(--gap) * -1) !important; }
  .mini { bottom: calc(var(--tabbar-h) + var(--safe-bottom) + 8px - var(--gap)) !important; }
`;
document.head.appendChild(gapStyle);
fixBottomGap();
window.addEventListener('resize', fixBottomGap);
window.addEventListener('orientationchange', fixBottomGap);
