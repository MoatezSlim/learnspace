// Demonstration history for the learner "Alex Martin". Dates are generated relative to the
// first launch so the dashboard always shows a living streak. All figures shown in the app
// are computed from this history plus what the learner actually does.
import { seedSubscription } from './plans';
import type { LearnerState, Completion, ChatMessage, AppNotification } from '../types';
import { COURSES, courseLessons, getCourse } from './courses';
import { addDays, dayKey } from '../lib/dates';

const at = (base: Date, dayOffset: number, hour: number, minute = 0) => {
  const d = addDays(base, dayOffset); d.setHours(hour, minute, 0, 0); return d;
};

// deterministic pseudo-random so every first launch looks the same
function rng(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }

export function createSeedState(now = new Date()): LearnerState {
  const r = rng(42);
  const completions: Record<string, Completion> = {};
  const activity: Record<string, number> = {};
  const addMin = (d: Date, m: number) => { const k = dayKey(d); activity[k] = (activity[k] ?? 0) + m; };

  // ---- Anglais: modules 1–3 complete, module 4 lesson 1 done today ----
  const en = getCourse('en-b1')!;
  const [m1, m2, m3, m4] = en.modules;
  const place = (lessons: typeof m1.lessons, days: number[], scores: [number, number][]) => {
    lessons.forEach((l, i) => {
      const d = at(now, days[i], 18 + (i % 3), 10 + i * 4);
      const [score, total] = scores[i];
      completions[l.id] = { at: d.toISOString(), score, total, minutes: l.minutes, passed: true };
    });
  };
  place(m1.lessons, [-41, -40, -38, -37, -35, -34, -33, -31], [[4, 5], [5, 5], [4, 5], [3, 5], [4, 5], [4, 5], [3, 5], [7, 8]]);
  place(m2.lessons, [-27, -26, -24, -22, -20, -19, -15, -13], [[4, 5], [3, 5], [4, 5], [4, 5], [4, 5], [3, 5], [4, 5], [6, 8]]);
  place(m3.lessons, [-4, -4, -3, -3, -2, -1, -1], [[4, 5], [4, 5], [3, 5], [3, 5], [4, 5], [4, 5], [11, 12]]);
  const l41 = m4.lessons[0];
  // a few minutes to three hours ago, and always today (also in the first minutes after midnight)
  const sinceMidnight = (now.getHours() * 60 + now.getMinutes()) * 60e3 + now.getSeconds() * 1e3;
  let ago = Math.min(3 * 3600e3, Math.max(5 * 60e3, sinceMidnight - 5 * 60e3));
  if (ago >= sinceMidnight) ago = sinceMidnight / 2;
  const doneToday = new Date(now.getTime() - ago);
  completions[l41.id] = { at: doneToday.toISOString(), score: 2, total: 3, minutes: 8, passed: true };

  // ---- Other languages: earlier progress ----
  const progressCounts: Record<string, number> = { 'es-a2': 11, 'fr-b1': 16, 'de-a1': 8, 'it-b1': 11, 'ru-c1': 7 };
  const firstDays: Record<string, number> = { 'es-a2': -58, 'fr-b1': -60, 'de-a1': -52, 'it-b1': -56, 'ru-c1': -50 };
  for (const [cid, n] of Object.entries(progressCounts)) {
    const c = getCourse(cid)!;
    courseLessons(c).slice(0, n).forEach((l, i) => {
      const day = Math.min(-8, firstDays[cid] + Math.floor(i * 2.6));
      const d = at(now, day === -5 ? -6 : day, 12 + (i % 6), 5 + i);
      const total = 3, score = r() > 0.25 ? 3 : 2;
      completions[l.id] = { at: d.toISOString(), score, total, minutes: l.minutes, passed: true };
    });
  }

  // ---- Learning minutes per day: lessons + practice, totalling 12 h 40 ----
  for (const c of Object.values(completions)) addMin(new Date(c.at), c.minutes);
  // the last seven days are set explicitly (streak of five days: day -5 is a rest day)
  const recent: Record<number, number> = { [-6]: 18, [-5]: 0, [-4]: 24, [-3]: 31, [-2]: 22, [-1]: 25, [0]: 10 };
  for (const [off, m] of Object.entries(recent)) { const k = dayKey(addDays(now, Number(off))); if (m) activity[k] = m; else delete activity[k]; }
  // older days: rescale or top up practice time so that the grand total is exactly 760 minutes
  const recentKeys = new Set(Object.keys(recent).map((o) => dayKey(addDays(now, Number(o)))));
  const recentSum = Object.values(recent).reduce((a, b) => a + b, 0);
  const target = 760 - recentSum;
  const older = () => Object.keys(activity).filter((k) => !recentKeys.has(k));
  let olderSum = older().reduce((a, k) => a + activity[k], 0);
  if (olderSum > target) {
    const f = target / olderSum;
    for (const k of older()) activity[k] = Math.max(1, Math.round(activity[k] * f));
  } else {
    for (let off = -60; off <= -8 && olderSum < target; off++) {
      const k = dayKey(addDays(now, off));
      const extra = Math.min(target - olderSum, Math.round(6 + r() * 14));
      if (r() < 0.45 || activity[k]) { activity[k] = (activity[k] ?? 0) + extra; olderSum += extra; }
    }
  }
  olderSum = older().reduce((a, k) => a + activity[k], 0);
  const biggest = older().sort((a, b) => activity[b] - activity[a])[0];
  if (biggest) activity[biggest] += target - olderSum;

  const iso = (d: Date) => d.toISOString();
  const enrollments: LearnerState['enrollments'] = {};
  for (const c of COURSES) {
    const done = courseLessons(c).filter((l) => completions[l.id]).map((l) => completions[l.id].at).sort();
    if (done.length) enrollments[c.id] = { enrolledAt: done[0], lastActiveAt: done[done.length - 1] };
  }

  const yesterday1024 = at(now, -1, 10, 24);
  const conversation: ChatMessage[] = [
    {
      id: 'seed-1', role: 'assistant', source: 'demo', at: iso(new Date(yesterday1024.getTime() - 2 * 60e3)),
      text: 'Tu es sur la bonne voie ! Je te conseille de faire une pause, puis de revoir la leçon sur les verbes irréguliers. 💡',
      actions: [{ kind: 'lesson', lessonId: 'en-b1-review-irregular', label: 'Ouvrir la révision express' }],
    },
    { id: 'seed-2', role: 'user', at: iso(yesterday1024), text: 'Merci ! Ça fait vraiment plaisir d’avoir un accompagnement comme ça. 😊' },
    { id: 'seed-3', role: 'assistant', source: 'demo', at: iso(new Date(yesterday1024.getTime() + 30e3)), text: 'Avec plaisir ! Si tu as des questions, je suis là pour t’aider à tout moment. Tu assures ! 💪' },
  ];

  const notifications: AppNotification[] = [
    { id: 'n-seed-1', at: iso(doneToday), title: 'Leçon terminée', body: 'Airport announcements · 2/3 bonnes réponses', read: false, kind: 'lesson' },
    { id: 'n-seed-2', at: iso(at(now, -1, 19, 5)), title: 'Badge obtenu : Évaluation réussie', body: 'Tu as obtenu 92 % à l’évaluation du module 3.', read: false, kind: 'badge' },
    { id: 'n-seed-3', at: iso(at(now, -2, 8, 30)), title: 'Série en cours', body: 'Trois jours d’apprentissage d’affilée. Continue !', read: true, kind: 'streak' },
  ];

  return {
    version: 2,
    profile: { firstName: 'Alex', lastName: 'Martin', dailyGoalMin: 10 },
    prefs: { voice: true, voiceURI: '', rate: 1, motion: 'system', aiMode: 'live' },
    currentCourseId: 'en-b1',
    enrollments,
    completions,
    attempts: {},
    answerLog: [],
    activity,
    achievements: {},
    conversation,
    assistantQuestions: 1,
    notifications,
    subscription: seedSubscription(now),
    seededAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}
