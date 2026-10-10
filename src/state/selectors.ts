// Everything displayed as a statistic is derived here from LearnerState.
import type { LearnerState, Lesson, Course, SkillId, Question } from '../types';
import { COURSES, getCourse, courseLessons, isPlayable, getLesson, PRACTICE_LESSONS, SKILL_LABEL } from '../data/courses';
import { addDays, dayKey, daysBetween, startOfDay, addMonths, shortDateY } from '../lib/dates';
import { PLANS, DUE_DAYS } from '../data/plans';

export const pct = (done: number, total: number) => (total ? Math.floor((done / total) * 100) : 0);

export function courseStats(s: LearnerState, c: Course) {
  const lessons = courseLessons(c);
  const done = lessons.filter((l) => s.completions[l.id]?.passed).length;
  const next = lessons.find((l) => !s.completions[l.id]?.passed);
  const module = next ? c.modules.find((m) => m.id === next.moduleId) : c.modules[c.modules.length - 1];
  return { total: lessons.length, done, pct: pct(done, lessons.length), next, module, enrolled: !!s.enrollments[c.id] };
}

export interface Recommendation { lesson: Lesson; course: Course; reason: 'continue' | 'other-course' | 'review' }

/** The next meaningful activity: continue the current path, else another course, else a review. */
export function recommendation(s: LearnerState): Recommendation | null {
  const current = getCourse(s.currentCourseId);
  const order = [current, ...COURSES.filter((c) => c.id !== s.currentCourseId && s.enrollments[c.id])
    .sort((a, b) => (s.enrollments[b.id].lastActiveAt > s.enrollments[a.id].lastActiveAt ? 1 : -1))].filter(Boolean) as Course[];
  for (const [i, c] of order.entries()) {
    const { next } = courseStats(s, c);
    if (next && isPlayable(next)) return { lesson: next, course: c, reason: i === 0 ? 'continue' : 'other-course' };
  }
  const review = PRACTICE_LESSONS[0];
  return { lesson: review, course: getCourse(review.courseId)!, reason: 'review' };
}

export const todayMinutes = (s: LearnerState) => Math.round(s.activity[dayKey(new Date())] ?? 0);
export const totalMinutes = (s: LearnerState) => Math.round(Object.values(s.activity).reduce((a, b) => a + b, 0));
export function rangeMinutes(s: LearnerState, fromOffset: number, toOffset = 0) {
  let sum = 0; const now = new Date();
  for (let o = fromOffset; o <= toOffset; o++) sum += s.activity[dayKey(addDays(now, o))] ?? 0;
  return Math.round(sum);
}
export const weekMinutes = (s: LearnerState) => rangeMinutes(s, -6, 0);

export function streak(s: LearnerState) {
  const now = new Date();
  const active = (o: number) => (s.activity[dayKey(addDays(now, o))] ?? 0) > 0;
  const todayActive = active(0);
  let days = 0;
  for (let o = todayActive ? 0 : -1; active(o); o--) days++;
  let best = 0, run = 0;
  for (let o = -120; o <= 0; o++) { if (active(o)) { run++; best = Math.max(best, run); } else run = 0; }
  return { days, todayActive, best };
}

export function lessonsCompletedOn(s: LearnerState, dayOffset: number, courseId?: string) {
  const k = dayKey(addDays(new Date(), dayOffset));
  return Object.entries(s.completions).filter(([id, c]) => c.passed && dayKey(new Date(c.at)) === k && (!courseId || getLesson(id)?.courseId === courseId)).length;
}

const SKILL_STEPS = [3, 6, 10, 15, 21];
export function skillLevels(s: LearnerState, courseId: string) {
  const c = getCourse(courseId)!;
  const counts: Partial<Record<SkillId, number>> = {};
  for (const l of courseLessons(c)) if (s.completions[l.id]?.passed) counts[l.skill] = (counts[l.skill] ?? 0) + 1;
  const order: SkillId[] = ['listening', 'vocabulary', 'grammar', 'speaking', 'reading', 'writing', 'method', 'culture'];
  const present = new Set(courseLessons(c).map((l) => l.skill));
  return order.filter((k) => present.has(k)).map((skill) => {
    const n = counts[skill] ?? 0;
    const level = SKILL_STEPS.filter((t) => n >= t).length;
    const nextAt = SKILL_STEPS[level] ?? null;
    const prevAt = level ? SKILL_STEPS[level - 1] : 0;
    return { skill, label: SKILL_LABEL[skill], count: n, level, nextAt, toNext: nextAt ? (n - prevAt) / (nextAt - prevAt) : 1 };
  });
}

export function competencies(s: LearnerState, courseId: string) {
  const c = getCourse(courseId)!;
  const weekAgo = startOfDay(addDays(new Date(), -6)).getTime();
  const list = c.modules.flatMap((m) => m.competencies.map((comp) => {
    const dates = comp.lessonIds.map((id) => s.completions[id]?.passed ? s.completions[id].at : null);
    const acquired = dates.every(Boolean);
    const acquiredAt = acquired ? (dates as string[]).sort().slice(-1)[0] : null;
    return { ...comp, module: m, acquired, acquiredAt, done: dates.filter(Boolean).length };
  }));
  const acquired = list.filter((x) => x.acquired);
  return { list, total: list.length, acquired: acquired.length, thisWeek: acquired.filter((x) => new Date(x.acquiredAt!).getTime() >= weekAgo).length };
}

/** Course completion (%) at the end of each of the last `days` days */
export function progressSeries(s: LearnerState, courseId: string, days: number) {
  const c = getCourse(courseId)!; const lessons = courseLessons(c); const now = new Date();
  const times = lessons.map((l) => (s.completions[l.id]?.passed ? new Date(s.completions[l.id].at).getTime() : Infinity));
  return Array.from({ length: days }, (_, i) => {
    const d = addDays(now, i - days + 1); const end = startOfDay(addDays(d, 1)).getTime();
    return { date: d, value: pct(times.filter((t) => t < end).length, lessons.length) };
  });
}

export function dailySeries(s: LearnerState, days: number) {
  const now = new Date();
  return Array.from({ length: days }, (_, i) => { const d = addDays(now, i - days + 1); return { date: d, minutes: Math.round(s.activity[dayKey(d)] ?? 0) }; });
}

export function weeklySeries(s: LearnerState, weeks: number) {
  const now = new Date(); const dow = (now.getDay() + 6) % 7; // Monday = 0
  const monday = startOfDay(addDays(now, -dow));
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(monday, (i - weeks + 1) * 7); let m = 0;
    for (let k = 0; k < 7; k++) m += s.activity[dayKey(addDays(start, k))] ?? 0;
    return { date: start, minutes: Math.round(m) };
  });
}

export function assessments(s: LearnerState) {
  return Object.entries(s.completions)
    .map(([id, c]) => ({ lesson: getLesson(id)!, c }))
    .filter((x) => x.lesson && x.lesson.kind === 'assessment')
    .sort((a, b) => (a.c.at < b.c.at ? -1 : 1))
    .map((x) => ({ ...x, pct: Math.round((x.c.score / x.c.total) * 100) }));
}

export function averageScore(s: LearnerState, sinceDays = 30) {
  const since = addDays(new Date(), -sinceDays).getTime();
  const list = Object.values(s.completions).filter((c) => new Date(c.at).getTime() >= since && c.total);
  if (!list.length) return null;
  return Math.round((list.reduce((a, c) => a + c.score / c.total, 0) / list.length) * 100);
}

/** weakest skill (lowest average first-try score over completed lessons) */
export function weakestSkill(s: LearnerState, courseId: string) {
  const c = getCourse(courseId)!; const agg: Record<string, { sum: number; n: number }> = {};
  for (const l of courseLessons(c)) { const comp = s.completions[l.id]; if (comp?.total) { agg[l.skill] ??= { sum: 0, n: 0 }; agg[l.skill].sum += comp.score / comp.total; agg[l.skill].n++; } }
  const ranked = Object.entries(agg).map(([k, v]) => ({ skill: k as SkillId, avg: v.sum / v.n })).sort((a, b) => a.avg - b.avg);
  return ranked[0] ?? null;
}

// ---------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------
export const normalizeAnswer = (v: string) => v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[’`]/g, "'").replace(/[^\p{L}\p{N}' ]/gu, ' ').replace(/\s+/g, ' ').trim();

export function checkAnswer(q: Question, value: string): boolean {
  if (q.type === 'mcq') return value === q.answer;
  if (q.type === 'tf') return value === String(q.answer);
  const n = normalizeAnswer(value);
  if (!n) return false;
  if (q.accept.some((a) => normalizeAnswer(a) === n)) return true;
  if (q.keywords?.length) {
    const words = n.split(' ');
    return words.length <= 8 && q.keywords.every((k) => words.includes(normalizeAnswer(k)));
  }
  return false;
}

export function correctAnswerText(q: Question): string {
  if (q.type === 'mcq') return q.choices.find((c) => c.id === q.answer)?.text ?? '';
  if (q.type === 'tf') return q.answer ? 'Vrai' : 'Faux';
  return q.display;
}

export function lessonPosition(l: Lesson) {
  const c = getCourse(l.courseId)!; const m = c.modules.find((x) => x.id === l.moduleId);
  return { course: c, module: m, count: m?.lessons.length ?? 1 };
}

export function daysSinceSeed(s: LearnerState) { return daysBetween(new Date(s.seededAt), new Date()); }


// ---------------------------------------------------------------- subscription
export type SubState = 'active' | 'due' | 'expired';
/** Where the subscription stands today: days left in the paid period, its state, the period elapsed. */
export function subscriptionInfo(s: LearnerState, now = new Date()) {
  const sub = s.subscription;
  const plan = PLANS[sub.plan];
  const until = new Date(sub.paidUntil);
  const daysLeft = daysBetween(now, until);
  const state: SubState = until <= now ? 'expired' : daysLeft <= DUE_DAYS ? 'due' : 'active';
  const last = sub.invoices[sub.invoices.length - 1];
  const start = last ? new Date(last.from) : addMonths(until, -plan.months);
  const span = until.getTime() - start.getTime();
  const elapsed = span > 0 ? Math.max(0, Math.min(1, (now.getTime() - start.getTime()) / span)) : 1;
  const label = state === 'expired'
    ? (daysLeft === 0 ? 'Expiré aujourd’hui' : `Expiré depuis ${-daysLeft} jour${-daysLeft > 1 ? 's' : ''}`)
    : daysLeft === 0 ? 'Se termine aujourd’hui' : daysLeft === 1 ? 'Se termine demain'
    : state === 'due' ? `Se termine dans ${daysLeft} jours` : `Actif jusqu’au ${shortDateY(until, now)}`;
  return { plan, until, daysLeft, state, elapsed, label, invoices: [...sub.invoices].reverse() };
}
