// Minimal in-app router. Top-level pages are reflected in the URL hash as a bare token
// (#library, #progress…), the only kind of fragment the artifact viewer passes through.
import { useSyncExternalStore } from 'react';
import type { PageId, Route } from './types';

const PAGES: PageId[] = ['home', 'courses', 'course', 'library', 'progress', 'badges', 'messages', 'settings', 'lesson', 'subscription'];
const fromHash = (): Route => {
  const h = (location.hash || '').replace('#', '') as PageId;
  return PAGES.includes(h) && h !== 'lesson' && h !== 'course' ? { page: h } : { page: 'home' };
};

let route: Route = fromHash();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const before = new Set<(next: Route) => void>();
/** Runs before a new page renders (so the next page's effects see the new state). */
export const beforeNavigate = (fn: (next: Route) => void) => { before.add(fn); return () => { before.delete(fn); }; };

export function navigate(next: Route) {
  before.forEach((f) => f(next));
  route = next;
  try {
    const token = next.page === 'home' ? '' : next.page === 'lesson' || next.page === 'course' ? next.page : next.page;
    if ((location.hash || '').replace('#', '') !== token) history.pushState(null, '', token ? `#${token}` : location.pathname + location.search);
  } catch { /* sandboxed history: keep in-memory route */ }
  emit();
  window.scrollTo({ top: 0 });
}

window.addEventListener('popstate', () => {
  const h = fromHash();
  // lesson/course routes keep their parameters in memory
  if (!((location.hash === '#lesson' && route.page === 'lesson') || (location.hash === '#course' && route.page === 'course'))) {
    const changed = h.page !== route.page;
    before.forEach((f) => f(h)); route = h; emit();
    if (changed) window.scrollTo({ top: 0 });
  }
});

export const useRoute = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => route);
export const getRoute = () => route;
