import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource/golos-text/400.css';
import '@fontsource/golos-text/500.css';
import '@fontsource/golos-text/600.css';
import '@fontsource/golos-text/700.css';
import 'katex/dist/katex.min.css';
import './styles.css';
import { App } from './App';
import { flush, loadState } from './store';
import { isNative } from './platform';

// В APK и Windows файлы уже лежат внутри приложения, сервис-воркер не нужен.
if (!isNative()) registerSW({ immediate: true });
window.addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());

loadState().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
