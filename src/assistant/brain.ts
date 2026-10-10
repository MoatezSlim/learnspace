// The assistant's answers. Two sources, chosen in Settings:
//  - "live": written on the fly by the language model the artifact runtime exposes through its
//            `sample` capability (viewer consent required)
//  - "demo": prepared answers computed from the course data and the learner's progress
// The interface never names the model or its provider: the learner talks to Léa.
import type { AssistantAction, ChatMessage, LearnerState, Lesson, PageId, Question } from '../types';
import type { Mood } from './controller';
import { COURSES, getCourse, getLesson, SKILL_LABEL, KIND_LABEL, LEVEL_SHORT, PRACTICE_LESSONS, getModule } from '../data/courses';
import { courseStats, recommendation, streak, todayMinutes, weekMinutes, competencies, correctAnswerText, normalizeAnswer, skillLevels, subscriptionInfo } from '../state/selectors';
import { PLAN_NAME, euros } from '../data/plans';
import { minutesLabel } from '../lib/dates';
import { LINES } from './lines';
import { ACHIEVEMENTS } from '../state/achievements';

export interface LessonContext { lessonId: string; questionId?: string; answered?: boolean; correct?: boolean }
export interface BrainContext { page: PageId; lesson?: LessonContext }
export interface Reply { text: string; mood: Mood; actions: AssistantAction[]; source: 'live' | 'demo' }

const PAGE_LABEL: Record<PageId, string> = { home: 'Accueil', courses: 'Mes cours', course: 'Fiche de cours', library: 'Bibliothèque', progress: 'Progression', badges: 'Badges', messages: 'Messages', settings: 'Paramètres', lesson: 'Leçon', subscription: 'Abonnement' };

// ---------------------------------------------------------------------------
// Live answers availability (artifact runtime `sample` capability)
// ---------------------------------------------------------------------------
export type AiStatus = 'checking' | 'available' | 'unavailable' | 'declined';
type SampleFn = ((input: unknown, opts?: unknown) => Promise<{ text: string; truncated: boolean }>) | null;
let sample: SampleFn = null;
let aiStatus: AiStatus = 'checking';
const aiListeners = new Set<() => void>();
const setAi = (s: AiStatus) => { aiStatus = s; aiListeners.forEach((l) => l()); };
export const getAiStatus = () => aiStatus;
export const onAiStatus = (l: () => void) => { aiListeners.add(l); return () => aiListeners.delete(l); };

export async function detectLiveAi() {
  const rt = (window as any).claude; // the artifact runtime's API object
  if (!rt || typeof rt.use !== 'function') { setAi('unavailable'); return; }
  try { sample = await rt.use('sample'); setAi(sample ? 'available' : 'unavailable'); } catch { setAi('unavailable'); }
}

// ---------------------------------------------------------------------------
// Context shared by both sources
// ---------------------------------------------------------------------------
function questionView(q: Question) {
  if (q.type === 'mcq') return { type: 'QCM', prompt: q.prompt, choices: q.choices.map((c) => c.text) };
  if (q.type === 'tf') return { type: 'vrai ou faux', prompt: q.prompt };
  return { type: 'réponse courte', prompt: q.prompt };
}

export function buildContext(s: LearnerState, ctx: BrainContext) {
  const course = getCourse(s.currentCourseId)!;
  const st = courseStats(s, course);
  const rec = recommendation(s);
  const lesson = ctx.lesson ? getLesson(ctx.lesson.lessonId) : undefined;
  const q = lesson && ctx.lesson?.questionId ? lesson.questions?.find((x) => x.id === ctx.lesson!.questionId) : undefined;
  return {
    page: PAGE_LABEL[ctx.page],
    learner: { firstName: s.profile.firstName, dailyGoalMinutes: s.profile.dailyGoalMin, minutesToday: todayMinutes(s), streakDays: streak(s).days },
    currentPath: { course: course.title, cefr: course.cefr, lessonsDone: st.done, lessonsTotal: st.total, percent: st.pct, module: st.module?.title,
      skills: skillLevels(s, course.id).filter((x) => x.count).map((x) => `${x.label} niv. ${x.level}`) },
    recommendedNext: rec ? { id: rec.lesson.id, title: rec.lesson.title, course: rec.course.shortTitle, minutes: rec.lesson.minutes, kind: KIND_LABEL[rec.lesson.kind], skill: SKILL_LABEL[rec.lesson.skill] } : null,
    openLesson: lesson ? {
      id: lesson.id, title: lesson.title, kind: KIND_LABEL[lesson.kind], keyPoints: lesson.content?.keyPoints,
      transcript: lesson.content?.dialogue?.map((d) => `${d.speaker}: ${d.text}`).join('\n') ?? lesson.content?.reading?.paragraphs.join('\n'),
      currentQuestion: q ? { ...questionView(q), learnerHasAnswered: !!ctx.lesson?.answered, answeredCorrectly: ctx.lesson?.correct ?? null,
        correctAnswer: correctAnswerText(q), hint: q.hint, explanation: q.explanation } : null,
    } : null,
    otherCourses: COURSES.filter((c) => c.id !== course.id).map((c) => `${c.title} (${LEVEL_SHORT[c.level]}, ${courseStats(s, c).pct} %)`),
    subscription: (() => { const i = subscriptionInfo(s); return { offer: `${PLAN_NAME} ${i.plan.label.toLowerCase()} (${euros(i.plan.price)} / ${i.plan.per})`, status: i.label, paymentDue: i.state !== 'active', note: 'paiement de démonstration : rien n’est débité' }; })(),
  };
}

const RULES = `Tu es Léa, l'assistante pédagogique de LearnSpace, une plateforme d'apprentissage pour étudiants et adultes.
Règles :
- Présente-toi uniquement comme Léa, l'assistante virtuelle de LearnSpace. Ne nomme pas le modèle d'IA ni l'entreprise qui le fournit ; si on te le demande, dis simplement que tu es l'assistante virtuelle intégrée à LearnSpace.
- Réponds en français, en tutoyant, avec un ton chaleureux, concis et professionnel (2 à 5 phrases, 90 mots maximum).
- Appuie-toi sur le CONTEXTE fourni (progression réelle, leçon ouverte, question en cours). N'invente pas de chiffres.
- Si une question est en cours et que l'apprenant n'y a pas encore répondu, ne donne JAMAIS la bonne réponse : donne un indice.
- Après une réponse de l'apprenant, explique pourquoi la bonne réponse est correcte.
- Pas de listes à puces ni de titres. Au plus un emoji.
- Termine toujours par une ligne séparée au format exact [[humeur:X]] avec X parmi sourire, encourageant, reflexion, joie, concerne.
- Si une action aide l'apprenant, ajoute une ligne [[action:lecon:ID]] (ID d'une leçon du contexte) ou [[action:page:library|progress|courses|badges|subscription]].`;

export async function askLive(history: ChatMessage[], s: LearnerState, ctx: BrainContext, onText: (t: string) => void, signal: AbortSignal): Promise<Reply> {
  if (!sample) throw { code: 'not_granted' };
  const turns = history.filter((m) => !m.error && m.text.trim()).slice(-10).map((m) => ({ role: m.role, content: m.text }));
  while (turns.length && turns[0].role === 'assistant') turns.shift();
  const context = `CONTEXTE (JSON) :\n${JSON.stringify(buildContext(s, ctx))}`;
  const input = [{ role: 'user', content: `${RULES}\n\n${context}` }, ...turns];
  const res = await sample(input, { modelTier: 'quick', cache: false, signal, onText: ({ text }: { text: string }) => onText(stripTags(text)) });
  return parseTagged(res.text);
}

const MOODS: Record<string, Mood> = { sourire: 'smile', encourageant: 'encouraging', reflexion: 'thinking', réflexion: 'thinking', joie: 'happy', concerne: 'concerned', concerné: 'concerned' };
export const stripTags = (t: string) => t.replace(/\[\[[^\]]*\]?\]?\s*$/g, '').replace(/\[\[[^\]]*\]\]/g, '').trim();

function parseTagged(raw: string): Reply {
  let mood: Mood = 'smile'; const actions: AssistantAction[] = [];
  for (const m of raw.matchAll(/\[\[(humeur|action):([^\]]+)\]\]/g)) {
    if (m[1] === 'humeur') mood = MOODS[m[2].trim().toLowerCase()] ?? 'smile';
    else {
      const [kind, arg] = m[2].split(':').map((x) => x.trim());
      if (kind === 'lecon' && getLesson(arg)) actions.push({ kind: 'lesson', lessonId: arg, label: `Ouvrir « ${getLesson(arg)!.title} »` });
      if (kind === 'page' && ['library', 'progress', 'courses', 'badges', 'subscription'].includes(arg)) actions.push({ kind: 'page', page: arg as PageId, label: PAGE_LABEL[arg as PageId] });
    }
  }
  return { text: stripTags(raw), mood, actions, source: 'live' };
}

// ---------------------------------------------------------------------------
// Demo answers (no model): intent rules over the course data and the progress
// ---------------------------------------------------------------------------
const has = (n: string, ...words: string[]) => words.some((w) => n.includes(w));
const lessonAction = (l: Lesson, label?: string): AssistantAction => ({ kind: 'lesson', lessonId: l.id, label: label ?? `Ouvrir « ${l.title} »` });

export function demoReply(text: string, s: LearnerState, ctx: BrainContext): Reply {
  const n = normalizeAnswer(text);
  const course = getCourse(s.currentCourseId)!;
  const st = courseStats(s, course);
  const rec = recommendation(s);
  const lesson = ctx.lesson ? getLesson(ctx.lesson.lessonId) : undefined;
  const q = lesson && ctx.lesson?.questionId ? lesson.questions?.find((x) => x.id === ctx.lesson!.questionId) : undefined;
  const R = (t: string, mood: Mood = 'smile', actions: AssistantAction[] = []): Reply => ({ text: t, mood, actions, source: 'demo' });

  if (has(n, 'indice', 'aide moi', 'aide-moi', 'hint', 'bloque', 'coince', 'je ne sais pas', 'sais pas')) {
    if (q && !ctx.lesson?.answered) return R(LINES.hint(q), 'encouraging');
    if (q) return R(ctx.lesson?.correct ? LINES.explainOk(q) : LINES.explainKo(q), 'smile');
    return R(LINES.noHintYet, 'smile', rec ? [lessonAction(rec.lesson, 'Reprendre ma leçon')] : []);
  }
  if (has(n, 'pourquoi', 'explique', 'expliquer', 'comprends pas', 'comprend pas', 'signifie', 'veut dire', 'c est quoi', 'correction')) {
    if (q && ctx.lesson?.answered) return R(ctx.lesson.correct ? LINES.explainOk(q) : LINES.explainKo(q), ctx.lesson.correct ? 'happy' : 'encouraging');
    if (q) return R(LINES.hint(q), 'thinking');
    if (lesson?.content) return R(LINES.summary(lesson), 'smile');
  }
  if (has(n, 'resume', 'synthese', 'retenir', 'essentiel', 'recap')) {
    const target = lesson ?? rec?.lesson;
    if (target?.content) return R(LINES.summary(target), 'smile', lesson ? [] : [lessonAction(target)]);
    const mod = st.module;
    return R(`Le module en cours est « ${mod?.title} ». Tu as terminé ${st.done} leçons sur ${st.total} dans ton parcours ${course.shortTitle.toLowerCase()}.`, 'smile');
  }
  if (has(n, 'prochaine', 'suivante', 'next', 'continuer', 'quoi faire', 'que faire', 'recommand', 'par ou', 'commencer')) {
    if (!rec) return R(LINES.allDone, 'happy');
    return R(LINES.recommend(rec.lesson), 'encouraging', [lessonAction(rec.lesson, `Commencer « ${rec.lesson.title} »`)]);
  }
  if (has(n, 'revis', 'revoir', 'exercice', 'entrainer', 'pratique', 'erreur')) {
    const review = PRACTICE_LESSONS[0];
    return R(LINES.review, 'encouraging', [lessonAction(review, 'Lancer la révision')]);
  }
  if (has(n, 'progress', 'avancement', 'ou en suis', 'statistique', 'stat', 'score', 'niveau', 'objectif', 'serie')) {
    const sk = streak(s); const comp = competencies(s, course.id); const today = todayMinutes(s);
    const goal = s.profile.dailyGoalMin;
    return R(`Tu as terminé ${st.done} leçons sur ${st.total} (${st.pct} %) et acquis ${comp.acquired} compétences sur ${comp.total}. Série en cours : ${sk.days} jour${sk.days > 1 ? 's' : ''}. Aujourd’hui : ${minutesLabel(today)} sur ${goal} min${today >= goal ? ', objectif atteint !' : `, encore ${goal - today} min pour ton objectif.`}`, today >= goal ? 'happy' : 'encouraging', [{ kind: 'page', page: 'progress', label: 'Voir ma progression' }]);
  }
  if (has(n, 'badge', 'recompense', 'succes', 'trophee')) {
    const earned = ACHIEVEMENTS.filter((a) => s.achievements[a.id]);
    const nextB = ACHIEVEMENTS.filter((a) => !s.achievements[a.id]).map((a) => ({ a, p: a.progress(s) })).sort((x, y) => y.p.cur / y.p.target - x.p.cur / x.p.target)[0];
    return R(`Tu as obtenu ${earned.length} badges sur ${ACHIEVEMENTS.length}.${nextB ? ` Le plus proche : « ${nextB.a.title} » (${Math.min(nextB.p.cur, nextB.p.target)}/${nextB.p.target}).` : ''}`, 'happy', [{ kind: 'page', page: 'badges', label: 'Voir mes badges' }]);
  }
  if (has(n, 'merci')) return R(LINES.thanks, 'happy');
  if (has(n, 'bonjour', 'salut', 'hello', 'coucou', 'bonsoir')) return R(LINES.hello(s.profile.firstName), 'happy', rec ? [lessonAction(rec.lesson, 'Continuer')] : []);
  if (has(n, 'mobile', 'telephone', 'smartphone')) return R(LINES.mobile, 'smile');
  if (has(n, 'abonnement', 'payer', 'paiement', 'facture', 'premium', 'tarif', 'prix', 'combien ca coute', 'renouvel')) {
    const i = subscriptionInfo(s);
    const head = `Ton abonnement ${PLAN_NAME} (${i.plan.label.toLowerCase()}, ${euros(i.plan.price)} / ${i.plan.per}) : ${i.label.toLowerCase()}.`;
    const tail = i.state === 'active'
      ? ' Tu n’as rien à faire pour l’instant ; tu retrouves tes factures dans la page Abonnement.'
      : ' Tu peux le régler en deux clics depuis le menu. C’est une démonstration : rien n’est débité.';
    return R(head + tail, i.state === 'expired' ? 'concerned' : 'smile', i.state === 'active'
      ? [{ kind: 'page', page: 'subscription', label: 'Voir mon abonnement' }]
      : [{ kind: 'open', target: 'payment', label: 'Payer l’abonnement' }, { kind: 'page', page: 'subscription', label: 'Voir mon abonnement' }]);
  }
  if (has(n, 'nouveau cours', 'autre cours', 'ajouter un cours', 'inscrire', 'nouvelle matiere', 'commencer un cours')) {
    const left = COURSES.filter((c) => !s.enrollments[c.id]).length;
    return R(left ? `Il te reste ${left} cours à découvrir dans le catalogue. Choisis-en un : il rejoint « Mes cours » et je te le présente.` : 'Tu suis déjà tous les cours du catalogue. Bravo pour ta curiosité !', 'happy',
      left ? [{ kind: 'open', target: 'newCourse', label: 'Ajouter un cours' }] : [{ kind: 'page', page: 'courses', label: 'Mes cours' }]);
  }
  if (has(n, 'voix', 'parle', 'micro', 'son', 'audio', 'entendre')) return R(LINES.voice, 'smile', [{ kind: 'page', page: 'settings', label: 'Réglages de la voix' }]);
  if (has(n, 'qui es tu', 'tu es qui', 'intelligence', ' ia', 'robot', 'demo', 'modele', 'chatgpt', 'gpt')) return R(LINES.who, 'smile');
  // course search
  const words = n.split(' ').filter((w) => w.length > 3);
  const found = COURSES.filter((c) => words.some((w) => normalizeAnswer(`${c.title} ${c.description} ${c.shortTitle}`).includes(w)));
  if (found.length) {
    const c = found[0]; const cs = courseStats(s, c);
    return R(`J’ai trouvé « ${c.title} » (${LEVEL_SHORT[c.level].toLowerCase()}, environ ${c.hours} h). ${cs.enrolled ? `Tu l’as déjà commencé : ${cs.pct} %.` : 'Tu peux le commencer quand tu veux.'}`, 'smile',
      [{ kind: 'page', page: 'library', label: 'Voir la bibliothèque' }, ...(cs.next && cs.next.questions ? [lessonAction(cs.next, cs.enrolled ? 'Continuer ce cours' : 'Commencer ce cours')] : [])]);
  }
  if (lesson) return R(LINES.unknownLesson, 'curious');
  return R(LINES.unknown, 'curious');
}

export const SUGGESTIONS_BY_PAGE: Record<string, string[]> = {
  lesson: ['Un indice', 'Explique la correction', 'Résume la leçon'],
  default: ['Prochaine leçon', 'Où en suis-je ?', 'Exercice de révision', 'Résume mon module'],
};

export function moduleTitleOf(lessonId: string) { const l = getLesson(lessonId); return l ? getModule(l)?.title : undefined; }
export const weekMinutesLabel = (s: LearnerState) => minutesLabel(weekMinutes(s));
