// Demo history of the learner "Alex Martin" and state upgrades. No browser APIs here, so it can be
// tested in Node.
//
// The demo history is a pure function of its anchor date (createSeedState). Until the learner
// finishes a lesson of their own, the history follows the calendar: each new day opens on the same
// "living" day as the reference design (a lesson done today, the daily goal reached, the streak
// running). Everything the learner did themselves (answers, lessons in progress, minutes, messages,
// badges, settings) is carried over unchanged. Once they finish a lesson, nothing moves any more and
// every figure comes from what they actually do.
import type { LearnerState } from '../types';
import { createSeedState } from '../data/seed';
import { seedSubscription } from '../data/plans';
import { COURSES, courseLessons, getLesson } from '../data/courses';
import { newlyEarned } from './achievements';
import { addDays, dayKey, parseDay } from '../lib/dates';

/** Day on which a run of `n` consecutive active days was first completed (evening of that day). */
function streakReachedAt(s: LearnerState, n: number): string | null {
  const days = Object.keys(s.activity).filter((k) => s.activity[k] > 0).sort();
  let run = 0; let prev: string | null = null;
  for (const k of days) {
    run = prev && dayKey(addDays(parseDay(prev), 1)) === k ? run + 1 : 1;
    prev = k;
    if (run >= n) { const d = parseDay(k); d.setHours(19, 30, 0, 0); return d.toISOString() < s.seededAt ? d.toISOString() : s.seededAt; }
  }
  return null;
}

export function estimateEarnedAt(id: string, s: LearnerState): string {
  const done = Object.values(s.completions).filter((c) => c.passed).map((c) => c.at).sort();
  switch (id) {
    case 'first': return done[0] ?? s.seededAt;
    case 'ten': return done[9] ?? s.seededAt;
    case 'module': {
      const m = COURSES.flatMap((c) => c.modules).find((mm) => mm.lessons.every((l) => s.completions[l.id]?.passed));
      return m ? m.lessons.map((l) => s.completions[l.id].at).sort().slice(-1)[0] : s.seededAt;
    }
    case 'streak3': return streakReachedAt(s, 3) ?? addDays(new Date(s.seededAt), -2).toISOString();
    case 'streak7': return streakReachedAt(s, 7) ?? s.seededAt;
    case 'perfect': return Object.values(s.completions).filter((c) => c.total && c.score === c.total).map((c) => c.at).sort()[0] ?? s.seededAt;
    case 'assessor': return Object.entries(s.completions).filter(([lid, c]) => getLesson(lid)?.kind === 'assessment' && c.score / c.total >= 0.9).map(([, c]) => c.at).sort()[0] ?? s.seededAt;
    case 'polyglot': {
      const firsts = COURSES.filter((c) => c.category === 'langues').map((c) => courseLessons(c).map((l) => s.completions[l.id]?.at).filter(Boolean).sort()[0]).filter(Boolean).sort() as string[];
      return firsts[2] ?? s.seededAt;
    }
    default: return s.seededAt;
  }
}

/** The demo state anchored at a given moment, badges included. */
export function demoState(anchor: Date = new Date()): LearnerState {
  const s = createSeedState(anchor);
  for (const id of newlyEarned(s)) s.achievements[id] = estimateEarnedAt(id, s);
  return s;
}

/** v1 -> v2: the daily goal of the reference design is 10 minutes. */
export function migrate(s: LearnerState, now: Date = new Date()): LearnerState {
  let out = s;
  // saves from before the subscription existed get the demo subscription
  if (!out.subscription || !Array.isArray(out.subscription.invoices)) out = { ...out, subscription: seedSubscription(now) };
  if (out.version !== 2) out = { ...out, version: 2, profile: { ...out.profile, dailyGoalMin: out.profile.dailyGoalMin === 15 ? 10 : out.profile.dailyGoalMin } };
  // older saves used the model's name for the live answers mode
  const old = (v: unknown) => typeof v === 'string' && v !== 'live' && v !== 'demo' && v !== 'system';
  if (old(out.prefs?.aiMode) || out.conversation?.some((m) => m.source && old(m.source))) {
    out = {
      ...out,
      prefs: { ...out.prefs, aiMode: old(out.prefs.aiMode) ? 'live' : out.prefs.aiMode },
      conversation: out.conversation.map((m) => (m.source && old(m.source) ? { ...m, source: 'live' as const } : m)),
    };
  }
  return out;
}

/**
 * Moves the demo history to today when it was anchored on an earlier day and the learner has not
 * finished a lesson themselves. Returns the state unchanged otherwise. `updatedAt` is kept, so a
 * newer copy saved from another device still wins.
 */
export function reanchor(s: LearnerState, now: Date = new Date()): LearnerState {
  const anchor = s.seededAt;
  if (!anchor || dayKey(new Date(anchor)) >= dayKey(now)) return s;
  // The demo places everything at or before its anchor and the learner acts after it, so anything
  // dated after the anchor is the learner's own. A lesson finished (or retaken) by the learner means
  // the history is theirs from now on.
  const mine = (at: string | undefined) => !!at && at > anchor;
  if (Object.values(s.completions).some((c) => mine(c.at))) return s;

  const old = demoState(new Date(anchor));
  const fresh = demoState(now);

  // minutes the learner spent themselves, on the days they spent them (from the anchor day on)
  const activity = { ...fresh.activity };
  const anchorDay = dayKey(new Date(anchor));
  for (const [k, m] of Object.entries(s.activity)) {
    if (k < anchorDay) continue;
    const own = m - (old.activity[k] ?? 0);
    if (own > 0) activity[k] = (activity[k] ?? 0) + own;
  }

  // courses opened or joined by the learner
  const enrollments = { ...fresh.enrollments };
  for (const [cid, e] of Object.entries(s.enrollments)) {
    if (!mine(e.lastActiveAt)) continue;
    const f = fresh.enrollments[cid];
    enrollments[cid] = {
      enrolledAt: mine(e.enrolledAt) || !f ? e.enrolledAt : f.enrolledAt,
      lastActiveAt: f && f.lastActiveAt > e.lastActiveAt ? f.lastActiveAt : e.lastActiveAt,
    };
  }

  // seeded messages and notifications get today's dates; the learner's own ones stay as they are,
  // and anything the learner removed stays removed
  const msgAt = new Map(fresh.conversation.map((m) => [m.id, m.at]));
  const oldMsg = new Set(old.conversation.map((m) => m.id));
  const conversation = s.conversation.map((m) => (oldMsg.has(m.id) && msgAt.has(m.id) ? { ...m, at: msgAt.get(m.id)! } : m))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  const noteAt = new Map(fresh.notifications.map((n) => [n.id, n.at]));
  const oldNote = new Set(old.notifications.map((n) => n.id));
  const notifications = s.notifications.map((n) => (oldNote.has(n.id) && noteAt.has(n.id) ? { ...n, at: noteAt.get(n.id)! } : n))
    .sort((a, b) => (a.at > b.at ? -1 : a.at < b.at ? 1 : 0));

  // badges earned by the learner keep their date
  const achievements = { ...fresh.achievements };
  for (const [id, at] of Object.entries(s.achievements)) if (mine(at)) achievements[id] = at;

  // the subscription follows the calendar too, until the learner pays for it themselves
  const subscription = s.subscription?.invoices.some((i) => mine(i.at)) ? s.subscription : fresh.subscription;

  return {
    ...fresh,
    version: 2,
    profile: s.profile,
    prefs: s.prefs,
    currentCourseId: s.currentCourseId,
    enrollments,
    attempts: s.attempts,
    answerLog: s.answerLog,
    activity,
    achievements,
    conversation,
    assistantQuestions: s.assistantQuestions,
    notifications,
    subscription,
    updatedAt: s.updatedAt,
  };
}

/** Upgrades a stored state, or returns null when it cannot be used. */
export function adopt(saved: LearnerState | null | undefined, now: Date = new Date()): LearnerState | null {
  if (!saved || (saved.version !== 1 && saved.version !== 2) || !saved.completions || !saved.activity) return null;
  return reanchor(migrate(saved, now), now);
}
