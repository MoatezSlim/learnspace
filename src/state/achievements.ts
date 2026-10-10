import type { LearnerState } from '../types';
import { COURSES, courseLessons, getLesson } from '../data/courses';
import { streak, assessments } from './selectors';

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: 'step' | 'flame' | 'book' | 'target' | 'check' | 'ear' | 'chat' | 'globe' | 'clock' | 'medal' | 'flag' | 'star';
  progress: (s: LearnerState) => { cur: number; target: number };
}

const passed = (s: LearnerState) => Object.entries(s.completions).filter(([, c]) => c.passed);
const listening = (s: LearnerState) => passed(s).filter(([id]) => getLesson(id)?.skill === 'listening').length;
const modulesDone = (s: LearnerState) => COURSES.flatMap((c) => c.modules).filter((m) => m.lessons.every((l) => s.completions[l.id]?.passed)).length;
const languagesStarted = (s: LearnerState) => COURSES.filter((c) => c.category === 'langues' && courseLessons(c).some((l) => s.completions[l.id]?.passed)).length;
const bestDay = (s: LearnerState) => Math.max(0, ...Object.values(s.activity));

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first', title: 'Premier pas', description: 'Terminer une première leçon.', icon: 'step', progress: (s) => ({ cur: passed(s).length, target: 1 }) },
  { id: 'ten', title: 'Rythme de croisière', description: 'Terminer 10 leçons.', icon: 'book', progress: (s) => ({ cur: passed(s).length, target: 10 }) },
  { id: 'module', title: 'Module bouclé', description: 'Terminer toutes les leçons d’un module.', icon: 'flag', progress: (s) => ({ cur: modulesDone(s), target: 1 }) },
  { id: 'streak3', title: 'Trois jours d’affilée', description: 'Apprendre trois jours de suite.', icon: 'flame', progress: (s) => ({ cur: streak(s).best, target: 3 }) },
  { id: 'perfect', title: 'Sans faute', description: 'Réussir toutes les questions d’une leçon du premier coup.', icon: 'check', progress: (s) => ({ cur: passed(s).some(([, c]) => c.total && c.score === c.total) ? 1 : 0, target: 1 }) },
  { id: 'assessor', title: 'Évaluation réussie', description: 'Obtenir au moins 90 % à une évaluation de module.', icon: 'medal', progress: (s) => ({ cur: assessments(s).some((a) => a.pct >= 90) ? 1 : 0, target: 1 }) },
  { id: 'polyglot', title: 'Polyglotte', description: 'Progresser dans trois langues différentes.', icon: 'globe', progress: (s) => ({ cur: languagesStarted(s), target: 3 }) },
  { id: 'listener', title: 'Oreille fine', description: 'Terminer 8 leçons de compréhension orale.', icon: 'ear', progress: (s) => ({ cur: listening(s), target: 8 }) },
  { id: 'quarter', title: 'Cap des 25', description: 'Terminer 25 leçons dans ton parcours principal.', icon: 'target',
    progress: (s) => { const c = COURSES.find((x) => x.id === s.currentCourseId)!; return { cur: courseLessons(c).filter((l) => s.completions[l.id]?.passed).length, target: 25 }; } },
  { id: 'curious', title: 'Curiosité', description: 'Poser 5 questions à ton assistante.', icon: 'chat', progress: (s) => ({ cur: s.assistantQuestions, target: 5 }) },
  { id: 'streak7', title: 'Une semaine complète', description: 'Apprendre sept jours de suite.', icon: 'flame', progress: (s) => ({ cur: streak(s).best, target: 7 }) },
  { id: 'marathon', title: 'Marathon', description: 'Apprendre 60 minutes en une journée.', icon: 'clock', progress: (s) => ({ cur: Math.round(bestDay(s)), target: 60 }) },
];

/** Returns the ids of achievements reached now but not yet recorded. */
export function newlyEarned(s: LearnerState): string[] {
  return ACHIEVEMENTS.filter((a) => !s.achievements[a.id]).filter((a) => { const p = a.progress(s); return p.cur >= p.target; }).map((a) => a.id);
}

export const achievement = (id: string) => ACHIEVEMENTS.find((a) => a.id === id)!;
