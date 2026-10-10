// Interface-only state shared across the shell: the dialogs opened from the sidebar.
import { useSyncExternalStore } from 'react';
import type { PlanId } from '../types';

export interface Overlays { newCourse: boolean; payment: { plan: PlanId | null } | null; photo: boolean }
let state: Overlays = { newCourse: false, payment: null, photo: false };
const ls = new Set<() => void>();
const set = (p: Partial<Overlays>) => { state = { ...state, ...p }; ls.forEach((l) => l()); };

export const overlays = {
  openNewCourse: () => set({ newCourse: true, payment: null }),
  closeNewCourse: () => set({ newCourse: false }),
  /** the payment dialog, preset on a plan (null: the current one) */
  openPayment: (plan: PlanId | null = null) => set({ payment: { plan }, newCourse: false }),
  closePayment: () => set({ payment: null }),
  openPhoto: () => set({ photo: true, newCourse: false, payment: null }),
  closePhoto: () => set({ photo: false }),
};
export const useOverlays = () => useSyncExternalStore((l) => { ls.add(l); return () => ls.delete(l); }, () => state);
