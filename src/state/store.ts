// Learner store: a small external store (useSyncExternalStore) with explicit actions.
// Every statistic in the UI derives from this state; actions are the only writers.
import { useSyncExternalStore } from 'react';
import type { LearnerState, LessonAttempt, ChatMessage, AppNotification, Prefs, Completion, PlanId, Invoice } from '../types';
import { adopt, demoState } from './demo';
import { getLesson, getCourse } from '../data/courses';
import { checkAnswer } from './selectors';
import { ACHIEVEMENTS, newlyEarned, achievement } from './achievements';
import { local, connectCloud, CloudAdapter } from './persistence';
import { dayKey, addMonths, longDate } from '../lib/dates';
import { PLANS, PLAN_NAME, DEMO_METHOD } from '../data/plans';

type Listener = () => void;
export type SyncStatus = 'loading' | 'cloud' | 'local' | 'memory';

const uid = () => Math.random().toString(36).slice(2, 10);
const nowIso = () => new Date().toISOString();

/** Stored progress (upgraded, demo history moved to today when needed), else a new demo state. */
function initialState(): { state: LearnerState; fresh: boolean } {
  const saved = adopt(local.load());
  return saved ? { state: saved, fresh: false } : { state: demoState(), fresh: true };
}
const boot = initialState();

export interface LessonResult { completion: Completion; newBadges: string[]; firstTime: boolean }

class LearnStore {
  state: LearnerState = boot.state;
  /** true while the state is a demo nobody has touched: stored progress always replaces it */
  private untouched = boot.fresh;
  sync: { status: SyncStatus; savedAt: string | null } = { status: 'loading', savedAt: null };
  private listeners = new Set<Listener>();
  private cloud: CloudAdapter | null = null;
  private timer: number | undefined;

  subscribe = (l: Listener) => { this.listeners.add(l); return () => this.listeners.delete(l); };
  getSnapshot = () => this.state;
  private emit() { this.listeners.forEach((l) => l()); }

  /** Connect to per-viewer storage; adopt the stored progress if it is newer. */
  async hydrate() {
    const hadLocal = !!local.load();
    this.cloud = await connectCloud();
    if (this.cloud) {
      try {
        const raw = await this.cloud.load();
        const remote = adopt(raw);
        if (remote && (this.untouched || remote.updatedAt > this.state.updatedAt)) { this.state = remote; this.untouched = false; local.save(this.state); }
        this.sync = { status: 'cloud', savedAt: raw ? raw.updatedAt : null };
      } catch { this.cloud = null; }
    }
    if (!this.cloud) this.sync = { status: local.save(this.state) || hadLocal ? 'local' : 'memory', savedAt: hadLocal ? this.state.updatedAt : null };
    this.emit();
  }

  private set(mut: (draft: LearnerState) => void) {
    const draft: LearnerState = structuredCloneSafe(this.state);
    mut(draft);
    this.untouched = false;
    draft.updatedAt = nowIso();
    this.state = draft;
    this.emit();
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => { this.timer = undefined; void this.persist(); }, 700);
  }

  /** Save now when a save is waiting (the page is being hidden or closed). */
  flush() {
    if (this.timer === undefined) return;
    window.clearTimeout(this.timer); this.timer = undefined;
    void this.persist();
  }

  private async persist() {
    const s = this.state;
    const okLocal = local.save(s);
    if (this.cloud) {
      try { await this.cloud.save(s); this.sync = { status: 'cloud', savedAt: s.updatedAt }; }
      catch { this.sync = { status: okLocal ? 'local' : 'memory', savedAt: okLocal ? s.updatedAt : null }; }
    } else this.sync = { status: okLocal ? 'local' : 'memory', savedAt: okLocal ? s.updatedAt : null };
    this.emit();
  }

  // ---------------------------------------------------------------- lessons
  startLesson(lessonId: string) {
    const l = getLesson(lessonId); if (!l) return;
    this.set((s) => {
      if (!s.attempts[lessonId]) s.attempts[lessonId] = { step: 0, answers: {}, revealed: {}, startedAt: nowIso(), activeMs: 0, mediaDone: false };
      const isCourseLesson = getCourse(l.courseId)?.modules.some((m) => m.id === l.moduleId);
      if (isCourseLesson) {
        s.enrollments[l.courseId] = { enrolledAt: s.enrollments[l.courseId]?.enrolledAt ?? nowIso(), lastActiveAt: nowIso() };
        s.currentCourseId = l.courseId;
      }
    });
  }
  setStep(lessonId: string, step: number) { this.patchAttempt(lessonId, (a) => { a.step = step; }); }
  markMediaDone(lessonId: string) { if (!this.state.attempts[lessonId]?.mediaDone) this.patchAttempt(lessonId, (a) => { a.mediaDone = true; }); }
  addActiveTime(lessonId: string, ms: number) { if (ms > 0) this.patchAttempt(lessonId, (a) => { a.activeMs += ms; }, true); }

  answer(lessonId: string, questionId: string, value: string): { correct: boolean; attempt: number } {
    const q = getLesson(lessonId)?.questions?.find((x) => x.id === questionId);
    if (!q) return { correct: false, attempt: 0 };
    const correct = checkAnswer(q, value);
    let attempt = 1;
    this.set((s) => {
      const a = s.attempts[lessonId]; if (!a) return;
      const list = (a.answers[questionId] ??= []);
      list.push({ value, correct });
      attempt = list.length;
      s.answerLog.push({ lessonId, questionId, value, correct, attempt, at: nowIso() });
      if (s.answerLog.length > 300) s.answerLog.splice(0, s.answerLog.length - 300);
    });
    return { correct, attempt };
  }
  reveal(lessonId: string, questionId: string) { this.patchAttempt(lessonId, (a) => { a.revealed[questionId] = true; }); }

  /** Scores the attempt from first answers, records the completion and the learning time. */
  completeLesson(lessonId: string): LessonResult | null {
    const l = getLesson(lessonId); const a = this.state.attempts[lessonId];
    if (!l || !a || !l.questions) return null;
    const total = l.questions.length;
    const score = l.questions.filter((q) => a.answers[q.id]?.[0]?.correct).length;
    const passed = l.passMark ? score / total >= l.passMark : true;
    const minutes = Math.max(1, Math.min(l.minutes * 2, Math.round(a.activeMs / 60000)));
    const completion: Completion = { at: nowIso(), score, total, minutes, passed };
    const firstTime = !this.state.completions[lessonId]?.passed;
    let newBadges: string[] = [];
    this.set((s) => {
      const prev = s.completions[lessonId];
      // keep the best result; a failed retry never erases a passed lesson
      if (!prev || (passed && (!prev.passed || score >= prev.score)) || (!prev.passed && score > prev.score)) s.completions[lessonId] = completion;
      const k = dayKey(new Date());
      s.activity[k] = (s.activity[k] ?? 0) + minutes;
      delete s.attempts[lessonId];
      pushNote(s, { title: passed ? 'Leçon terminée' : 'Évaluation à repasser', body: `${l.title} · ${score}/${total} bonne${score > 1 ? 's' : ''} réponse${score > 1 ? 's' : ''}`, kind: 'lesson' });
      newBadges = newlyEarned(s);
      for (const id of newBadges) { s.achievements[id] = nowIso(); pushNote(s, { title: `Badge obtenu : ${achievement(id).title}`, body: achievement(id).description, kind: 'badge' }); }
    });
    return { completion, newBadges, firstTime };
  }
  restartLesson(lessonId: string) {
    this.set((s) => { s.attempts[lessonId] = { step: 0, answers: {}, revealed: {}, startedAt: nowIso(), activeMs: 0, mediaDone: false }; });
  }
  /** Time spent in a lesson that was left before the end still counts as learning time. */
  logPartialTime(lessonId: string) {
    const a = this.state.attempts[lessonId]; if (!a || a.activeMs < 60000) return;
    const minutes = Math.round(a.activeMs / 60000);
    this.set((s) => { const k = dayKey(new Date()); s.activity[k] = (s.activity[k] ?? 0) + minutes; if (s.attempts[lessonId]) s.attempts[lessonId].activeMs = 0; });
  }

  private patchAttempt(lessonId: string, fn: (a: LessonAttempt) => void, quiet = false) {
    if (!this.state.attempts[lessonId]) return;
    if (quiet) { // frequent timing updates: mutate a copy without notifying React
      const a = { ...this.state.attempts[lessonId] }; fn(a);
      this.state = { ...this.state, attempts: { ...this.state.attempts, [lessonId]: a } };
      return;
    }
    this.set((s) => fn(s.attempts[lessonId]));
  }

  // ---------------------------------------------------------------- courses
  enroll(courseId: string) {
    this.set((s) => { if (!s.enrollments[courseId]) s.enrollments[courseId] = { enrolledAt: nowIso(), lastActiveAt: nowIso() }; });
  }
  setCurrentCourse(courseId: string) { this.set((s) => { s.currentCourseId = courseId; }); }

  // ---------------------------------------------------------------- assistant
  addMessage(m: Omit<ChatMessage, 'id' | 'at'> & { id?: string }): string {
    const id = m.id ?? uid();
    this.set((s) => {
      s.conversation.push({ ...m, id, at: nowIso() });
      if (s.conversation.length > 60) s.conversation.splice(0, s.conversation.length - 60);
      if (m.role === 'user') s.assistantQuestions += 1;
    });
    return id;
  }
  updateMessage(id: string, patch: Partial<ChatMessage>, persist = true) {
    if (!persist) {
      this.state = { ...this.state, conversation: this.state.conversation.map((m) => (m.id === id ? { ...m, ...patch } : m)) };
      this.emit(); return;
    }
    this.set((s) => { const m = s.conversation.find((x) => x.id === id); if (m) Object.assign(m, patch); });
  }
  clearConversation() { this.set((s) => { s.conversation = []; }); }
  checkBadges(): string[] {
    let earned: string[] = [];
    this.set((s) => { earned = newlyEarned(s); for (const id of earned) { s.achievements[id] = nowIso(); pushNote(s, { title: `Badge obtenu : ${achievement(id).title}`, body: achievement(id).description, kind: 'badge' }); } });
    return earned;
  }

  // ---------------------------------------------------------------- subscription
  /** Demo payment: nothing is charged; the paid period is extended from its end (or from now when it
   * has already ended) and an invoice is recorded. */
  paySubscription(plan: PlanId): Invoice {
    const now = new Date();
    const p = PLANS[plan];
    const sub = this.state.subscription;
    const end = new Date(sub.paidUntil);
    const from = end > now ? end : now;
    const to = addMonths(from, p.months);
    const inv: Invoice = {
      id: `F-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(1040 + (sub.invoices.length + 1) * 37)}`,
      at: now.toISOString(), amount: p.price, plan, from: from.toISOString(), to: to.toISOString(), method: DEMO_METHOD,
    };
    this.set((s) => {
      s.subscription.invoices.push(inv);
      s.subscription.plan = plan;
      s.subscription.paidUntil = inv.to;
      pushNote(s, { title: 'Paiement reçu', body: `${PLAN_NAME} (${p.label.toLowerCase()}) prolongé jusqu’au ${longDate(to, now)}.`, kind: 'payment' });
    });
    return inv;
  }

  // ---------------------------------------------------------------- settings
  setPrefs(p: Partial<Prefs>) { this.set((s) => { Object.assign(s.prefs, p); }); }
  setProfile(p: Partial<LearnerState['profile']>) { this.set((s) => { Object.assign(s.profile, p); }); }
  markNotificationsRead() { this.set((s) => { s.notifications.forEach((n) => { n.read = true; }); }); }
  resetDemo() {
    const prefs = this.state.prefs;
    const fresh = demoState();
    fresh.prefs = prefs;
    this.state = fresh; this.emit();
    window.clearTimeout(this.timer); this.timer = window.setTimeout(() => { this.timer = undefined; void this.persist(); }, 100);
  }
}

function pushNote(s: LearnerState, n: Omit<AppNotification, 'id' | 'at' | 'read'>) {
  s.notifications.unshift({ ...n, id: uid(), at: nowIso(), read: false });
  if (s.notifications.length > 30) s.notifications.length = 30;
}

function structuredCloneSafe<T>(v: T): T {
  return typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v));
}

export const store = new LearnStore();
// a change made just before the page is hidden or closed is saved right away
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => store.flush());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') store.flush(); });
}
export const useLearner = () => useSyncExternalStore(store.subscribe, store.getSnapshot);
export const ALL_ACHIEVEMENTS = ACHIEVEMENTS;
