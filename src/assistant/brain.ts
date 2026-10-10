// The assistant's answers. Two sources, chosen in Settings:
//  - "live": written on the fly by the language model the artifact runtime exposes through its
//            `sample` capability (viewer consent required)
//  - "demo": prepared answers computed from the course data and the learner's progress
// The interface never names the model or its provider: the learner talks to Léa.
import type { AssistantAction, ChatCard, ChatMessage, LearnerState, Lesson, Module, PageId, Question } from '../types';
import type { Mood } from './controller';
import { COURSES, getCourse, getLesson, SKILL_LABEL, KIND_LABEL, LEVEL_SHORT, PRACTICE_LESSONS, getModule, courseLessons, isPlayable } from '../data/courses';
import { courseStats, recommendation, streak, todayMinutes, competencies, correctAnswerText, normalizeAnswer, skillLevels, subscriptionInfo, assessments } from '../state/selectors';
import { PLAN_NAME, PLANS, euros } from '../data/plans';
import { minutesLabel, addDays, startOfDay, longDate, endOfDay } from '../lib/dates';
import { LINES } from './lines';
import { ACHIEVEMENTS } from '../state/achievements';
import { periodMinutes, lessonsDone, periodStart, accuracy, idleDays, nextAssessment, moduleStats, peakHours, pace } from '../state/insights';
import { nextBadges, badgeLeft, theCourse } from './pageLines';

export interface LessonContext { lessonId: string; questionId?: string; answered?: boolean; correct?: boolean }
export interface BrainContext { page: PageId; lesson?: LessonContext; courseId?: string }
export interface Reply { text: string; mood: Mood; actions: AssistantAction[]; source: 'live' | 'demo'; card?: ChatCard }

const PAGE_LABEL: Record<PageId, string> = { home: 'Accueil', courses: 'Mes cours', course: 'Fiche de cours', library: 'Bibliothèque', progress: 'Progression', badges: 'Badges', messages: 'Discussion', settings: 'Paramètres', lesson: 'Leçon', subscription: 'Abonnement' };

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
    learner: { firstName: s.profile.firstName, goal: s.profile.goal, dailyGoalMinutes: s.profile.dailyGoalMin, minutesToday: todayMinutes(s), streakDays: streak(s).days, coachingStyle: s.prefs.coach ?? 'encourage' },
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

const STYLE_RULE: Record<string, string> = {
  encourage: 'Style : encourageant, chaleureux, avec une félicitation sincère quand c’est mérité et un conseil pour la suite.',
  strict: 'Style : exigeant et direct, peu de compliments, des corrections précises et un exercice ciblé.',
  discreet: 'Style : sobre et bref, réponds uniquement à la question posée.',
};
const RULES = `Tu es Léa, l'assistante pédagogique de LearnSpace, une plateforme d'apprentissage pour étudiants et adultes.
Règles :
- Présente-toi uniquement comme Léa, l'assistante virtuelle de LearnSpace. Ne nomme pas le modèle d'IA ni l'entreprise qui le fournit ; si on te le demande, dis simplement que tu es l'assistante virtuelle intégrée à LearnSpace.
- Réponds en français, en tutoyant, de façon concise et professionnelle (2 à 5 phrases, 90 mots maximum).
- Appuie-toi sur le CONTEXTE fourni (progression réelle, leçon ouverte, question en cours). N'invente pas de chiffres.
- Si une question est en cours et que l'apprenant n'y a pas encore répondu, ne donne JAMAIS la bonne réponse : donne un indice.
- Après une réponse de l'apprenant, explique pourquoi la bonne réponse est correcte.
- Pas de listes à puces ni de titres. Tu peux mettre un ou deux mots importants en gras avec **…**. Au plus un emoji.
- Termine toujours par une ligne séparée au format exact [[humeur:X]] avec X parmi sourire, encourageant, reflexion, joie, concerne.
- Si une action aide l'apprenant, ajoute une ligne [[action:lecon:ID]] (ID d'une leçon du contexte) ou [[action:page:library|progress|courses|badges|subscription]].`;

export async function askLive(history: ChatMessage[], s: LearnerState, ctx: BrainContext, onText: (t: string) => void, signal: AbortSignal): Promise<Reply> {
  if (!sample) throw { code: 'not_granted' };
  const turns = history.filter((m) => !m.error && m.text.trim()).slice(-10).map((m) => ({ role: m.role, content: m.text }));
  while (turns.length && turns[0].role === 'assistant') turns.shift();
  const context = `CONTEXTE (JSON) :\n${JSON.stringify(buildContext(s, ctx))}`;
  const input = [{ role: 'user', content: `${RULES}\n${STYLE_RULE[s.prefs.coach ?? 'encourage']}\n\n${context}` }, ...turns];
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
      if (kind === 'lecon' && getLesson(arg)) actions.push({ kind: 'lesson', lessonId: arg, label: `Ouvrir « ${getLesson(arg)!.title} »` });
      if (kind === 'page' && ['library', 'progress', 'courses', 'badges', 'subscription'].includes(arg)) actions.push({ kind: 'page', page: arg as PageId, label: PAGE_LABEL[arg as PageId] });
    }
  }
  return { text: stripTags(raw), mood, actions, source: 'live' };
}

// ---------------------------------------------------------------------------
// Demo answers (no model): intent rules over the course data and the progress
// ---------------------------------------------------------------------------
const has = (n: string, ...words: string[]) => words.some((w) => n.includes(w));
const lessonAction = (l: Lesson, label?: string): AssistantAction => ({ kind: 'lesson', lessonId: l.id, label: label ?? `Ouvrir « ${l.title} »` });
const plural = (n: number, w: string, p = `${w}s`) => `${n} ${n > 1 ? p : w}`;

/** Words often confused by French speakers, with examples (demo knowledge). */
const PAIRS: { terms: string[]; text: string; items: { term: string; ex: string; fr: string }[] }[] = [
  { terms: ['journey', 'trip', 'travel'], text: '**Trip** désigne le voyage dans son ensemble : le départ, le séjour et le retour. **Journey** désigne le trajet lui-même, le temps passé à se déplacer. **Travel** est surtout un verbe (voyager) ou l’idée générale du voyage.',
    items: [{ term: 'trip', ex: 'How was your trip to Edinburgh?', fr: 'Comment s’est passé ton voyage à Édimbourg ?' }, { term: 'journey', ex: 'The journey takes four and a half hours.', fr: 'Le trajet dure quatre heures et demie.' }, { term: 'travel', ex: 'I love to travel by train.', fr: 'J’adore voyager en train.' }] },
  { terms: ['book', 'reserve'], text: '**To book** est le verbe courant pour réserver (un billet, une table, une visite). **To reserve** existe aussi, mais il est plus formel.',
    items: [{ term: 'to book', ex: 'Let’s book the museum tour tonight.', fr: 'Réservons la visite du musée ce soir.' }, { term: 'to reserve', ex: 'I’d like to reserve a table for two.', fr: 'Je voudrais réserver une table pour deux.' }] },
  { terms: ['lift', 'elevator'], text: '**Lift** est le mot britannique, **elevator** le mot américain : les deux désignent un ascenseur.',
    items: [{ term: 'lift', ex: 'The lift is next to the stairs.', fr: 'L’ascenseur est à côté de l’escalier.' }, { term: 'elevator', ex: 'Take the elevator to the fifth floor.', fr: 'Prends l’ascenseur jusqu’au cinquième étage.' }] },
  { terms: ['say', 'tell'], text: '**Say** se concentre sur les mots prononcés. **Tell** est suivi de la personne à qui l’on parle (tell someone something).',
    items: [{ term: 'say', ex: 'She said it was late.', fr: 'Elle a dit qu’il était tard.' }, { term: 'tell', ex: 'He told me the truth.', fr: 'Il m’a dit la vérité.' }] },
  { terms: ['landmark', 'monument'], text: '**Landmark** désigne un lieu facile à reconnaître, qui sert de repère (un pont, une tour). **Monument** désigne plutôt une construction qui commémore quelque chose.',
    items: [{ term: 'landmark', ex: 'Big Ben is a famous landmark.', fr: 'Big Ben est un lieu emblématique.' }, { term: 'monument', ex: 'The monument honours the soldiers.', fr: 'Le monument rend hommage aux soldats.' }] },
];

/** Every English sentence of the lessons with its French translation. */
function knownSentences() {
  const out: { en: string; fr: string }[] = [];
  for (const c of COURSES) for (const l of courseLessons(c)) {
    for (const d of l.content?.dialogue ?? []) if (d.fr) out.push({ en: d.text, fr: d.fr });
    for (const v of l.content?.vocab ?? []) if (v.ex) out.push({ en: v.ex, fr: v.fr });
  }
  for (const p of PAIRS) for (const it of p.items) out.push({ en: it.ex, fr: it.fr });
  return out;
}

/** A pending mini exercise: Léa checks the learner's next message against it. */
let pending: { answers: string[]; ok: string; ko: string } | null = null;

function vocabPool(s: LearnerState, lesson?: Lesson) {
  if (lesson?.content?.vocab?.length) return lesson.content.vocab;
  const c = getCourse(s.currentCourseId)!;
  const done = courseLessons(c).filter((l) => l.content?.vocab?.length && (s.completions[l.id] || s.attempts[l.id]));
  return (done.length ? done : courseLessons(c).filter((l) => l.content?.vocab?.length)).flatMap((l) => l.content!.vocab!);
}

function exercise(s: LearnerState, lastCard: ChatCard | undefined, lesson?: Lesson): Reply {
  if (lastCard?.kind === 'words' && lastCard.items.length >= 2) {
    const [a, b] = lastCard.items;
    const gap = (ex: string, term: string) => ex.replace(new RegExp(term.replace(/^to /, ''), 'i'), '___');
    pending = { answers: [b.term.replace(/^to /, '')], ok: `Exactement : « ${b.ex} ». ${b.fr}`, ko: `Presque ! La bonne réponse est « ${b.term} » : « ${b.ex} ».` };
    return { text: `Complète avec **${a.term}** ou **${b.term}** : « ${gap(b.ex, b.term)} »`, mood: 'curious', actions: [], source: 'demo' };
  }
  const pool = vocabPool(s, lesson).filter((v) => !!v.ex && new RegExp(`\\b${v.term.replace(/^to /, '').split(' ')[0]}`, 'i').test(v.ex)) as { term: string; fr: string; ex: string }[];
  if (!pool.length) return { text: 'Ouvre une leçon et je te prépare un exercice sur son vocabulaire.', mood: 'smile', actions: [], source: 'demo' };
  const v = pool[(Date.now() >> 10) % pool.length];
  const word = v.term.replace(/^to /, '');
  pending = { answers: [word.split(' ')[0]], ok: `Bravo ! « ${v.ex} » ${v.fr ? `(${v.fr})` : ''}`.trim(), ko: `Pas tout à fait : il fallait « ${word} ». « ${v.ex} »` };
  return { text: `Petit exercice : quel mot anglais signifie **${v.fr}** ? Complète : « ${v.ex.replace(new RegExp(word.split(' ')[0], 'i'), '___')} »`, mood: 'curious', actions: [], source: 'demo' };
}

function moduleFromText(n: string, s: LearnerState, courseId?: string): Module | undefined {
  const c = getCourse(courseId ?? s.currentCourseId)!;
  const num = n.match(/module\s*(\d+)/)?.[1];
  if (num) return c.modules.find((m) => m.index === Number(num));
  return undefined;
}

export function demoReply(text: string, s: LearnerState, ctx: BrainContext): Reply {
  const n = normalizeAnswer(text);
  const course = getCourse(ctx.courseId && s.enrollments[ctx.courseId] ? ctx.courseId : s.currentCourseId)!;
  const main = getCourse(s.currentCourseId)!;
  const st = courseStats(s, main);
  const rec = recommendation(s);
  const lesson = ctx.lesson ? getLesson(ctx.lesson.lessonId) : undefined;
  const q = lesson && ctx.lesson?.questionId ? lesson.questions?.find((x) => x.id === ctx.lesson!.questionId) : undefined;
  const R = (t: string, mood: Mood = 'smile', actions: AssistantAction[] = [], card?: ChatCard): Reply => ({ text: t, mood, actions, source: 'demo', card });
  const lastCard = [...s.conversation].reverse().find((m) => m.role === 'assistant' && m.card)?.card;
  const strict = s.prefs.coach === 'strict';

  // answer to a mini exercise
  if (pending && !text.includes('?') && n.split(' ').length <= 8) {
    const p = pending; pending = null;
    const ok = p.answers.some((a) => n.split(' ').includes(normalizeAnswer(a)) || n === normalizeAnswer(a));
    return ok ? R(strict ? `Correct. ${p.ok}` : `${p.ok} 👏`, 'happy', [{ kind: 'ask', text: 'Un autre exercice', label: 'Un autre exercice' }])
      : R(p.ko, 'encouraging', [{ kind: 'ask', text: 'Un autre exercice', label: 'Réessayer avec un autre mot' }]);
  }
  pending = null;

  if (has(n, 'tradui la question', 'traduire la question', 'traduis la question', 'traduction de la question')) {
    if (q?.fr) return R(`En français : « ${q.fr} »`, 'smile');
    if (q) return R('Cette question est déjà en français. Veux-tu un indice ?', 'smile', [{ kind: 'ask', text: 'Un indice', label: 'Un indice' }]);
    return R('Ouvre une question de leçon et je te la traduis.', 'smile');
  }
  if (has(n, 'indice', 'aide moi', 'hint', 'bloque', 'coince', 'je ne sais pas', 'sais pas')) {
    if (q && !ctx.lesson?.answered) return R(LINES.hint(q), 'encouraging');
    if (q) return R(ctx.lesson?.correct ? LINES.explainOk(q) : LINES.explainKo(q), 'smile');
    return R(LINES.noHintYet, 'smile', rec ? [lessonAction(rec.lesson, 'Reprendre ma leçon')] : []);
  }
  if (has(n, 'difference', 'confond', ' ou ', 'versus', ' vs ')) {
    const pair = PAIRS.find((p) => p.terms.filter((t) => n.includes(t)).length >= 2) ?? PAIRS.find((p) => p.terms.some((t) => n.includes(t)) && has(n, 'difference'));
    if (pair) return R(pair.text, 'smile', [{ kind: 'ask', text: 'Un exercice sur ces mots', label: 'Un exercice sur ces mots' }], { kind: 'words', items: pair.items.slice(0, 2) });
  }
  if (has(n, 'exercice', 'entraine moi', 'quiz', 'teste moi')) {
    if (has(n, 'evaluation')) return assessmentReply(s, course);
    return exercise(s, lastCard, lesson);
  }
  if (has(n, 'tradui', 'traduction', 'traduire')) {
    const found = knownSentences().find((x) => n.includes(normalizeAnswer(x.en)) || normalizeAnswer(x.en).includes(n.replace(/^(tradui[a-z]*|traduction|traduire)\s*(la phrase|cette phrase|de)?\s*/, '')) && n.length > 18);
    if (found) return R(`« ${found.en} » se traduit par : **${found.fr}**`, 'smile');
    return R('Écris-moi la phrase anglaise de ta leçon à traduire. En mode démonstration, je traduis les phrases des leçons ; avec les réponses en direct, je traduis n’importe quelle phrase.', 'smile');
  }
  if (has(n, 'pourquoi', 'explique', 'expliquer', 'comprends pas', 'comprend pas', 'signifie', 'veut dire', 'c est quoi', 'correction')) {
    if (q && ctx.lesson?.answered) return R(ctx.lesson.correct ? LINES.explainOk(q) : LINES.explainKo(q), ctx.lesson.correct ? 'happy' : 'encouraging');
    if (q) return R(LINES.hint(q), 'thinking');
    if (lesson?.content) return R(LINES.summary(lesson), 'smile');
  }
  if (has(n, 'evaluation') && has(n, 'entrain', 'prepar', 'passer', 'quand', 'evaluation du module')) return assessmentReply(s, course);
  if (has(n, 'resume', 'resumer', 'synthese', 'retenir', 'essentiel', 'recap')) {
    const m = moduleFromText(n, s, ctx.courseId);
    if (m) return moduleSummary(s, m);
    const target = lesson ?? rec?.lesson;
    if (target?.content) return R(LINES.summary(target), 'smile', lesson ? [] : [lessonAction(target)]);
    return st.module ? moduleSummary(s, st.module) : R(`Tu as terminé ${st.done} leçons sur ${st.total}.`, 'smile');
  }
  if (has(n, 'revis', 'revoir')) {
    const m = moduleFromText(n, s, ctx.courseId);
    if (m) return moduleReview(s, m);
    const review = PRACTICE_LESSONS[0];
    return R(LINES.review, 'encouraging', [lessonAction(review, 'Lancer la révision')]);
  }
  if (has(n, 'planifi', 'organis', 'ma semaine', 'planning', 'emploi du temps')) return weekPlan(s);
  if (has(n, 'priorit')) return priorities(s);
  if (has(n, 'pause')) {
    const idle = COURSES.filter((c) => s.enrollments[c.id] && !s.enrollments[c.id].paused && c.id !== s.currentCourseId && courseStats(s, c).pct < 100)
      .map((c) => ({ c, d: idleDays(s, c.id) ?? 0 })).sort((a, b) => b.d - a.d)[0];
    if (!idle) return R('Tu n’as pas de cours secondaire à mettre en pause : tous tes cours avancent.', 'smile');
    return R(`Mettre un cours en pause le range dans « En pause » sans perdre ta progression. ${idle.d >= 14 ? `${cap(theCourse(idle.c))} n’a pas bougé depuis ${idle.d} jours : ` : 'Je te propose '}${idle.d >= 14 ? 'c’est un bon candidat.' : `${theCourse(idle.c)}.`} Tu pourras le reprendre en un clic.`, 'smile',
      [{ kind: 'pause', courseId: idle.c.id, label: `Mettre ${idle.c.shortTitle} en pause` }, { kind: 'page', page: 'courses', label: 'Mes cours' }]);
  }
  if (has(n, 'bilan')) return monthReport(s, has(n, 'semaine') ? 'week' : 'month');
  if (has(n, 'objectif') && has(n, 'chang', 'modifi', 'augment', 'baiss')) return R(`Ton objectif est de ${s.profile.dailyGoalMin} minutes par jour. Tu peux le changer dans tes paramètres : je recalcule ton plan tout de suite.`, 'smile', [{ kind: 'page', page: 'settings', label: 'Changer mon objectif' }]);
  if (has(n, 'comment gagner', 'comment obtenir', 'prochains badges', 'prochain badge')) {
    const named = ACHIEVEMENTS.find((a) => n.includes(normalizeAnswer(a.title)));
    const nb = named ? { a: named, p: named.progress(s), left: Math.max(0, named.progress(s).target - named.progress(s).cur) } : nextBadges(s)[0];
    if (!nb) return R('Tu as obtenu tous les badges. Chapeau !', 'happy');
    if (s.achievements[nb.a.id]) return R(`Tu as déjà le badge « ${nb.a.title} » !`, 'happy', [{ kind: 'page', page: 'badges', label: 'Voir mes badges' }]);
    return R(`« ${nb.a.title} » : ${nb.a.description.toLowerCase().replace(/\.$/, '')}. Tu en es à ${Math.min(nb.p.cur, nb.p.target)} sur ${nb.p.target} : encore ${badgeLeft(nb.a.id, nb.left)}.`, 'encouraging', [{ kind: 'page', page: 'badges', label: 'Voir mes badges' }]);
  }
  if (has(n, 'compar', 'offres', 'annuel', 'mensuel')) {
    const m = PLANS.monthly, y = PLANS.yearly;
    return R(`Mensuel : ${euros(m.price)} par mois, sans engagement. Annuel : ${euros(y.price)} par an, soit ${euros(y.perMonth)} par mois et ${euros(m.price * 12 - y.price)} d’économie sur l’année. Les deux donnent accès à tous les cours et à moi.`, 'smile',
      [{ kind: 'open', target: 'payment', label: 'Choisir mon offre' }]);
  }
  if (has(n, 'rappel', 'rappelle', 'previens')) {
    const i = subscriptionInfo(s);
    const day = i.state !== 'expired' && i.daysLeft >= 1 ? addDays(startOfDay(i.until), -1) : addDays(startOfDay(new Date()), 1);
    day.setHours(9, 0, 0, 0);
    return R(`Je te rappelle ton abonnement le ${longDate(day)} à 9 h, dans tes notifications.`, 'smile', [{ kind: 'remind', at: day.toISOString(), title: 'Ton abonnement se termine bientôt', label: 'Programmer le rappel' }]);
  }
  if (has(n, 'prochaine', 'suivante', 'next', 'continuer', 'quoi faire', 'que faire', 'recommand', 'par ou', 'commencer')) {
    if (!rec) return R(LINES.allDone, 'happy');
    return R(LINES.recommend(rec.lesson), 'encouraging', [lessonAction(rec.lesson, `Commencer « ${rec.lesson.title} »`)]);
  }
  if (has(n, 'progress', 'avancement', 'ou en suis', 'statistique', 'stat', 'score', 'niveau', 'objectif', 'serie')) {
    const sk = streak(s); const comp = competencies(s, main.id); const today = todayMinutes(s);
    const goal = s.profile.dailyGoalMin;
    return R(`Tu as terminé **${st.done} leçons sur ${st.total}** (${st.pct} %) et acquis ${comp.acquired} compétences sur ${comp.total}. Série en cours : ${plural(sk.days, 'jour')}. Aujourd’hui : ${minutesLabel(today)} sur ${goal} min${today >= goal ? ', objectif atteint !' : `, encore ${goal - today} min pour ton objectif.`}`,
      today >= goal ? 'happy' : 'encouraging', [...(rec ? [lessonAction(rec.lesson, 'Continuer la leçon')] : []), { kind: 'page', page: 'progress', label: 'Voir ma progression' }], { kind: 'course', courseId: main.id });
  }
  if (has(n, 'badge', 'recompense', 'succes', 'trophee')) {
    const earned = ACHIEVEMENTS.filter((a) => s.achievements[a.id]);
    const nb = nextBadges(s)[0];
    return R(`Tu as obtenu ${earned.length} badges sur ${ACHIEVEMENTS.length}.${nb ? ` Le plus proche : « ${nb.a.title} » (${Math.min(nb.p.cur, nb.p.target)}/${nb.p.target}).` : ''}`, 'happy', [{ kind: 'page', page: 'badges', label: 'Voir mes badges' }]);
  }
  if (has(n, 'merci')) return R(strict ? 'Avec plaisir. On continue ?' : LINES.thanks, 'happy');
  if (has(n, 'bonjour', 'salut', 'hello', 'coucou', 'bonsoir')) return R(LINES.hello(s.profile.firstName), 'happy', rec ? [lessonAction(rec.lesson, 'Continuer')] : []);
  if (has(n, 'mobile', 'telephone', 'smartphone')) return R(LINES.mobile, 'smile');
  if (has(n, 'abonnement', 'payer', 'paiement', 'facture', 'premium', 'tarif', 'prix', 'combien ca coute', 'renouvel')) {
    const i = subscriptionInfo(s);
    const head = `Ton abonnement ${PLAN_NAME} (${i.plan.label.toLowerCase()}, ${euros(i.plan.price)} / ${i.plan.per}) : ${i.label.toLowerCase()}.`;
    const tail = i.state === 'active' ? ' Tu n’as rien à faire pour l’instant ; tes factures sont dans la page Abonnement.' : ' Tu peux le régler en deux clics. C’est une démonstration : rien n’est débité.';
    return R(head + tail, i.state === 'expired' ? 'concerned' : 'smile', i.state === 'active'
      ? [{ kind: 'page', page: 'subscription', label: 'Voir mon abonnement' }]
      : [{ kind: 'open', target: 'payment', label: 'Payer l’abonnement' }, { kind: 'page', page: 'subscription', label: 'Voir mon abonnement' }]);
  }
  if (has(n, 'nouveau cours', 'autre cours', 'ajouter un cours', 'inscrire', 'nouvelle matiere', 'commencer un cours')) {
    const left = COURSES.filter((c) => !s.enrollments[c.id]).length;
    return R(left ? `Il te reste ${left} cours à découvrir dans le catalogue. Choisis-en un : il rejoint « Mes cours » et je te le présente.` : 'Tu suis déjà tous les cours du catalogue. Bravo pour ta curiosité !', 'happy',
      left ? [{ kind: 'open', target: 'newCourse', label: 'Ajouter un cours' }] : [{ kind: 'page', page: 'courses', label: 'Mes cours' }]);
  }
  if (has(n, 'voix', 'parle', 'micro', 'son', 'audio', 'entendre')) return R(LINES.voice, 'smile', [{ kind: 'page', page: 'settings', label: 'Mes réglages' }]);
  if (has(n, 'qui es tu', 'tu es qui', 'intelligence', ' ia', 'robot', 'modele', 'chatgpt', 'gpt')) return R(LINES.who, 'smile');
  // course search
  const words = n.split(' ').filter((w) => w.length > 3);
  const found = COURSES.filter((c) => words.some((w) => normalizeAnswer(`${c.title} ${c.description} ${c.shortTitle}`).includes(w)));
  if (found.length) {
    const c = found[0]; const cs = courseStats(s, c);
    return R(`J’ai trouvé « ${c.title} » (${LEVEL_SHORT[c.level].toLowerCase()}, environ ${c.hours} h). ${cs.enrolled ? `Tu l’as déjà commencé : ${cs.pct} %.` : 'Tu peux le commencer quand tu veux.'}`, 'smile',
      [{ kind: 'page', page: 'course', courseId: c.id, label: 'Voir le cours' }, ...(cs.next && cs.next.questions ? [lessonAction(cs.next, cs.enrolled ? 'Continuer ce cours' : 'Commencer ce cours')] : [])]);
  }
  if (lesson) return R(LINES.unknownLesson, 'curious');
  return R(LINES.unknown, 'curious');
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function assessmentReply(s: LearnerState, c: ReturnType<typeof getCourse> & object): Reply {
  const na = nextAssessment(s, c);
  if (!na) return { text: 'Tu as validé toutes les évaluations disponibles de ce cours. Bravo !', mood: 'happy', actions: [], source: 'demo' };
  const playable = isPlayable(na.lesson);
  const nq = na.lesson.questions?.length;
  const text = `L’évaluation du module ${na.module.index} (« ${na.module.title} ») ${nq ? `compte ${nq} questions et ` : ''}se valide à ${Math.round((na.lesson.passMark ?? 0.7) * 100)} % de bonnes réponses du premier coup.${na.before ? ` Il te reste ${plural(na.before, 'leçon')} avant de la passer.` : ' Tu peux la passer maintenant.'} Revois les points clés des leçons, puis lance-toi.`;
  const firstLeft = na.module.lessons.find((l) => l.kind !== 'assessment' && !s.completions[l.id]?.passed && isPlayable(l));
  return { text, mood: 'encouraging', source: 'demo', actions: [...(na.before && firstLeft ? [lessonAction(firstLeft, `Avant : « ${firstLeft.title} »`)] : []), ...(playable ? [lessonAction(na.lesson, 'Ouvrir l’évaluation')] : [])] };
}

function moduleSummary(s: LearnerState, m: Module): Reply {
  const kp = m.lessons.flatMap((l) => l.content?.keyPoints?.slice(0, 1) ?? []);
  const ms = moduleStats(s, m);
  const comps = m.competencies.map((c) => c.label.toLowerCase()).join(' et ');
  const text = `Module ${m.index}, « ${m.title} » : ${plural(ms.total, 'leçon')}, ${ms.done} terminée${ms.done > 1 ? 's' : ''}. Tu y apprends à ${comps}.${kp.length ? ` L’essentiel : ${kp.slice(0, 3).join(' ; ')}.` : ''}`;
  const next = m.lessons.find((l) => !s.completions[l.id]?.passed && isPlayable(l));
  return { text, mood: 'smile', actions: next ? [lessonAction(next)] : [], source: 'demo' };
}

function moduleReview(s: LearnerState, m: Module): Reply {
  const c = getCourse(m.courseId)!;
  const practice = PRACTICE_LESSONS.find((p) => p.courseId === c.id && m.lessons.some((l) => l.skill === p.skill && /verb|irr|past|prét/i.test(l.title)));
  const scored = m.lessons.map((l) => ({ l, c: s.completions[l.id] })).filter((x) => x.c?.total).sort((a, b) => a.c!.score / a.c!.total - b.c!.score / b.c!.total);
  const weakest = scored[0];
  const text = `Pour réviser le module ${m.index}, « ${m.title} »${weakest ? `, commence par « ${weakest.l.title} » (${weakest.c!.score}/${weakest.c!.total} au premier essai)` : ''}.${practice ? ` J’ai aussi une révision express de ${practice.minutes} minutes sur le même thème.` : ''}`;
  const actions: AssistantAction[] = [];
  if (practice) actions.push(lessonAction(practice, 'Lancer la révision'));
  if (weakest && isPlayable(weakest.l)) actions.push(lessonAction(weakest.l, `Revoir « ${weakest.l.title} »`));
  if (!actions.length) actions.push({ kind: 'page', page: 'course', courseId: c.id, label: 'Voir le programme' });
  return { text, mood: 'encouraging', actions, source: 'demo' };
}

function weekPlan(s: LearnerState): Reply {
  const c = getCourse(s.currentCourseId)!;
  const todo = courseLessons(c).filter((l) => !s.completions[l.id]?.passed).slice(0, 5);
  const goal = s.profile.dailyGoalMin;
  const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  const now = new Date(); const dow = (now.getDay() + 6) % 7;
  const ph = peakHours(s);
  let d = dow; const items: string[] = [];
  for (const l of todo) {
    if (items.length >= 4) break;
    items.push(`${days[d % 7]} : « ${l.title} » (${l.minutes} min)`);
    d += l.minutes > goal ? 2 : 1;
  }
  const text = `Avec ${goal} minutes par jour${ph ? `, ${ph.moment}` : ''}, voici ta semaine : ${items.join(', ')}. Garde le week-end pour une révision.`;
  const first = todo.find(isPlayable);
  return { text, mood: 'encouraging', actions: first ? [lessonAction(first, 'Commencer maintenant')] : [], source: 'demo' };
}

function priorities(s: LearnerState): Reply {
  const c = getCourse(s.currentCourseId)!;
  const rec = recommendation(s);
  const weakest = skillLevels(s, c.id).filter((x) => x.count > 0).sort((a, b) => a.level - b.level || a.count - b.count)[0];
  const idle = COURSES.filter((x) => s.enrollments[x.id] && !s.enrollments[x.id].paused && x.id !== c.id && courseStats(s, x).pct < 100).map((x) => ({ x, d: idleDays(s, x.id) ?? 0 })).sort((a, b) => b.d - a.d)[0];
  const parts = [`1. Ton parcours principal : ${rec ? `« ${rec.lesson.title} »` : 'la suite du module'}.`];
  if (weakest) parts.push(`2. Ta compétence la moins avancée : ${weakest.label.toLowerCase()} (niveau ${weakest.level}).`);
  if (idle && idle.d >= 14) parts.push(`3. ${cap(theCourse(idle.x))} attend depuis ${idle.d} jours : une leçon par semaine suffit, ou mets-le en pause.`);
  return { text: parts.join(' '), mood: 'smile', source: 'demo', actions: [...(rec ? [lessonAction(rec.lesson, 'Commencer la priorité 1')] : []), ...(idle && idle.d >= 14 ? [{ kind: 'pause' as const, courseId: idle.x.id, label: `Mettre ${idle.x.shortTitle} en pause` }] : [])] };
}

function monthReport(s: LearnerState, period: 'week' | 'month'): Reply {
  const now = new Date(); const since = periodStart(period, now);
  const minutes = periodMinutes(s, period, now);
  const lessons = lessonsDone(s, since);
  const acc = accuracy(s, { since });
  const label = period === 'week' ? 'Cette semaine' : 'Ce mois-ci';
  const c = getCourse(s.currentCourseId)!;
  const p = pace(s, c.id, now);
  const text = `${label} : ${minutesLabel(minutes)} d’apprentissage, ${plural(lessons, 'leçon')} terminée${lessons > 1 ? 's' : ''}${acc.pct !== null ? ` et ${acc.pct} % de bonnes réponses du premier coup` : ''}. ${p > 0 ? `À ce rythme, tu termines ${theCourse(c)} vers le ${longDate(addDays(startOfDay(now), Math.ceil((courseStats(s, c).total - courseStats(s, c).done) / p)))}.` : 'Reprends une leçon pour relancer ton rythme.'}`;
  return { text, mood: 'happy', actions: [{ kind: 'page', page: 'progress', label: 'Voir ma progression' }], source: 'demo' };
}

export const SUGGESTIONS_BY_PAGE: Record<string, string[]> = {
  lesson: ['Un indice', 'Traduire la question', 'Résume la leçon'],
  default: ['Prochaine leçon', 'Où en suis-je ?', 'Exercice de révision', 'Résume mon module'],
};

export function moduleTitleOf(lessonId: string) { const l = getLesson(lessonId); return l ? getModule(l)?.title : undefined; }
export const assessmentsOf = (s: LearnerState) => assessments(s);
export const endOfToday = () => endOfDay(new Date());
