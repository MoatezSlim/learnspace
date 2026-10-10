// Richer figures for the redesigned pages (progress, course pages, Léa's insights). Everything is
// computed from LearnerState: lessons finished (with their first-try scores and minutes) and the
// minutes learnt per day.
import type { Course, LearnerState, Lesson, Module, SkillId } from '../types';
import { COURSES, courseLessons, getCourse, getLesson, isPlayable, SKILL_LABEL } from '../data/courses';
import { addDays, dayKey, parseDay, startOfDay, daysBetween } from '../lib/dates';
import { courseStats, skillLevels } from './selectors';

export type Period = 'day' | 'week' | 'month' | 'all';

/** First day of a period containing `now` (weeks start on Monday). */
export function periodStart(period: Period, now = new Date()): Date {
  if (period === 'day') return startOfDay(now);
  if (period === 'week') return startOfDay(addDays(now, -((now.getDay() + 6) % 7)));
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  return new Date(0);
}

export const passedList = (s: LearnerState) =>
  Object.entries(s.completions).filter(([, c]) => c.passed).map(([id, c]) => ({ id, c, lesson: getLesson(id) })).filter((x) => !!x.lesson) as { id: string; c: LearnerState['completions'][string]; lesson: Lesson }[];

/** Lessons finished (every course), optionally since a date and for one course. */
export function lessonsDone(s: LearnerState, since?: Date, courseId?: string) {
  const t = since ? since.getTime() : -Infinity;
  return passedList(s).filter((x) => new Date(x.c.at).getTime() >= t && (!courseId || x.lesson.courseId === courseId)).length;
}

/** Minutes learnt between two days (inclusive), from the daily activity. */
export function minutesBetween(s: LearnerState, from: Date, to = new Date()) {
  let sum = 0;
  for (let d = startOfDay(from); d <= to; d = addDays(d, 1)) sum += s.activity[dayKey(d)] ?? 0;
  return Math.round(sum);
}
export const periodMinutes = (s: LearnerState, period: Period, now = new Date()) =>
  period === 'all' ? Math.round(Object.values(s.activity).reduce((a, b) => a + b, 0)) : minutesBetween(s, periodStart(period, now), now);

/** Days with some learning time. */
export function activeDays(s: LearnerState) {
  return Object.keys(s.activity).filter((k) => (s.activity[k] ?? 0) > 0).sort();
}
export function firstActiveDay(s: LearnerState): Date | null {
  const days = activeDays(s);
  return days.length ? parseDay(days[0]) : null;
}

/** First-try answers: right / total, over finished lessons (optionally one course, since a date). */
export function accuracy(s: LearnerState, opts: { courseId?: string; since?: Date } = {}) {
  const t = opts.since ? opts.since.getTime() : -Infinity;
  let right = 0, total = 0;
  for (const [id, c] of Object.entries(s.completions)) {
    if (!c.total || new Date(c.at).getTime() < t) continue;
    if (opts.courseId && getLesson(id)?.courseId !== opts.courseId) continue;
    right += c.score; total += c.total;
  }
  return { right, total, pct: total ? Math.round((right / total) * 100) : null };
}

/** Learning time spent on a course: the minutes of its finished lessons. */
export function practiceMinutes(s: LearnerState, courseId: string, since?: Date) {
  const t = since ? since.getTime() : -Infinity;
  return Math.round(passedList(s).filter((x) => x.lesson.courseId === courseId && new Date(x.c.at).getTime() >= t).reduce((a, x) => a + x.c.minutes, 0));
}

export function remainingMinutes(s: LearnerState, c: Course) {
  return courseLessons(c).filter((l) => !s.completions[l.id]?.passed).reduce((a, l) => a + l.minutes, 0);
}

/** Lessons per day on a course over the last four weeks. */
export function pace(s: LearnerState, courseId: string, now = new Date()) {
  return lessonsDone(s, addDays(startOfDay(now), -27), courseId) / 28;
}

/** When the course would be finished at the current pace (null when there is no recent activity). */
export function estimatedFinish(s: LearnerState, c: Course, now = new Date()): Date | null {
  const st = courseStats(s, c);
  if (st.done >= st.total) return null;
  const p = pace(s, c.id, now);
  if (p <= 0) return null;
  return addDays(startOfDay(now), Math.ceil((st.total - st.done) / p));
}

/** Last day the learner worked on a course. */
export function lastActivity(s: LearnerState, courseId: string): Date | null {
  const dates = passedList(s).filter((x) => x.lesson.courseId === courseId).map((x) => x.c.at).sort();
  const e = s.enrollments[courseId];
  const last = [dates[dates.length - 1], e?.lastActiveAt].filter(Boolean).sort().pop();
  return last ? new Date(last) : null;
}

/** Per module: lessons done, its assessment result. */
export function moduleStats(s: LearnerState, m: Module) {
  const done = m.lessons.filter((l) => s.completions[l.id]?.passed).length;
  const assess = m.lessons.find((l) => l.kind === 'assessment');
  const result = assess ? s.completions[assess.id] ?? null : null;
  return { done, total: m.lessons.length, complete: done === m.lessons.length, assess, result, minutes: m.lessons.reduce((a, l) => a + l.minutes, 0) };
}

/** The next module assessment of a course and the lessons left before it. */
export function nextAssessment(s: LearnerState, c: Course) {
  for (const m of c.modules) {
    const st = moduleStats(s, m);
    if (st.assess && !st.result?.passed) {
      const before = m.lessons.filter((l) => l.kind !== 'assessment' && !s.completions[l.id]?.passed).length;
      return { module: m, lesson: st.assess, before };
    }
  }
  return null;
}

const DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
export const dayName = (d: number) => DAY_NAMES[d];

/** The two-hour window in which the learner finishes most lessons (last 60 days). */
export function peakHours(s: LearnerState, now = new Date()) {
  const since = addDays(now, -60).getTime();
  const counts = new Array(24).fill(0);
  for (const { c } of passedList(s)) { const d = new Date(c.at); if (d.getTime() >= since) counts[d.getHours()]++; }
  let best = -1, bestN = 0;
  for (let h = 6; h < 23; h++) { const n = counts[h] + counts[h + 1]; if (n > bestN) { bestN = n; best = h; } }
  if (best < 0) return null;
  const moment = best < 11 ? 'le matin' : best < 14 ? 'à l’heure du déjeuner' : best < 18 ? 'l’après-midi' : 'en soirée';
  return { from: best, to: best + 2, moment, label: `entre ${best} h et ${best + 2} h`, share: bestN / Math.max(1, counts.reduce((a, b) => a + b, 0)) };
}

/** The weekday on which the learner is most often active (over the last nine weeks). */
export function bestWeekday(s: LearnerState, now = new Date()) {
  const counts = new Array(7).fill(0);
  for (let o = 0; o < 63; o++) { const d = addDays(now, -o); if ((s.activity[dayKey(d)] ?? 0) > 0) counts[d.getDay()]++; }
  const day = counts.indexOf(Math.max(...counts));
  return { day, name: dayName(day), count: counts[day] };
}

/** The day with the most minutes in a period. */
export function bestDay(s: LearnerState, from: Date, to = new Date()) {
  let best: { date: Date; minutes: number } | null = null;
  for (let d = startOfDay(from); d <= to; d = addDays(d, 1)) {
    const m = Math.round(s.activity[dayKey(d)] ?? 0);
    if (m > 0 && (!best || m > best.minutes)) best = { date: d, minutes: m };
  }
  return best;
}

/** Longest run of active days, with its dates. */
export function bestStreak(s: LearnerState) {
  const days = activeDays(s);
  let best: { days: number; start: Date; end: Date } | null = null;
  let runStart = 0;
  for (let i = 0; i < days.length; i++) {
    if (i > 0 && dayKey(addDays(parseDay(days[i - 1]), 1)) !== days[i]) runStart = i;
    const n = i - runStart + 1;
    if (!best || n > best.days) best = { days: n, start: parseDay(days[runStart]), end: parseDay(days[i]) };
  }
  return best;
}

/** Lessons finished with every first answer right. */
export const perfectCount = (s: LearnerState) => passedList(s).filter((x) => x.c.total && x.c.score === x.c.total).length;

/** Columns of seven days (Monday first) ending with the current week, for the regularity map. */
export function heatmap(s: LearnerState, weeks: number, now = new Date()) {
  const monday = periodStart('week', now);
  const first = addDays(monday, -(weeks - 1) * 7);
  const cols: { date: Date; minutes: number; future: boolean }[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(first, w * 7 + d);
      col.push({ date, minutes: Math.round(s.activity[dayKey(date)] ?? 0), future: startOfDay(date) > startOfDay(now) });
    }
    cols.push(col);
  }
  return cols;
}

/** Lessons and minutes per enrolled course since a date (Mes cours, Léa's weekly view). */
export function byCourse(s: LearnerState, since: Date) {
  return COURSES.filter((c) => s.enrollments[c.id]).map((c) => {
    const list = passedList(s).filter((x) => x.lesson.courseId === c.id && new Date(x.c.at) >= since);
    return { course: c, lessons: list.length, minutes: Math.round(list.reduce((a, x) => a + x.c.minutes, 0)) };
  });
}

/** Competencies acquired since a date. */
export function competenciesSince(s: LearnerState, courseId: string, since: Date) {
  const c = getCourse(courseId)!;
  let n = 0;
  for (const m of c.modules) for (const comp of m.competencies) {
    const dates = comp.lessonIds.map((id) => (s.completions[id]?.passed ? s.completions[id].at : null));
    if (dates.every(Boolean) && new Date((dates as string[]).sort().slice(-1)[0]) >= since) n++;
  }
  return n;
}

/** The skill of a course closest to its next level, and a skill not started yet. */
export function skillInsights(s: LearnerState, courseId: string) {
  const skills = skillLevels(s, courseId);
  const rising = skills.filter((x) => x.nextAt && x.count > 0).map((x) => ({ ...x, left: (x.nextAt ?? 0) - x.count })).sort((a, b) => a.left - b.left)[0] ?? null;
  const fresh = skills.find((x) => x.count === 0) ?? null;
  const c = getCourse(courseId)!;
  const firstOfFresh = fresh ? courseLessons(c).find((l) => l.skill === fresh.skill && !s.completions[l.id]?.passed && isPlayable(l)) ?? courseLessons(c).find((l) => l.skill === fresh.skill) : undefined;
  return { skills, rising, fresh, firstOfFresh };
}

/** Skill on the rise: the one with the most lessons finished over the last two weeks. */
export function risingSkill(s: LearnerState, now = new Date()) {
  const since = addDays(startOfDay(now), -13);
  const counts: Partial<Record<SkillId, number>> = {};
  for (const x of passedList(s)) if (new Date(x.c.at) >= since) counts[x.lesson.skill] = (counts[x.lesson.skill] ?? 0) + 1;
  const top = (Object.entries(counts) as [SkillId, number][]).sort((a, b) => b[1] - a[1])[0];
  return top ? { skill: top[0], label: SKILL_LABEL[top[0]], count: top[1] } : null;
}

/** Days between the last activity on a course and today. */
export function idleDays(s: LearnerState, courseId: string, now = new Date()) {
  const last = lastActivity(s, courseId);
  return last ? daysBetween(last, now) : null;
}

/** Daily minutes for a sparkline (oldest first). */
export function dailyMinutes(s: LearnerState, days: number, now = new Date()) {
  return Array.from({ length: days }, (_, i) => Math.round(s.activity[dayKey(addDays(now, i - days + 1))] ?? 0));
}

/** Cumulative lessons finished per day (oldest first), for a sparkline. */
export function cumulativeLessons(s: LearnerState, days: number, now = new Date()) {
  const times = passedList(s).map((x) => new Date(x.c.at).getTime());
  return Array.from({ length: days }, (_, i) => { const end = startOfDay(addDays(now, i - days + 2)).getTime(); return times.filter((t) => t < end).length; });
}

/** Active-day streak as it stood at the end of each day (oldest first). */
export function streakSeries(s: LearnerState, days: number, now = new Date()) {
  const active = (d: Date) => (s.activity[dayKey(d)] ?? 0) > 0;
  return Array.from({ length: days }, (_, i) => {
    const d = addDays(now, i - days + 1); let n = 0;
    for (let k = 0; k < 90 && active(addDays(d, -k)); k++) n++;
    return n;
  });
}

/** First-try accuracy per day over finished lessons (oldest first; days without lessons repeat the previous value). */
export function accuracySeries(s: LearnerState, days: number, now = new Date()) {
  const out: number[] = []; let last = accuracy(s, { since: addDays(now, -days - 30) }).pct ?? 0;
  for (let i = 0; i < days; i++) {
    const d = dayKey(addDays(now, i - days + 1));
    let r = 0, t = 0;
    for (const c of Object.values(s.completions)) if (c.total && dayKey(new Date(c.at)) === d) { r += c.score; t += c.total; }
    if (t) last = Math.round((r / t) * 100);
    out.push(last);
  }
  return out;
}

/** Courses for Léa's selection in the library: not followed yet, ranked by how well they fit. */
export function libraryPicks(s: LearnerState) {
  const current = getCourse(s.currentCourseId);
  return COURSES.filter((c) => !s.enrollments[c.id])
    .map((c) => {
      let score = c.popularity;
      if (c.category !== 'langues') score += 20;                     // go beyond languages
      if (c.level === 'debutant') score += 8;
      if (c.hours <= 9) score += 6;                                    // fits a 10-minute daily goal
      if (current && c.category === current.category) score -= 30;
      return { c, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.c);
}
