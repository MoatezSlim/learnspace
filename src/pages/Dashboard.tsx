import React, { useEffect, useMemo, useState } from 'react';
import { useLearner } from '../state/store';
import { courseStats, recommendation, streak, todayMinutes, competencies, lessonsCompletedOn, dailySeries, rangeMinutes } from '../state/selectors';
import { getCourse, KIND_LABEL, COURSES, courseLessons, isPlayable, LEVEL_LABEL } from '../data/courses';
import { ACHIEVEMENTS } from '../state/achievements';
import { navigate } from '../router';
import { Lea } from '../assistant/Lea';
import { Typed, openAssistant } from '../assistant/AssistantPanels';
import { react, ask } from '../assistant/assistant';
import { avatar, useAvatar } from '../assistant/controller';
import { LINES } from '../assistant/lines';
import { courseHoverProps } from '../assistant/guideState';
import { ProgressBar, Ring, CourseCover, cx } from '../components/ui';
import { Icon, Flag, IconName } from '../components/icons';
import { minutesLabel, weekday, shortDate, relative, dayKey } from '../lib/dates';
import type { LearnerState, Lesson } from '../types';

let greeted = false;

function useDashboardData(s: LearnerState) {
  return useMemo(() => {
    const course = getCourse(s.currentCourseId)!;
    const st = courseStats(s, course);
    const rec = recommendation(s);
    const sk = streak(s);
    const comp = competencies(s, course.id);
    const today = todayMinutes(s);
    const doneToday = lessonsCompletedOn(s, 0, course.id);
    return { course, st, rec, sk, comp, today, doneToday };
  }, [s]);
}
type Data = ReturnType<typeof useDashboardData>;

function openNext(d: Data) {
  avatar.interacted = true;
  if (d.rec) navigate({ page: 'lesson', lessonId: d.rec.lesson.id }); else navigate({ page: 'course', courseId: d.course.id });
}

export function Dashboard({ mobile }: { mobile: boolean }) {
  const s = useLearner();
  const d = useDashboardData(s);
  useEffect(() => {
    if (greeted) return;
    greeted = true;
    const t = window.setTimeout(() => void react.greet(), 650);
    return () => window.clearTimeout(t);
  }, []);
  return <DashboardView d={d} s={s} mobile={mobile} />;
}

// ------------------------------------------------------------------ icons drawn to match the reference
const Stopwatch = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="13.5" r="7.5" /><path d="M12 9.5v4.2l2.4 1.6M10 2.8h4M12 2.8V6M18.6 6.4l1.3-1.3M5.4 6.4 4.1 5.1" />
  </svg>
);
const Shield = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2.6 4.6 5.4v5.7c0 4.7 3.1 8.6 7.4 10.1 4.3-1.5 7.4-5.4 7.4-10.1V5.4Z" fill="#1FA56F" />
    <path d="m8.4 12.1 2.6 2.6 4.8-5.1" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Flame = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <defs><linearGradient id="d2-flame" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFB23E" /><stop offset="1" stopColor="#F0441B" /></linearGradient></defs>
    <path d="M12.2 21.6c-4 0-6.7-2.7-6.7-6.4 0-3.3 2.1-5 3.5-7.6.4 1.8 1.4 2.9 2.4 3.4.2-3.6 1.8-6.1 4.2-7.6-.4 2.7.9 4.6 2 6.1 1 1.4 1.9 2.9 1.9 5.2 0 3.9-3.2 6.9-7.3 6.9Z" fill="url(#d2-flame)" />
    <path d="M12.3 20.2c-1.9 0-3.2-1.3-3.2-3.1 0-1.7 1.1-2.6 1.8-3.9.3 1 .8 1.5 1.3 1.8.1-1.8.9-3 2.1-3.8-.2 1.4.5 2.3 1 3.1.5.7.9 1.5.9 2.6 0 1.9-1.6 3.3-3.9 3.3Z" fill="#FFD25A" opacity=".9" />
  </svg>
);
const Star = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.9 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.2l-5.6 2.9 1.1-6.2L3 9.5l6.2-.9Z" fill="#6E7FF6" stroke="#6E7FF6" strokeWidth="1.2" strokeLinejoin="round" /></svg>
);
const Bulb = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true">
    <defs><radialGradient id="d2-glow" cx="50%" cy="42%" r="55%"><stop offset="0" stopColor="#FFE58A" stopOpacity=".95" /><stop offset="1" stopColor="#FFE58A" stopOpacity="0" /></radialGradient>
      <linearGradient id="d2-bulb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFE07A" /><stop offset="1" stopColor="#F5A623" /></linearGradient></defs>
    <circle cx="16" cy="13" r="14" fill="url(#d2-glow)" />
    <path d="M16 4.5a7.5 7.5 0 0 0-4.4 13.6c.8.6 1.2 1.4 1.2 2.3v.9h6.4v-.9c0-.9.4-1.7 1.2-2.3A7.5 7.5 0 0 0 16 4.5Z" fill="url(#d2-bulb)" />
    <rect x="12.7" y="22.2" width="6.6" height="2.2" rx="1" fill="#7B6A58" /><rect x="13.2" y="25" width="5.6" height="2.1" rx="1" fill="#6A5A4A" />
    <path d="M14 13.5l2 3 2-3" fill="none" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity=".85" />
  </svg>
);
const Chip = ({ kind }: { kind: 'doc' | 'basket' | 'clip' | 'star' }) => (
  <span className="d2-chip" aria-hidden="true">
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {kind === 'doc' && <><path d="M4 2.5h5l3 3v8H4Z" /><path d="M9 2.5v3h3M8 12V8M6.4 9.6 8 8l1.6 1.6" /></>}
      {kind === 'basket' && <><path d="M2.5 6.5h11l-1.2 6.5H3.7Z" /><path d="m5.5 6.5 2-4M10.5 6.5l-2-4M6 9v2M8 9v2M10 9v2" /></>}
      {kind === 'clip' && <><rect x="3.5" y="3" width="9" height="11" rx="1.5" /><path d="M6 3V2h4v1M6 7h4M6 9.5h4M6 12h2.5" /></>}
      {kind === 'star' && <path d="m8 2.2 1.7 3.5 3.8.5-2.8 2.7.7 3.8L8 10.9l-3.4 1.8.7-3.8-2.8-2.7 3.8-.5Z" />}
    </svg>
  </span>
);

/** Soft leaves around Léa, as in the reference (coordinates in reference pixels, x offset 301). */
function Leaves() {
  const leaf = (bx: number, by: number, tx: number, ty: number, w: number, fill: string, op: number, key: string) => {
    const len = Math.hypot(tx - bx, ty - by); const ang = (Math.atan2(ty - by, tx - bx) * 180) / Math.PI;
    return (
      <g key={key} transform={`translate(${bx - 301} ${by}) rotate(${ang.toFixed(1)})`} opacity={op}>
        <path d={`M0 0 C ${len * 0.25} ${-w} ${len * 0.7} ${-w * 0.9} ${len} 0 C ${len * 0.7} ${w * 0.9} ${len * 0.25} ${w} 0 0 Z`} fill={fill} />
        <path d={`M${len * 0.03} 0 Q ${len * 0.5} ${-w * 0.08} ${len * 0.94} 0`} fill="none" stroke="#FFFFFF" strokeOpacity=".6" strokeWidth=".9" />
        {[0.28, 0.45, 0.62, 0.78].map((t) => <path key={t} d={`M${len * t} 0 q ${len * 0.06} ${-w * 0.35} ${len * 0.13} ${-w * 0.62} M${len * t} 0 q ${len * 0.06} ${w * 0.35} ${len * 0.13} ${w * 0.62}`} fill="none" stroke="#FFFFFF" strokeOpacity=".38" strokeWidth=".7" />)}
      </g>
    );
  };
  return (
    <svg className="d2-leaves" viewBox="0 0 560 166" aria-hidden="true" focusable="false">
      <defs><radialGradient id="d2-halo" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#E4EEFC" /><stop offset="1" stopColor="#E4EEFC" stopOpacity="0" /></radialGradient></defs>
      <ellipse cx="370" cy="96" rx="230" ry="96" fill="url(#d2-halo)" />
      <ellipse cx="160" cy="120" rx="170" ry="60" fill="url(#d2-halo)" opacity=".7" />
      {leaf(420, 168, 336, 108, 17, '#D9E7FA', 0.75, 'a')}
      {leaf(470, 170, 452, 92, 15, '#E1ECFB', 0.7, 'b')}
      {leaf(604, 170, 560, 66, 22, '#C9DCF6', 0.85, 'c')}
      {leaf(640, 170, 612, 92, 17, '#D3E3F8', 0.8, 'd')}
      {leaf(752, 170, 842, 52, 25, '#C2D8F6', 0.75, 'e')}
      {leaf(800, 168, 861, 96, 20, '#CCDDF6', 0.75, 'f')}
      {leaf(735, 160, 790, 98, 13, '#D2E2F8', 0.75, 'g')}
      {leaf(700, 58, 776, 22, 12, '#E2ECFA', 0.6, 'h')}
    </svg>
  );
}

function DashboardView({ d, s, mobile }: { d: Data; s: LearnerState; mobile: boolean }) {
  const { course, st, rec, sk, comp, today, doneToday } = d;
  const v = useAvatar();
  const goal = s.profile.dailyGoalMin;
  const custom = v.bubble && v.bubble.text !== LINES.dashIntro ? v.bubble : null;
  return (
    <div className={cx('d2', mobile && 'd2-mobile')}>
      <section className="d2-hero" aria-label="Bienvenue">
        <Leaves />
        <div className="d2-greet">
          <h1>Bonjour, {s.profile.firstName} <span className="d2-wave" aria-hidden="true">👋</span></h1>
          <p>Chaque étape compte. Tu es sur la bonne voie !</p>
        </div>
        <div className={`d2-bubble${v.status === 'speaking' ? ' is-speaking' : ''}`} aria-live="polite">
          {v.status === 'thinking' ? <span className="typing" aria-label="Léa réfléchit"><i /><i /><i /></span>
            : custom ? <p key={custom.id} className="bubble-text"><Typed text={custom.text} at={custom.at} /></p>
            : v.bubble ? <p key={v.bubble.id} className="bubble-text"><Typed text={v.bubble.text} at={v.bubble.at} bold={LINES.dashIntro.indexOf('!') + 1} /></p>
            : <p className="bubble-text"><strong>Tu progresses vraiment bien !</strong><br />Il te suffit parfois de 10-15 min par jour pour atteindre tes objectifs de formation. <span aria-hidden="true">💙</span></p>}
        </div>
        <div className="d2-lea">
          <Lea framing="hero" />
        </div>
      </section>

      <section className="d2-row1">
        <article className="d2-path" aria-labelledby="d2-path-title">
          <span className="d2-flag"><Flag code={course.flag ?? 'gb'} size={36} /></span>
          <div className="d2-path-body">
            <span className="d2-path-eyebrow">Parcours actuel</span>
            <h2 id="d2-path-title">{course.title}</h2>
            <div className="d2-path-progress">
              <ProgressBar value={st.pct} tone="light" label={`Progression du parcours : ${st.pct} %`} className="d2-path-bar" />
              <strong>{st.pct}%</strong>
            </div>
            <span className="d2-path-module">Module {st.module?.index} · {st.module?.title}</span>
          </div>
          <button type="button" className="d2-cta" onClick={() => openNext(d)}>Continuer la leçon <Icon name="arrowRight" size={14} /></button>
        </article>
        <article className="d2-card d2-goal">
          <span className="d2-goal-icon"><Stopwatch /></span>
          <div className="d2-goal-body">
            <span className="d2-label">Objectif du jour</span>
            <strong className="d2-goal-value">{today} min</strong>
            <span className="d2-goal-of">/ {goal} min</span>
          </div>
          <button type="button" className="d2-link d2-goal-link" onClick={() => navigate({ page: 'progress' })}>Voir les détails <Icon name="arrowRight" size={12} /></button>
        </article>
      </section>

      <section className="d2-stats" aria-label="Statistiques">
        <article className="d2-card d2-stat">
          <Ring value={st.pct} size={44} stroke={6} track="#DCE7F6" color="#1E7EF2" label={`Progression globale : ${st.pct} %`}><strong className="d2-ring-label">{st.pct}%</strong></Ring>
          <div className="d2-stat-body"><span className="d2-label">Progression globale</span><span className="d2-stat-plain">{st.done} / {st.total} leçons</span></div>
          <button type="button" className="d2-chip-btn" aria-label="Voir ma progression" onClick={() => navigate({ page: 'progress' })}><Chip kind="doc" /></button>
        </article>
        <article className="d2-card d2-stat">
          <span className="d2-stat-icon is-green"><Shield /></span>
          <div className="d2-stat-body"><span className="d2-label">Leçons terminées</span><strong className="d2-stat-value">{st.done} / {st.total}</strong><span className="d2-stat-sub">{doneToday ? `+${doneToday} aujourd’hui` : 'aucune aujourd’hui'}</span></div>
          <span className="d2-x" aria-hidden="true">×</span>
          <button type="button" className="d2-chip-btn" aria-label="Voir mes cours" onClick={() => navigate({ page: 'courses' })}><Chip kind="basket" /></button>
        </article>
        <article className="d2-card d2-stat">
          <span className="d2-stat-icon is-orange"><Flame /></span>
          <div className="d2-stat-body"><span className="d2-label">Série actuelle</span><strong className="d2-stat-value">{sk.days} jour{sk.days > 1 ? 's' : ''}</strong><span className="d2-stat-sub is-green">{sk.todayActive ? '+1 aujourd’hui' : 'à prolonger aujourd’hui'}</span></div>
          <span className="d2-x" aria-hidden="true">×</span>
          <button type="button" className="d2-chip-btn" aria-label="Voir l’historique" onClick={() => navigate({ page: 'progress' })}><Chip kind="clip" /></button>
        </article>
        <article className="d2-card d2-stat">
          <span className="d2-stat-icon is-violet"><Star /></span>
          <div className="d2-stat-body"><span className="d2-label">Compétences acquises</span><strong className="d2-stat-value">{comp.acquired} / {comp.total}</strong><span className="d2-stat-sub is-green">{comp.thisWeek ? `+${comp.thisWeek} cette semaine` : 'rien de nouveau cette semaine'}</span></div>
          <button type="button" className="d2-chip-btn" aria-label="Voir mes badges" onClick={() => navigate({ page: 'badges' })}><Chip kind="star" /></button>
        </article>
      </section>

      <section className="d2-row3">
        <div className="d2-current">
          <div className="d2-section-head">
            <h2>Ton parcours actuel</h2>
            <button type="button" className="d2-link" onClick={() => navigate({ page: 'courses' })}>Voir tous les cours <Icon name="arrowRight" size={12} /></button>
          </div>
          <button type="button" className="d2-card d2-course" onClick={() => navigate({ page: 'course', courseId: course.id })} {...courseHoverProps(course.id, s)}>
            <img className="d2-thumb" src="assets/media/course_en_hd.webp" alt="" />
            <span className="d2-course-body">
              <strong>{course.shortTitle}  –  {course.title.split('–')[1]?.trim() ?? course.title}</strong>
              <span className="d2-course-module">Module {st.module?.index} · {st.module?.title}</span>
              {rec && rec.course.id === course.id && <span className="d2-pill"><span className="d2-pill-dot" aria-hidden="true"><svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="6" fill="#2BA36F" /><path d="m3.6 6.2 1.6 1.6 3.2-3.4" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg></span>Prochaine leçon · {rec.lesson.minutes} min</span>}
            </span>
            <Icon name="chevronRight" size={16} className="d2-course-chev" />
          </button>
        </div>
        <aside className="d2-tip" aria-labelledby="d2-tip-title">
          <div className="d2-tip-head"><span className="d2-bulb"><Bulb /></span><h2 id="d2-tip-title">Conseil de ton assistant</h2></div>
          <p>Tu as bien progressé cette semaine !<br />Pourquoi ne pas revoir la leçon sur<br />le vocabulaire ?</p>
          <button type="button" className="d2-link" onClick={() => { openAssistant(true); void ask('Que me recommandes-tu ?'); }}>Voir les recommandations <Icon name="arrowRight" size={12} /></button>
        </aside>
      </section>
      <section className="d2-row4">
        <WeekCard s={s} />
        <NextLessons d={d} s={s} />
        <RecentBadges s={s} />
      </section>
      <OtherCourses s={s} current={course.id} />
    </div>
  );
}

// ------------------------------------------------------------------ added sections
const DAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

/** Minutes per day for the last seven days against the daily goal (one series, one hue). */
function WeekCard({ s }: { s: LearnerState }) {
  const days = dailySeries(s, 7);
  const goal = s.profile.dailyGoalMin;
  const total = days.reduce((a, d) => a + d.minutes, 0);
  // compared with the average of the four previous weeks (a single past week is too noisy)
  const prev = rangeMinutes(s, -34, -7) / 4;
  const delta = prev >= 20 ? Math.round(((total - prev) / prev) * 100) : null;
  const reached = days.filter((d) => d.minutes >= goal).length;
  const top = Math.max(goal * 2, ...days.map((d) => d.minutes));
  const max = Math.ceil(top / 10) * 10;
  const [hover, setHover] = useState<number | null>(null);
  const today = dayKey(new Date());
  return (
    <article className="d2-card d2-week" aria-labelledby="d2-week-title">
      <div className="d2-week-head">
        <div>
          <h2 id="d2-week-title" className="d2-label">Ton activité cette semaine</h2>
          <strong className="d2-week-total">{minutesLabel(total)}</strong>
        </div>
        <div className="d2-week-side">
          {delta !== null && <span className={cx('d2-week-delta', delta >= 0 ? 'is-up' : 'is-down')}><Icon name="arrowRight" size={11} />{delta >= 0 ? '+' : '−'}{Math.abs(delta)} % vs ta moyenne</span>}
          <span className="d2-week-reached">Objectif atteint {reached} jour{reached > 1 ? 's' : ''} sur 7</span>
        </div>
      </div>
      <div className="d2-week-plot" onMouseLeave={() => setHover(null)}>
        <span className="d2-week-goal" style={{ bottom: `calc(14 * var(--u) + (100% - 14 * var(--u)) * ${(goal / max).toFixed(4)})` }} />
        {days.map((d, i) => {
          const isToday = dayKey(d.date) === today;
          return (
            <button type="button" key={i} className={cx('d2-week-col', isToday && 'is-today', hover === i && 'is-hover')}
              onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
              aria-label={`${weekday(d.date)} ${shortDate(d.date)} : ${d.minutes} min${d.minutes >= goal ? ', objectif atteint' : ''}`}>
              <span className="d2-week-track"><span className="d2-week-bar" style={{ height: `${(d.minutes / max) * 100}%` }}>{isToday && d.minutes > 0 && <b>{d.minutes}</b>}</span></span>
              <span className="d2-week-day">{isToday ? 'Auj.' : DAY_SHORT[d.date.getDay()]}</span>
              {hover === i && (
                <span className="d2-week-tip" role="tooltip">
                  <strong>{weekday(d.date)} {shortDate(d.date)}</strong>
                  <span>{d.minutes} min{d.minutes >= goal ? ' · objectif atteint' : d.minutes ? ` · encore ${goal - d.minutes} min` : ' · repos'}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="d2-week-legend"><i aria-hidden="true" />Objectif : {goal} min par jour</p>
      <table className="sr-only">
        <caption>Minutes d’apprentissage par jour, 7 derniers jours</caption>
        <tbody>{days.map((d, i) => <tr key={i}><th scope="row">{weekday(d.date)} {shortDate(d.date)}</th><td>{d.minutes} min</td></tr>)}</tbody>
      </table>
    </article>
  );
}

const KIND_ICON: Record<Lesson['kind'], IconName> = { audio: 'headphones', video: 'video', reading: 'text', practice: 'pencil', assessment: 'medal' };

function NextLessons({ d, s }: { d: Data; s: LearnerState }) {
  const lessons = courseLessons(d.course);
  const start = Math.max(0, lessons.findIndex((l) => l.id === d.st.next?.id));
  const upcoming = d.st.next ? lessons.slice(start, start + 3) : [];
  return (
    <article className="d2-card d2-next" aria-labelledby="d2-next-title">
      <div className="d2-card-head">
        <h2 id="d2-next-title" className="d2-label">Prochaines leçons</h2>
        <button type="button" className="d2-link" onClick={() => navigate({ page: 'course', courseId: d.course.id })}>Programme <Icon name="arrowRight" size={12} /></button>
      </div>
      {upcoming.length === 0 ? <p className="d2-empty">Tu as terminé toutes les leçons de ce parcours. Bravo !</p> : (
        <ol className="d2-next-list">
          {upcoming.map((l, i) => {
            const playable = isPlayable(l);
            const attempt = s.attempts[l.id];
            return (
              <li key={l.id} className={cx(i === 0 && 'is-first')}>
                <span className={cx('d2-next-icon', `k-${l.kind}`)}><Icon name={KIND_ICON[l.kind]} size={15} /></span>
                <span className="d2-next-body">
                  <strong>{l.title}</strong>
                  <small>{KIND_LABEL[l.kind]} · {l.minutes} min{attempt ? ' · en cours' : ''}</small>
                </span>
                {playable
                  ? <button type="button" className={cx('d2-next-go', i === 0 && 'is-primary')} onClick={() => { avatar.interacted = true; navigate({ page: 'lesson', lessonId: l.id }); }} aria-label={`${attempt ? 'Reprendre' : 'Commencer'} : ${l.title}`}>{i === 0 ? (attempt ? 'Reprendre' : 'Commencer') : <Icon name="play" size={11} />}</button>
                  : <span className="d2-next-soon"><Icon name="lock" size={12} />Bientôt</span>}
              </li>
            );
          })}
        </ol>
      )}
    </article>
  );
}

function RecentBadges({ s }: { s: LearnerState }) {
  const earned = ACHIEVEMENTS.filter((a) => s.achievements[a.id]).sort((a, b) => (s.achievements[b.id] > s.achievements[a.id] ? 1 : -1));
  const next = ACHIEVEMENTS.filter((a) => !s.achievements[a.id]).map((a) => ({ a, p: a.progress(s) })).sort((x, y) => y.p.cur / y.p.target - x.p.cur / x.p.target)[0];
  return (
    <article className="d2-card d2-badges" aria-labelledby="d2-badges-title">
      <div className="d2-card-head">
        <h2 id="d2-badges-title" className="d2-label">Badges récents</h2>
        <span className="d2-badges-count">{earned.length} / {ACHIEVEMENTS.length}</span>
      </div>
      <ul className="d2-badge-list">
        {earned.slice(0, 3).map((a) => (
          <li key={a.id}><span className="d2-badge-medal"><Icon name={a.icon} size={16} /></span><span><strong>{a.title}</strong><small>{relative(s.achievements[a.id])}</small></span></li>
        ))}
      </ul>
      {next && (
        <div className="d2-badge-next">
          <span>Prochain : <b>{next.a.title}</b></span>
          <ProgressBar value={Math.min(100, (next.p.cur / next.p.target) * 100)} size="sm" label={`${next.a.title} : ${Math.min(next.p.cur, next.p.target)} sur ${next.p.target}`} />
        </div>
      )}
      <button type="button" className="d2-link" onClick={() => navigate({ page: 'badges' })}>Voir tous les badges <Icon name="arrowRight" size={12} /></button>
    </article>
  );
}

function OtherCourses({ s, current }: { s: LearnerState; current: string }) {
  const others = COURSES.filter((c) => c.id !== current && s.enrollments[c.id])
    .sort((a, b) => (s.enrollments[b.id].lastActiveAt > s.enrollments[a.id].lastActiveAt ? 1 : -1)).slice(0, 4);
  if (!others.length) return null;
  return (
    <section className="d2-others" aria-labelledby="d2-others-title">
      <div className="d2-section-head">
        <h2 id="d2-others-title">Tes autres cours</h2>
        <button type="button" className="d2-link" onClick={() => navigate({ page: 'library' })}>Explorer la bibliothèque <Icon name="arrowRight" size={12} /></button>
      </div>
      <div className="d2-others-grid">
        {others.map((c) => {
          const st = courseStats(s, c);
          return (
            <button key={c.id} type="button" className="d2-card d2-other" onClick={() => navigate({ page: 'course', courseId: c.id })} {...courseHoverProps(c.id, s)}>
              <CourseCover course={c} className="d2-other-cover" />
              <span className="d2-other-body">
                <strong>{c.shortTitle}</strong>
                <small>{LEVEL_LABEL[c.level]}{c.cefr ? ` · ${c.cefr}` : ''}</small>
                <span className="d2-other-progress"><ProgressBar value={st.pct} size="sm" label={`${c.title} : ${st.pct} %`} /><b>{st.pct}%</b></span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
