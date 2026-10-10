import React, { useMemo, useState } from 'react';
import { useLearner } from '../state/store';
import { courseStats, recommendation, streak, todayMinutes, competencies } from '../state/selectors';
import { periodStart, periodMinutes, lessonsDone, competenciesSince, bestStreak, moduleStats } from '../state/insights';
import { getCourse, KIND_LABEL, COURSES, courseLessons, isPlayable, PRACTICE_LESSONS } from '../data/courses';
import { ACHIEVEMENTS } from '../state/achievements';
import { navigate } from '../router';
import { Lea } from '../assistant/Lea';
import { Typed } from '../assistant/AssistantPanels';
import { avatar, useAvatar } from '../assistant/controller';
import { courseHoverProps } from '../assistant/guideState';
import { AskChips, registerRail, openCoach } from '../assistant/LeaDock';
import { pageLine } from '../assistant/pageLines';
import { ProgressBar, Ring, CourseCover, cx, Seg, Segments, Medal, Button, MedalTone } from '../components/ui';
import { Icon, Flag, IconName } from '../components/icons';
import { PathTrack, WeekBars, DayBar, Check } from '../components/charts';
import { minutesLabel, addDays, dayKey, relative } from '../lib/dates';
import { moduleShort } from '../data/labels';
import type { LearnerState, Lesson, Route } from '../types';
import type { Period } from '../state/insights';

export const KIND_ICON: Record<Lesson['kind'], IconName> = { audio: 'headphones', video: 'video', reading: 'text', practice: 'pencil', assessment: 'medal' };
const DAYS_LONG = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const WEEK_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Badge colours on medals. */
export const BADGE_TONE: Record<string, MedalTone> = { first: 'blue', ten: 'mint', module: 'blue', streak3: 'flame', perfect: 'gold', assessor: 'mint', polyglot: 'blue', listener: 'violet', quarter: 'gold', curious: 'gold', streak7: 'coral', marathon: 'gold' };

function useHome(s: LearnerState) {
  return useMemo(() => {
    const course = getCourse(s.currentCourseId)!;
    const st = courseStats(s, course);
    const rec = recommendation(s);
    const next = st.next && isPlayable(st.next) ? st.next : rec?.course.id === course.id ? rec.lesson : st.next;
    return { course, st, rec, next, sk: streak(s), comp: competencies(s, course.id), today: todayMinutes(s) };
  }, [s]);
}

function openLesson(l?: Lesson) { avatar.interacted = true; if (l && isPlayable(l)) navigate({ page: 'lesson', lessonId: l.id }); }

export function Dashboard({ mobile }: { mobile: boolean }) {
  const s = useLearner();
  return mobile ? <MobileHome s={s} /> : <DesktopHome s={s} />;
}

// ------------------------------------------------------------------ desktop
function DesktopHome({ s }: { s: LearnerState }) {
  const d = useHome(s);
  const [period, setPeriod] = useState<Period>('day');
  const now = new Date();
  const goal = s.profile.dailyGoalMin;
  const dateLine = `${cap(DAYS_LONG[now.getDay()])} ${now.getDate()} ${MONTHS_LONG[now.getMonth()]} · ${d.today >= goal ? 'ton objectif du jour est atteint' : d.today > 0 ? `encore ${goal - d.today} min pour ton objectif du jour` : `ton objectif du jour : ${goal} minutes`}`;
  return (
    <div className="page home">
      <header className="page-head">
        <div>
          <h1>Bonjour, {s.profile.firstName} <span className="wave" aria-hidden="true">👋</span></h1>
          <p className="lead">{dateLine}</p>
        </div>
        <Seg label="Période des statistiques" value={period} onChange={setPeriod} options={[{ id: 'day', label: 'Aujourd’hui' }, { id: 'week', label: 'Cette semaine' }, { id: 'month', label: 'Ce mois' }]} />
      </header>
      <Hero d={d} s={s} />
      <Tiles d={d} s={s} period={period} />
      <div className="grid home-grid">
        <TimeCard s={s} period={period} />
        <NextCard d={d} s={s} />
        <OtherCourses s={s} current={d.course.id} />
        <RecentBadges s={s} />
      </div>
    </div>
  );
}

function Hero({ d, s }: { d: ReturnType<typeof useHome>; s: LearnerState }) {
  const { course, st, next } = d;
  const mod = next ? course.modules.find((m) => m.id === next.moduleId) : st.module;
  const curIdx = course.modules.findIndex((m) => m.id === mod?.id);
  const ms = mod ? moduleStats(s, mod) : null;
  const nodes = course.modules.map((m, i) => {
    const x = moduleStats(s, m);
    return { label: moduleShort(m), state: x.complete ? 'done' as const : i === curIdx ? 'current' as const : 'todo' as const, pct: Math.round((x.done / x.total) * 100) };
  });
  return (
    <section className="hero" aria-labelledby="hero-title">
      {course.cover.kind === 'photo' && <img className="hero-photo" src={course.cover.src} alt="" style={{ objectPosition: course.cover.position }} />}
      <span className="hero-shade" aria-hidden="true" />
      <div className="hero-main">
        <div className="hero-kicker">{course.flag && <Flag code={course.flag} size={28} />}<span>Parcours actuel</span></div>
        <h2 id="hero-title">{course.title}</h2>
        {next ? (
          <button type="button" className="hero-next" onClick={() => openLesson(next)} disabled={!isPlayable(next)} {...courseHoverProps(course.id, s)}>
            <span className="hero-next-ic"><Icon name={KIND_ICON[next.kind]} size={20} /></span>
            <span className="hero-next-body">
              <small>Prochaine leçon du module {mod?.index}</small>
              <strong>{next.title}</strong>
              <span>{KIND_LABEL[next.kind]} · {next.minutes} min{next.questions ? ` · ${next.questions.length} questions` : ''}{s.attempts[next.id] ? ' · en cours' : ''}</span>
            </span>
            <Icon name="chevronRight" size={18} className="hero-next-chev" />
          </button>
        ) : <p className="hero-done">Tu as terminé toutes les leçons de ce parcours. Bravo !</p>}
        <div className="hero-ctas">
          <Button variant="white" go onClick={() => (next && isPlayable(next) ? openLesson(next) : navigate({ page: 'course', courseId: course.id }))}>{next && s.attempts[next.id] ? 'Reprendre la leçon' : 'Continuer la leçon'}</Button>
          <button type="button" className="hero-link" onClick={() => navigate({ page: 'course', courseId: course.id })}>Voir tout le parcours</button>
        </div>
      </div>
      <div className="hero-side">
        <div className="hero-pct"><strong className="num">{st.pct}<small> %</small></strong><span>{st.done} leçons sur {st.total} terminées</span></div>
        <ProgressBar value={st.pct} tone="light" size="sm" label={`Progression du parcours : ${st.pct} %`} />
        <PathTrack nodes={nodes} dark beads={ms ? ms.total : 0} beadsDone={ms ? ms.done : 0} />
      </div>
    </section>
  );
}

const PERIOD_WORD: Record<Period, string> = { day: 'aujourd’hui', week: 'cette semaine', month: 'ce mois-ci', all: 'au total' };

function Tiles({ d, s, period }: { d: ReturnType<typeof useHome>; s: LearnerState; period: Period }) {
  const now = new Date();
  const goal = s.profile.dailyGoalMin;
  const since = periodStart(period, now);
  const days = Math.round((addDays(now, 1).getTime() - since.getTime()) / 86400000);
  const target = period === 'day' ? goal : goal * Math.max(1, Math.min(days, period === 'week' ? 7 : 31));
  const minutes = period === 'day' ? d.today : periodMinutes(s, period, now);
  const pctGoal = Math.min(100, Math.round((minutes / target) * 100));
  const lessons = lessonsDone(s, since, d.course.id);
  const comps = competenciesSince(s, d.course.id, since);
  const monday = periodStart('week', now);
  const week = Array.from({ length: 7 }, (_, i) => { const day = addDays(monday, i); return { on: (s.activity[dayKey(day)] ?? 0) > 0, today: dayKey(day) === dayKey(now), future: day > now }; });
  const best = bestStreak(s);
  const goalLabel = period === 'day' ? 'Objectif du jour' : period === 'week' ? 'Objectif de la semaine' : 'Objectif du mois';
  return (
    <section className="tiles" aria-label="Statistiques">
      <article className="card tile">
        <div className="tile-top"><span className="tile-ic is-mint"><Icon name="target" size={18} /></span><span className="tile-label">{goalLabel}</span></div>
        <div className="tile-row">
          <div><strong className="tile-value num">{period === 'day' ? minutes : minutesLabel(minutes)}</strong><span className="tile-of">/ {period === 'day' ? `${goal} min` : minutesLabel(target)}</span></div>
          <Ring value={pctGoal} size={52} stroke={6} color="var(--mint)" track="var(--mint-50)" label={`${pctGoal} % de l’objectif`}><Icon name={pctGoal >= 100 ? 'check' : 'target'} size={18} /></Ring>
        </div>
        <span className={cx('tile-sub', pctGoal >= 100 && 'is-good')}>{pctGoal >= 100 ? 'Objectif atteint' : `Encore ${minutesLabel(target - minutes)}`}</span>
      </article>
      <article className="card tile">
        <div className="tile-top"><span className="tile-ic is-flame"><Icon name="flameSolid" size={18} /></span><span className="tile-label">Série</span></div>
        <div className="tile-row">
          <div><strong className="tile-value num">{d.sk.days}</strong><span className="tile-of">jour{d.sk.days > 1 ? 's' : ''}</span></div>
          <ol className="flames" aria-label="Jours actifs cette semaine">
            {week.map((w, i) => <li key={i} className={cx(w.on && 'on', w.today && 'today', w.future && 'future')} aria-label={`${WEEK_LETTERS[i]} : ${w.on ? 'actif' : w.future ? 'à venir' : 'repos'}`}><Icon name="flameSolid" size={14} /><span>{WEEK_LETTERS[i]}</span></li>)}
          </ol>
        </div>
        <span className="tile-sub">{d.sk.todayActive ? '+1 aujourd’hui' : 'Apprends aujourd’hui pour la prolonger'}{best ? ` · record ${best.days} jours` : ''}</span>
      </article>
      <article className="card tile">
        <div className="tile-top"><span className="tile-ic is-blue"><Icon name="checkCircle" size={18} /></span><span className="tile-label">Leçons terminées</span></div>
        <div className="tile-row">
          <div><strong className="tile-value num">{d.st.done}</strong><span className="tile-of">sur {d.st.total}</span></div>
          <Ring value={d.st.pct} size={52} stroke={6} label={`${d.st.pct} % du parcours`}><small className="num">{d.st.pct}%</small></Ring>
        </div>
        <span className={cx('tile-sub', lessons > 0 && 'is-good')}>{lessons > 0 ? `+${lessons} ${PERIOD_WORD[period]}` : `aucune ${PERIOD_WORD[period]}`}</span>
      </article>
      <article className="card tile">
        <div className="tile-top"><span className="tile-ic is-violet"><Icon name="star" size={18} /></span><span className="tile-label">Compétences</span></div>
        <div className="tile-row">
          <div><strong className="tile-value num">{d.comp.acquired}</strong><span className="tile-of">sur {d.comp.total}</span></div>
        </div>
        <Segments values={d.comp.list.map((c) => (c.acquired ? 1 : c.done / c.lessonIds.length))} label={`${d.comp.acquired} compétences acquises sur ${d.comp.total}`} className="tile-segs" />
        <span className={cx('tile-sub', comps > 0 && 'is-good')}>{comps > 0 ? `+${comps} ${PERIOD_WORD[period]}` : `rien de nouveau ${PERIOD_WORD[period]}`}</span>
      </article>
    </section>
  );
}

const SHORT_DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
function TimeCard({ s, period }: { s: LearnerState; period: Period }) {
  const now = new Date();
  const goal = s.profile.dailyGoalMin;
  const month = period === 'month';
  const start = month ? periodStart('month', now) : periodStart('week', now);
  const count = month ? new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() : 7;
  const days: DayBar[] = Array.from({ length: count }, (_, i) => {
    const day = addDays(start, i); const future = day > now && dayKey(day) !== dayKey(now);
    return { short: month ? (i % 5 === 0 || i === count - 1 ? String(day.getDate()) : '') : dayKey(day) === dayKey(now) ? 'Auj.' : SHORT_DAYS[day.getDay()], long: `${DAYS_LONG[day.getDay()]} ${day.getDate()} ${MONTHS_LONG[day.getMonth()]}`, minutes: future ? null : Math.round(s.activity[dayKey(day)] ?? 0), today: dayKey(day) === dayKey(now) };
  });
  const total = days.reduce((a, x) => a + (x.minutes ?? 0), 0);
  const reached = days.filter((x) => (x.minutes ?? 0) >= goal).length;
  const elapsed = days.filter((x) => x.minutes !== null).length;
  return (
    <article className="card c7 time-card" aria-labelledby="time-title">
      <div className="card-head">
        <div><h2 id="time-title">Ton temps d’apprentissage</h2><p className="muted">{month ? 'Ce mois-ci' : 'Cette semaine'} · objectif atteint {reached} jour{reached > 1 ? 's' : ''} sur {elapsed}</p></div>
        <strong className="time-total num">{minutesLabel(total)}</strong>
      </div>
      <WeekBars days={days} goal={goal} caption={`Minutes d’apprentissage par jour, ${month ? 'ce mois-ci' : 'cette semaine'}`} height={month ? 180 : 196} />
    </article>
  );
}

function NextCard({ d, s }: { d: ReturnType<typeof useHome>; s: LearnerState }) {
  const lessons = courseLessons(d.course);
  const start = Math.max(0, lessons.findIndex((l) => l.id === d.st.next?.id));
  const upcoming = d.st.next ? lessons.slice(start, start + 4) : [];
  return (
    <article className="card c5 next-card" aria-labelledby="next-title">
      <div className="card-head"><h2 id="next-title">À suivre dans ton parcours</h2><button type="button" className="link" onClick={() => navigate({ page: 'course', courseId: d.course.id })}>Programme<Icon name="arrowRight" size={14} /></button></div>
      {upcoming.length === 0 ? <p className="muted">Tu as terminé toutes les leçons de ce parcours. Bravo !</p> : (
        <ol className="next-list">
          {upcoming.map((l, i) => {
            const playable = isPlayable(l);
            const m = d.course.modules.find((x) => x.id === l.moduleId)!;
            return (
              <li key={l.id} className={cx(i === 0 && 'is-first')}>
                <span className={cx('next-ic', `k-${l.kind}`)}><Icon name={KIND_ICON[l.kind]} size={17} /></span>
                <span className="next-body"><strong>{l.title}</strong><small>Module {m.index} · {KIND_LABEL[l.kind]} · {l.minutes} min{s.attempts[l.id] ? ' · en cours' : ''}</small></span>
                {playable
                  ? i === 0 ? <Button size="sm" onClick={() => openLesson(l)} aria-label={`${s.attempts[l.id] ? 'Reprendre' : 'Commencer'} : ${l.title}`}>{s.attempts[l.id] ? 'Reprendre' : 'Commencer'}</Button>
                    : <button type="button" className="round-play" onClick={() => openLesson(l)} aria-label={`Ouvrir : ${l.title}`}><Icon name="play" size={12} /></button>
                  : <span className="soon"><Icon name="lock" size={13} />Bientôt</span>}
              </li>
            );
          })}
        </ol>
      )}
    </article>
  );
}

function OtherCourses({ s, current }: { s: LearnerState; current: string }) {
  const others = COURSES.filter((c) => c.id !== current && s.enrollments[c.id] && !s.enrollments[c.id].paused)
    .sort((a, b) => (s.enrollments[b.id].lastActiveAt > s.enrollments[a.id].lastActiveAt ? 1 : -1)).slice(0, 3);
  return (
    <section className="card c8 others-card" aria-labelledby="others-title">
      <div className="card-head"><h2 id="others-title">Tes autres cours</h2><button type="button" className="link" onClick={() => navigate({ page: 'courses' })}>Mes cours<Icon name="arrowRight" size={14} /></button></div>
      {others.length === 0 ? <p className="muted">Ajoute un deuxième cours depuis la bibliothèque pour le retrouver ici.</p> : (
        <div className="others">
          {others.map((c) => {
            const st = courseStats(s, c);
            return (
              <button key={c.id} type="button" className="other" onClick={() => navigate({ page: 'course', courseId: c.id })} {...courseHoverProps(c.id, s)}>
                <CourseCover course={c} className="other-cover" flagSize={26} />
                <span className="other-body">
                  <strong>{c.title}</strong>
                  <span className="other-meta"><ProgressBar value={st.pct} size="sm" label={`${c.title} : ${st.pct} %`} /><b className="num">{st.pct} %</b></span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function RecentBadges({ s }: { s: LearnerState }) {
  const earned = ACHIEVEMENTS.filter((a) => s.achievements[a.id]).sort((a, b) => (s.achievements[b.id] > s.achievements[a.id] ? 1 : -1));
  const next = ACHIEVEMENTS.filter((a) => !s.achievements[a.id]).map((a) => ({ a, p: a.progress(s) })).sort((x, y) => y.p.cur / y.p.target - x.p.cur / x.p.target)[0];
  return (
    <section className="card c4 badges-card" aria-labelledby="badges-title">
      <div className="card-head"><h2 id="badges-title">Badges récents</h2><span className="pill pill-gold">{earned.length} / {ACHIEVEMENTS.length}</span></div>
      <ul className="badge-row">
        {earned.slice(0, 3).map((a) => <li key={a.id}><Medal icon={a.icon} tone={BADGE_TONE[a.id]} size={46} /><strong>{a.title}</strong><small>{relative(s.achievements[a.id])}</small></li>)}
      </ul>
      {next && (
        <button type="button" className="badge-next" onClick={() => navigate({ page: 'badges' })}>
          <span>Prochain : <b>{next.a.title}</b></span><span className="num">{Math.min(next.p.cur, next.p.target)} / {next.p.target}</span>
          <ProgressBar value={Math.min(100, (next.p.cur / next.p.target) * 100)} size="sm" tone="gold" label={`${next.a.title} : ${Math.min(next.p.cur, next.p.target)} sur ${next.p.target}`} />
        </button>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ Léa's panel on the dashboard
/** Today's plan: lessons finished today, then what is next to reach the goal. */
export function todayPlan(s: LearnerState) {
  const now = new Date(); const k = dayKey(now);
  const course = getCourse(s.currentCourseId)!;
  const doneToday = Object.entries(s.completions).filter(([, c]) => c.passed && dayKey(new Date(c.at)) === k).sort((a, b) => (a[1].at < b[1].at ? -1 : 1))
    .map(([id]) => courseLessons(course).find((l) => l.id === id) ?? PRACTICE_LESSONS.find((l) => l.id === id)).filter(Boolean) as Lesson[];
  const todo = courseLessons(course).filter((l) => !s.completions[l.id]?.passed && isPlayable(l));
  const items: { lesson: Lesson; done: boolean }[] = [...doneToday.slice(-2).map((l) => ({ lesson: l, done: true }))];
  for (const l of todo) { if (items.filter((x) => !x.done).length >= 1) break; items.push({ lesson: l, done: false }); }
  const review = PRACTICE_LESSONS[0];
  if (!s.completions[review.id]?.passed || dayKey(new Date(s.completions[review.id].at)) === k) items.push({ lesson: review, done: dayKey(new Date(s.completions[review.id]?.at ?? 0)) === k });
  else if (todo[1]) items.push({ lesson: todo[1], done: false });
  return items.slice(0, 4);
}

export function PlanList({ s }: { s: LearnerState }) {
  const items = todayPlan(s);
  const done = items.filter((x) => x.done).length;
  const firstTodo = items.findIndex((x) => !x.done);
  return (
    <section className="rail-sec" aria-labelledby="plan-title">
      <div className="rail-sec-head"><h3 id="plan-title">Ton plan pour aujourd’hui</h3><span className="muted num">{done} sur {items.length}</span></div>
      <ol className="todo">
        {items.map((x, i) => (
          <li key={x.lesson.id} className={cx(x.done && 'done', i === firstTodo && 'next')}>
            <button type="button" onClick={() => openLesson(x.lesson)} disabled={!isPlayable(x.lesson)}>
              <Check on={x.done} />
              <span className="todo-body"><strong>{x.lesson.title}</strong><small>{KIND_LABEL[x.lesson.kind]} · {x.lesson.minutes} min</small></span>
              {i === firstTodo && <Icon name="arrowRight" size={16} className="todo-go" />}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** A word to remember from the current course (changes every day). */
export function wordOfDay(s: LearnerState, now = new Date()) {
  const course = getCourse(s.currentCourseId)!;
  const pool = courseLessons(course).concat(PRACTICE_LESSONS.filter((l) => l.courseId === course.id)).flatMap((l) => (l.content?.vocab ?? []).map((v) => ({ ...v, lesson: l })));
  if (!pool.length) return null;
  const day = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86400000);
  return pool[day % pool.length];
}

function WordCard({ s }: { s: LearnerState }) {
  const w = wordOfDay(s);
  if (!w) return null;
  return (
    <section className="wotd" aria-labelledby="wotd-title">
      <div className="wotd-top"><h3 id="wotd-title">Le mot du jour</h3><span className="pill pill-blue">{getCourse(s.currentCourseId)!.shortTitle}</span></div>
      <p className="wotd-term" lang="en">{w.term}</p>
      <p className="wotd-fr">{w.fr}</p>
      {w.ex && <p className="wotd-ex" lang="en">« {w.ex} »</p>}
      <button type="button" className="link" onClick={() => openCoach(`Un exercice avec « ${w.term} »`)}>M’entraîner avec ce mot<Icon name="arrowRight" size={14} /></button>
    </section>
  );
}

function HomeRail(_: { route: Route }) {
  const s = useLearner();
  return (
    <>
      <PlanList s={s} />
      <WordCard s={s} />
      <AskChips items={['Planifier ma semaine', 'Un exercice rapide', 'Où en suis-je ?']} icons={['calendar', 'pencil', 'progress']} />
    </>
  );
}
registerRail('home', HomeRail);

// ------------------------------------------------------------------ phone
function MobileHome({ s }: { s: LearnerState }) {
  const d = useHome(s);
  const v = useAvatar();
  const line = pageLine({ page: 'home' }, s);
  const goal = s.profile.dailyGoalMin;
  const monday = periodStart('week', new Date());
  const items = todayPlan(s);
  return (
    <div className="page home-m">
      <section className="m-lea card" aria-label="Léa">
        <span className="m-lea-face"><Lea framing="face" decorative /></span>
        <div className="m-lea-body">
          <strong>Léa</strong>
          <p>{v.bubble && !v.bubble.id.startsWith('page:') ? <Typed text={v.bubble.text} at={v.bubble.at} /> : <Typed text={line.text.replace(/\*\*/g, '')} at={0} />}</p>
        </div>
      </section>
      <section className="m-hero" aria-labelledby="m-hero-title">
        {d.course.cover.kind === 'photo' && <img className="hero-photo" src={d.course.cover.src} alt="" />}
        <span className="hero-shade" aria-hidden="true" />
        <div className="m-hero-in">
          <div className="hero-kicker">{d.course.flag && <Flag code={d.course.flag} size={30} />}<span><small>Parcours actuel</small><strong id="m-hero-title">{d.course.title.replace(' – Niveau ', ' – ').replace('intermédiaire', 'Intermédiaire').replace('débutant', 'Débutant').replace('avancé', 'Avancé')}</strong></span></div>
          {d.next && (
            <button type="button" className="hero-next" onClick={() => openLesson(d.next)}>
              <span className="hero-next-ic"><Icon name={KIND_ICON[d.next.kind]} size={18} /></span>
              <span className="hero-next-body"><small>Prochaine leçon, {d.next.minutes} min</small><strong>{d.next.title}</strong></span>
            </button>
          )}
          <div className="m-hero-pct"><strong className="num">{d.st.pct} %</strong><span>{d.st.done} leçons sur {d.st.total}</span></div>
          <ProgressBar value={d.st.pct} tone="light" size="sm" label={`Progression : ${d.st.pct} %`} />
          <Button variant="white" go block onClick={() => (d.next && isPlayable(d.next) ? openLesson(d.next) : navigate({ page: 'course', courseId: d.course.id }))}>Continuer la leçon</Button>
        </div>
      </section>
      <div className="m-tiles">
        <article className="card tile">
          <div className="tile-top"><span className="tile-ic is-mint"><Icon name="target" size={16} /></span><span className="tile-label">Objectif</span></div>
          <div className="tile-row"><div><strong className="tile-value num">{d.today}</strong><span className="tile-of">/ {goal} min</span></div><Ring value={Math.min(100, (d.today / goal) * 100)} size={42} stroke={5} color="var(--mint)" track="var(--mint-50)" label="Objectif du jour" ><span /></Ring></div>
        </article>
        <article className="card tile">
          <div className="tile-top"><span className="tile-ic is-flame"><Icon name="flameSolid" size={16} /></span><span className="tile-label">Série</span></div>
          <div className="tile-row"><div><strong className="tile-value num">{d.sk.days}</strong><span className="tile-of">jours</span></div>
            <span className="m-flames" aria-hidden="true">{Array.from({ length: 7 }, (_, i) => <i key={i} className={cx((s.activity[dayKey(addDays(monday, i))] ?? 0) > 0 && 'on')} />)}</span></div>
        </article>
      </div>
      <section className="m-plan" aria-labelledby="m-plan-title">
        <div className="sec-head"><h2 id="m-plan-title">Ton plan pour aujourd’hui</h2><span className="sec-link">{items.filter((x) => x.done).length} sur {items.length}</span></div>
        <ol className="todo">
          {items.map((x) => (
            <li key={x.lesson.id} className={cx(x.done && 'done')}>
              <button type="button" onClick={() => openLesson(x.lesson)} disabled={!isPlayable(x.lesson)}>
                <Check on={x.done} /><span className="todo-body"><strong>{x.lesson.title}</strong><small>{KIND_LABEL[x.lesson.kind]}</small></span><span className="todo-min">{x.lesson.minutes} min</span>
              </button>
            </li>
          ))}
        </ol>
      </section>
      <OtherCourses s={s} current={d.course.id} />
    </div>
  );
}
