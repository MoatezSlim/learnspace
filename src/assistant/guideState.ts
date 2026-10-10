// Léa's course guide: when the learner moves to a course (resting the pointer on a course card,
// or opening a course), Léa pops up and tells them what the course is about.
import { useSyncExternalStore } from 'react';
import type { FocusEvent } from 'react';
import type { Course, LearnerState } from '../types';
import { courseLessons, getCourse, isPlayable, LEVEL_LABEL } from '../data/courses';
import { courseStats } from '../state/selectors';
import { avatar, typingMs } from './controller';

export interface GuideState { courseId: string | null; mode: 'peek' | 'open'; key: number; at: number }
let state: GuideState = { courseId: null, mode: 'peek', key: 0, at: 0 };
const listeners = new Set<() => void>();
const set = (p: Partial<GuideState>) => { state = { ...state, ...p }; listeners.forEach((l) => l()); };
export const useGuide = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state);

const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** What Léa says about a course, from the course data and the learner's progress. */
export function describeCourse(c: Course, s: LearnerState): { hello: string; text: string } {
  const st = courseStats(s, c);
  const first = courseLessons(c).find(isPlayable);
  const hello = st.pct >= 100 ? 'Tu as terminé ce cours, bravo !' : st.enrolled ? (st.done ? 'On continue ce cours ?' : 'Prêt à commencer ?') : 'Ce cours pourrait te plaire !';
  const parts = [`Au programme : ${lc(c.description)}`, `${st.total} leçons en ${c.modules.length} modules, environ ${c.hours} h, niveau ${LEVEL_LABEL[c.level].toLowerCase()}.`];
  if (st.pct >= 100) parts.push('Tu peux revoir chaque leçon quand tu veux.');
  else if (st.enrolled && st.done && st.next) parts.push(`Tu en es à ${st.pct} % : ta prochaine leçon, « ${st.next.title} », dure ${st.next.minutes} min.`);
  else if (first) parts.push(`${st.enrolled ? 'Tu peux' : 'Inscris-toi et'} commencer par « ${first.title} ».`);
  return { hello, text: parts.join(' ') };
}

const canHover = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
let showTimer: number | undefined;
let hideTimer: number | undefined;
let overGuide = false;

function show(courseId: string, mode: 'peek' | 'open', s: LearnerState) {
  const c = getCourse(courseId); if (!c) return;
  window.clearTimeout(hideTimer);
  if (state.courseId === courseId && (state.mode === mode || state.mode === 'open')) return;
  const { hello, text } = describeCourse(c, s);
  avatar.express(s && courseStats(s, c).pct >= 100 ? 'excited' : 'happy', typingMs(`${hello} ${text}`) + 1400, 'smile');
  set({ courseId, mode, key: state.key + 1, at: performance.now() });
}

export const guide = {
  /** The course page was opened: Léa presents it (stays until closed). */
  open(courseId: string, s: LearnerState) { window.clearTimeout(showTimer); show(courseId, 'open', s); },
  close() { window.clearTimeout(showTimer); window.clearTimeout(hideTimer); overGuide = false; if (state.courseId) set({ courseId: null }); },
  /** Pointer resting on a course card (devices with a mouse only). */
  hoverStart(courseId: string, s: LearnerState) {
    if (!canHover()) return;
    window.clearTimeout(hideTimer); window.clearTimeout(showTimer);
    if (state.courseId === courseId) return;
    showTimer = window.setTimeout(() => show(courseId, state.mode === 'open' && state.courseId ? 'open' : 'peek', s), state.courseId ? 160 : 420);
  },
  hoverEnd() {
    window.clearTimeout(showTimer);
    if (state.mode !== 'peek') return;
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => { if (!overGuide && state.mode === 'peek') set({ courseId: null }); }, 450);
  },
  /** Keyboard focus on a course card shows the same help. */
  focus(courseId: string, s: LearnerState) { window.clearTimeout(showTimer); show(courseId, state.mode === 'open' && state.courseId ? 'open' : 'peek', s); },
  enterGuide() { overGuide = true; window.clearTimeout(hideTimer); },
  leaveGuide() { overGuide = false; if (state.mode === 'peek') guide.hoverEnd(); },
};

/** Props for a course card: hovering or focusing it makes Léa present the course. */
export function courseHoverProps(courseId: string, s: LearnerState) {
  return {
    onMouseEnter: () => guide.hoverStart(courseId, s),
    onMouseLeave: () => guide.hoverEnd(),
    onFocus: (e: FocusEvent) => { let kb = true; try { kb = (e.target as HTMLElement).matches(':focus-visible'); } catch { /* old browser */ } if (kb) guide.focus(courseId, s); },
    onBlur: () => guide.hoverEnd(),
  };
}
