import { useSyncExternalStore } from 'react';

export type Route = { path: string; parts: string[]; query: URLSearchParams };

function read(): Route {
  const raw = location.hash.replace(/^#/, '') || '/learn';
  const [path, qs = ''] = raw.split('?');
  return { path, parts: path.split('/').filter(Boolean), query: new URLSearchParams(qs) };
}

let current = read();
const subs = new Set<() => void>();
window.addEventListener('hashchange', () => {
  current = read();
  subs.forEach((f) => f());
  window.scrollTo(0, 0);
});

export function useRoute(): Route {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => current,
  );
}

export function go(to: string) {
  location.hash = to;
}

/** Переход на родительский экран. Явный адрес надежнее истории браузера в PWA и APK. */
export function back(parent: string) {
  go(parent);
}
