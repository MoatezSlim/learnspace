// What Léa says when the learner arrives on a page, computed from their progress. `auto`: she types it
// out on arrival (unless she is set to be discreet); `enter`: a short expression before she settles on
// `mood`; `fx`: a small effect around her.
import type { Course, LearnerState, Route } from '../types';
import type { Fx, Mood } from './controller';
import { getCourse, COURSES, courseLessons, isPlayable } from '../data/courses';
import { recommendation, streak, todayMinutes, subscriptionInfo, courseStats } from '../state/selectors';
import { ACHIEVEMENTS } from '../state/achievements';
import { nextAssessment, pace, peakHours, idleDays, lessonsDone, dayName } from '../state/insights';
import { addDays, startOfDay, daysBetween } from '../lib/dates';
import { euros, PLANS } from '../data/plans';

export interface PageLine { text: string; mood: Mood; enter?: Mood; fx?: Fx; auto: boolean }

const LANG = new Set(['langues']);
/** « ton anglais », « ton cours Python » */
export const yourCourse = (c: Course) => (LANG.has(c.category) ? `ton ${c.shortTitle.toLowerCase()}` : `ton cours « ${c.shortTitle} »`);
/** « l’allemand », « le russe », « le cours Python » */
export const theCourse = (c: Course) => {
  if (!LANG.has(c.category)) return `le cours « ${c.shortTitle} »`;
  const n = c.shortTitle.toLowerCase();
  return /^[aeiouéèh]/.test(n) ? `l’${n}` : `le ${n}`;
};
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const plural = (n: number, w: string, p = `${w}s`) => `${n} ${n > 1 ? p : w}`;

/** Unit in which a badge is counted, for « encore 3 … ». */
export const BADGE_UNIT: Record<string, [string, string, 'f' | 'm']> = {
  first: ['leçon', 'leçons', 'f'], ten: ['leçon', 'leçons', 'f'], quarter: ['leçon', 'leçons', 'f'], module: ['module', 'modules', 'm'], streak3: ['jour', 'jours', 'm'], streak7: ['jour', 'jours', 'm'],
  perfect: ['leçon sans faute', 'leçons sans faute', 'f'], assessor: ['évaluation', 'évaluations', 'f'], polyglot: ['langue', 'langues', 'f'], listener: ['écoute', 'écoutes', 'f'],
  curious: ['question', 'questions', 'f'], marathon: ['minute', 'minutes', 'f'],
};
/** « une leçon », « 3 jours » */
export function badgeLeft(id: string, left: number) {
  const [one, many, g] = BADGE_UNIT[id] ?? ['étape', 'étapes', 'f'];
  return left === 1 ? `${g === 'f' ? 'une' : 'un'} ${one}` : `${left} ${many}`;
}
export function nextBadges(s: LearnerState) {
  return ACHIEVEMENTS.filter((a) => !s.achievements[a.id]).map((a) => ({ a, p: a.progress(s) }))
    .map((x) => ({ ...x, ratio: Math.min(1, x.p.cur / x.p.target), left: Math.max(0, x.p.target - x.p.cur) }))
    .sort((x, y) => y.ratio - x.ratio);
}

export function pageLine(route: Route, s: LearnerState, now = new Date()): PageLine {
  const course = getCourse(s.currentCourseId)!;
  switch (route.page) {
    case 'home': {
      const goal = s.profile.dailyGoalMin; const today = todayMinutes(s); const rec = recommendation(s); const sk = streak(s);
      const next = rec ? ` On enchaîne avec « ${rec.lesson.title} » ?` : '';
      if (today >= goal) return { text: `**Objectif atteint, bravo !** Tu as fait ${today} min aujourd’hui.${next}`, mood: 'smile', enter: 'wink', auto: true };
      if (today > 0) return { text: `**Encore ${goal - today} min pour ton objectif du jour.**${rec ? ` « ${rec.lesson.title} » prend ${rec.lesson.minutes} minutes : c’est parfait.` : ''}`, mood: 'smile', enter: 'wink', auto: true };
      return { text: `**Prêt pour ta séance du jour ?**${sk.days ? ` Ta série de ${plural(sk.days, 'jour')} t’attend.` : ''}${rec ? ` Je te propose « ${rec.lesson.title} » (${rec.lesson.minutes} min).` : ''}`, mood: 'smile', enter: 'wink', auto: true };
    }
    case 'library':
      return { text: '**Tu ne sais pas par où commencer ?** Dis-moi ce que tu aimerais savoir faire dans trois mois et je te propose un parcours sur mesure.', mood: 'smile', enter: 'curious', auto: true };
    case 'courses': {
      const since = addDays(startOfDay(now), -29);
      const mine = COURSES.filter((c) => s.enrollments[c.id] && !s.enrollments[c.id].paused);
      const fast = [...mine].sort((a, b) => lessonsDone(s, since, b.id) - lessonsDone(s, since, a.id))[0];
      const idle = mine.filter((c) => c.id !== fast?.id && courseStats(s, c).pct < 100).map((c) => ({ c, d: idleDays(s, c.id, now) ?? 0 })).sort((a, b) => b.d - a.d)[0];
      const head = fast ? `**${cap(yourCourse(fast))} avance le plus vite.**` : '**Voici tous tes cours.**';
      if (idle && idle.d >= 14) {
        const nx = courseLessons(idle.c).find((l) => !s.completions[l.id]?.passed && isPlayable(l)) ?? courseStats(s, idle.c).next;
        return { text: `${head} ${cap(theCourse(idle.c))} n’a pas bougé depuis ${idle.d >= 28 ? 'un mois' : `${idle.d} jours`} : ${nx ? `une leçon de ${nx.minutes} minutes suffit pour reprendre le fil.` : 'une petite leçon suffit pour reprendre le fil.'}`, mood: 'smile', enter: 'happy', auto: true };
      }
      return { text: `${head} Tous tes cours ont avancé ces dernières semaines : continue comme ça !`, mood: 'smile', enter: 'happy', auto: true };
    }
    case 'course': {
      const c = getCourse(route.courseId ?? '') ?? course;
      const st = courseStats(s, c);
      const na = nextAssessment(s, c);
      if (!st.enrolled) return { text: `**${c.title}** : ${c.hours} heures, ${plural(st.total, 'leçon')}. Ajoute-le à tes cours et je l’intègre à ton plan de la semaine.`, mood: 'happy', enter: 'delighted', auto: true };
      if (st.pct >= 100) return { text: `**Tu as terminé ce cours, bravo !** Tu peux revoir chaque leçon quand tu veux.`, mood: 'happy', enter: 'delighted', auto: true };
      if (na && na.before > 0) {
        const p = pace(s, c.id, now);
        const when = p > 0 ? addDays(startOfDay(now), Math.max(1, Math.ceil(na.before / p))) : null;
        const days = when ? daysBetween(now, when) : null;
        const whenText = when && days !== null && days <= 6 ? `tu peux la passer ${dayName(when.getDay())}` : when ? `tu peux la passer d’ici ${days} jours` : 'tu peux la passer dès que tu te sens prêt';
        return { text: `**Plus que ${plural(na.before, 'leçon')} avant l’évaluation du module ${na.module.index}.** À ton rythme actuel, ${whenText}. Je te prépare une révision la veille ?`, mood: 'happy', enter: 'delighted', auto: true };
      }
      if (na) return { text: `**L’évaluation du module ${na.module.index} t’attend.** Il faut ${Math.round((na.lesson.passMark ?? 0.7) * 100)} % de bonnes réponses du premier coup. Tu es prêt ?`, mood: 'happy', enter: 'delighted', auto: true };
      return { text: `**${c.title}** : ${st.pct} % du parcours est fait. On continue ?`, mood: 'happy', auto: true };
    }
    case 'progress': {
      const ph = peakHours(s, now);
      if (ph) return { text: `**Tu apprends surtout ${ph.moment}**, ${ph.label}. Garde ce créneau : c’est là que ta série tient le mieux.`, mood: 'smile', enter: 'wink', auto: true };
      return { text: '**Voici ta progression.** Chaque leçon terminée compte : on regarde ensemble ce qui avance le plus ?', mood: 'smile', enter: 'wink', auto: true };
    }
    case 'badges': {
      const earned = ACHIEVEMENTS.filter((a) => s.achievements[a.id]).sort((a, b) => (s.achievements[b.id] > s.achievements[a.id] ? 1 : -1));
      const nb = nextBadges(s)[0];
      const last = earned[0];
      const tail = nb ? ` Encore ${badgeLeft(nb.a.id, nb.left)} et tu décroches « ${nb.a.title} ».` : ' Tu as tous les badges : chapeau !';
      return { text: `${last ? `**Bravo pour « ${last.title} » !**` : '**Ton premier badge t’attend.**'}${tail}`, mood: 'happy', enter: 'laugh', fx: 'sparkle', auto: true };
    }
    case 'settings':
      return { text: '**Tu peux changer ma façon de te répondre à tout moment.** Je m’adapte tout de suite, sans perdre ton historique ni tes progrès.', mood: 'smile', auto: true };
    case 'subscription': {
      const i = subscriptionInfo(s, now);
      const yearly = PLANS.yearly;
      if (i.state === 'expired') return { text: '**Ton abonnement a expiré.** Réactive-le en un clic : ta série et tes progrès sont conservés.', mood: 'smile', enter: 'wink2', auto: true };
      if (i.state === 'due') return { text: `**Ton abonnement se termine ${i.daysLeft === 0 ? 'aujourd’hui' : i.daysLeft === 1 ? 'demain' : `dans ${i.daysLeft} jours`}.** ${s.subscription.plan === 'monthly' ? `Avec l’offre annuelle, tu paies ${euros(yearly.perMonth)} par mois au lieu de ${euros(PLANS.monthly.price)}. ` : ''}Ta série et tes progrès sont conservés dans tous les cas.`, mood: 'smile', enter: 'wink2', auto: true };
      return { text: `**Ton abonnement est actif.** Tu n’as rien à faire : je te préviendrai une semaine avant la fin.`, mood: 'smile', enter: 'wink2', auto: true };
    }
    case 'lesson':
      return { text: 'Je suis là si tu as besoin d’un indice, d’une traduction ou d’une explication.', mood: 'smile', auto: false };
    case 'messages':
    default:
      return { text: 'Pose-moi une question sur tes cours, demande une révision ou un conseil d’organisation.', mood: 'smile', auto: false };
  }
}
