// Persistence adapters.
//  - Browser storage (always tried; may be unavailable in private windows)
//  - The Artifact `db` capability: a private per-viewer document, synced across devices.
// Both are optional: the app keeps working in memory when neither is available.
import type { LearnerState } from '../types';

const KEY = 'learnspace:v1';

export const local = {
  load(): LearnerState | null {
    try { const raw = window.localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as LearnerState) : null; } catch { return null; }
  },
  save(s: LearnerState): boolean {
    try { window.localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch { return false; }
  },
  clear() { try { window.localStorage.removeItem(KEY); } catch { /* ignore */ } },
};

type DocRef = { get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>; set(d: Record<string, unknown>): Promise<void> };

export interface CloudAdapter { load(): Promise<LearnerState | null>; save(s: LearnerState): Promise<void> }

/** Resolves a cloud adapter when this view can keep per-viewer data, otherwise null. */
export async function connectCloud(): Promise<CloudAdapter | null> {
  const rt = (window as any).claude; // the artifact runtime's API object
  if (!rt || typeof rt.use !== 'function') return null;
  try {
    const [db, user] = await Promise.all([rt.use('db'), rt.use('user')]);
    if (!db || !user) return null;
    const id: string | null = await user.id();
    if (!id) return null;
    const ref: DocRef = db.doc(`data/users/${id}/learnspace`);
    let writing: Promise<void> | null = null; let pending: LearnerState | null = null;
    const flush = async (): Promise<void> => {
      while (pending) {
        const s = pending; pending = null;
        await ref.set({ state: JSON.stringify(s), savedAt: new Date().toISOString() });
      }
    };
    // one write at a time; the latest state wins
    const save = (s: LearnerState): Promise<void> => {
      pending = s;
      if (!writing) {
        writing = flush().finally(() => { writing = null; if (pending) void save(pending); });
      }
      return writing;
    };
    return {
      async load() {
        const snap = await ref.get();
        if (!snap.exists) return null;
        const raw = snap.data()?.state;
        try { return typeof raw === 'string' ? (JSON.parse(raw) as LearnerState) : null; } catch { return null; }
      },
      save,
    };
  } catch {
    return null;
  }
}
