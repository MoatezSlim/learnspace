import React, { useMemo, useState } from 'react';
import { COURSES, getCourse, isPlayable, courseLessons } from '../data/courses';
import { useLearner, store } from '../state/store';
import { courseStats } from '../state/selectors';
import { estimatedFinish, practiceMinutes, accuracy, moduleStats, idleDays, byCourse, periodStart, firstActiveDay, lessonsDone } from '../state/insights';
import { navigate } from '../router';
import { Button, CourseCover, Ring, cx, toast, Empty } from '../components/ui';
import { Icon, Flag } from '../components/icons';
import { HBar } from '../components/charts';
import { courseHoverProps } from '../assistant/guideState';
import { AskChips, registerRail } from '../assistant/LeaDock';
import { avatar } from '../assistant/controller';
import { KIND_ICON } from './Dashboard';
import { overlays } from '../state/ui';
import { moduleShort, CATEGORY_SHORT } from '../data/labels';
import { minutesLabel } from '../lib/dates';
import type { Course, LearnerState, Route } from '../types';

type Tab = 'active' | 'todo' | 'done' | 'paused';
const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const longDay = (d: Date) => `${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`;

export function tabOf(s: LearnerState, c: Course): Tab | null {
  const e = s.enrollments[c.id]; if (!e) return null;
  const st = courseStats(s, c);
  if (e.paused) return 'paused';
  if (st.pct >= 100) return 'done';
  const started = st.done > 0 || courseLessons(c).some((l) => s.attempts[l.id]);
  return started ? 'active' : 'todo';
}

export function MyCourses() {
  const s = useLearner();
  const [tab, setTab] = useState<Tab>('active');
  const [sort, setSort] = useState<'recent' | 'progress' | 'alpha'>('recent');
  const mine = COURSES.filter((c) => s.enrollments[c.id]);
  const counts = { active: 0, todo: 0, done: 0, paused: 0 } as Record<Tab, number>;
  for (const c of mine) counts[tabOf(s, c)!]++;
  const inTab = mine.filter((c) => tabOf(s, c) === tab);
  const main = getCourse(s.currentCourseId)!;
  const featured = inTab.find((c) => c.id === main.id);
  const others = useMemo(() => inTab.filter((c) => c.id !== featured?.id).sort((a, b) => {
    if (sort === 'progress') return courseStats(s, b).pct - courseStats(s, a).pct;
    if (sort === 'alpha') return a.title.localeCompare(b.title, 'fr');
    return s.enrollments[b.id].lastActiveAt > s.enrollments[a.id].lastActiveAt ? 1 : -1;
  }), [inTab, featured, sort, s]); // eslint-disable-line react-hooks/exhaustive-deps
  const first = firstActiveDay(s);
  const total = lessonsDone(s);
  const languages = others.every((c) => c.category === 'langues');
  const available = COURSES.filter((c) => !s.enrollments[c.id]);
  const TABS: { id: Tab; label: string }[] = [{ id: 'active', label: 'En cours' }, { id: 'todo', label: 'À commencer' }, { id: 'done', label: 'Terminés' }, { id: 'paused', label: 'En pause' }];
  return (
    <div className="page my-courses">
      <header className="page-head">
        <div>
          <h1>Mes cours</h1>
          <p className="lead">{counts.active} cours en cours et {total} leçon{total > 1 ? 's' : ''} terminée{total > 1 ? 's' : ''}{first ? ` depuis le ${longDay(first)}` : ''}.</p>
        </div>
        <Button go onClick={() => overlays.openNewCourse()}>Ajouter un cours</Button>
      </header>
      <div className="tabs" role="tablist" aria-label="Mes cours">
        {TABS.map((t) => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={cx('tab', tab === t.id && 'on')} onClick={() => setTab(t.id)}>{t.label}<span className="tab-count">{counts[t.id]}</span></button>)}
      </div>
      {featured && <Featured s={s} c={featured} />}
      {inTab.length === 0 && (
        <Empty icon={tab === 'paused' ? 'pauseCircle' : tab === 'done' ? 'medal' : 'courses'} title={tab === 'paused' ? 'Aucun cours en pause' : tab === 'done' ? 'Aucun cours terminé pour l’instant' : tab === 'todo' ? 'Tous tes cours sont commencés' : 'Aucun cours en cours'}
          action={tab === 'todo' || tab === 'active' ? <Button variant="line" icon="plus" onClick={() => overlays.openNewCourse()}>Ajouter un cours</Button> : undefined}>
          {tab === 'paused' ? 'Un cours mis en pause garde ta progression : tu le reprends quand tu veux.' : tab === 'done' ? 'Termine toutes les leçons d’un cours pour le retrouver ici.' : 'Ajoute un cours depuis la bibliothèque.'}
        </Empty>
      )}
      {others.length > 0 && (
        <>
          <div className="sec-head">
            <h2>{featured ? (languages ? 'Tes autres langues' : 'Tes autres cours') : TABS.find((t) => t.id === tab)!.label}<span className="sec-count">{others.length} cours</span></h2>
            <label className="sort"><span>Trier par</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Trier mes cours">
                <option value="recent">Dernière activité</option><option value="progress">Progression</option><option value="alpha">Nom</option>
              </select><Icon name="chevronDown" size={16} />
            </label>
          </div>
          <div className="mc-grid">
            {others.map((c) => <CourseRow key={c.id} s={s} c={c} />)}
            {tab === 'active' && (
              <button type="button" className="mc-add" onClick={() => overlays.openNewCourse()}>
                <span className="mc-add-ic"><Icon name="plus" size={26} /></span>
                <span><strong>Ajouter un cours</strong><small>{available.length ? `${available.length} cours disponible${available.length > 1 ? 's' : ''} dans la bibliothèque, dont ${available.filter((x) => x.category !== 'langues').length} hors langues.` : 'Tu suis déjà tous les cours du catalogue.'}</small></span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ModuleBars({ s, c }: { s: LearnerState; c: Course }) {
  const cur = courseStats(s, c).module;
  return (
    <div className="mod-bars" role="img" aria-label={c.modules.map((m) => { const x = moduleStats(s, m); return `${moduleShort(m)} : ${x.done} sur ${x.total}`; }).join(', ')}>
      {c.modules.map((m) => {
        const x = moduleStats(s, m);
        return (
          <span key={m.id} className={cx('mod', x.complete && 'done', m.id === cur?.id && !x.complete && 'cur')}>
            <i><b style={{ width: `${(x.done / x.total) * 100}%` }} /></i>
            <small>{moduleShort(m)}</small>
          </span>
        );
      })}
    </div>
  );
}

function Featured({ s, c }: { s: LearnerState; c: Course }) {
  const st = courseStats(s, c);
  const next = st.next;
  const mod = next ? c.modules.find((m) => m.id === next.moduleId) : null;
  const finish = estimatedFinish(s, c);
  const acc = accuracy(s, { courseId: c.id });
  const minutes = practiceMinutes(s, c.id);
  return (
    <article className="card mc-featured" {...courseHoverProps(c.id, s)}>
      <button type="button" className="mc-cover-hit" onClick={() => navigate({ page: 'course', courseId: c.id })} aria-label={`${c.title} : voir le cours`}>
        <CourseCover course={c} className="mc-cover" word={c.cefr ?? undefined} flagSize={46}><span className="cv-tags"><span className="lvl">Parcours principal</span></span></CourseCover>
      </button>
      <div className="mc-main">
        <h2>{c.title}</h2>
        <p className="muted">{c.description}</p>
        <ModuleBars s={s} c={c} />
        {next && (
          <div className="mc-next">
            <span className="mc-next-ic"><Icon name={KIND_ICON[next.kind]} size={20} /></span>
            <span className="mc-next-body"><small>Module {mod?.index}, leçon {next.index} sur {mod?.lessons.length}</small><strong>{next.title}</strong></span>
            {isPlayable(next) ? <Button go onClick={() => navigate({ page: 'lesson', lessonId: next.id })}>{s.attempts[next.id] ? 'Reprendre' : 'Continuer'}</Button> : <span className="soon"><Icon name="lock" size={13} />Bientôt</span>}
          </div>
        )}
      </div>
      <div className="mc-stats">
        <Ring value={st.pct} size={128} stroke={11} label={`${st.pct} % du parcours`}><strong className="num">{st.pct} %</strong></Ring>
        <strong className="mc-count">{st.done} leçons sur {st.total}</strong>
        <small>{finish ? `Fin estimée : ${longDay(finish)}` : st.pct >= 100 ? 'Parcours terminé' : 'Fin estimée : reprends une leçon'}</small>
        <div className="mc-mini">
          <span><strong className="num">{minutesLabel(minutes)}</strong><small>de pratique</small></span>
          <span><strong className="num">{acc.pct ?? '–'} %</strong><small>de bonnes réponses</small></span>
        </div>
      </div>
    </article>
  );
}

function CourseRow({ s, c }: { s: LearnerState; c: Course }) {
  const st = courseStats(s, c);
  const idle = idleDays(s, c.id) ?? 0;
  const next = courseLessons(c).find((l) => !s.completions[l.id]?.passed && isPlayable(l)) ?? st.next;
  const paused = !!s.enrollments[c.id]?.paused;
  const [menu, setMenu] = useState(false);
  return (
    <article className="mc-row" {...courseHoverProps(c.id, s)}>
      <button type="button" className="mc-row-cover" onClick={() => navigate({ page: 'course', courseId: c.id })} aria-label={`${c.title} : voir le cours`}>
        <CourseCover course={c} className="mc-small-cover" photo flagSize={34} />
      </button>
      <div className="mc-row-body">
        <div className="mc-row-top">
          <div><h3>{c.title}</h3><small>{c.category === 'langues' ? `${c.level === 'debutant' ? 'Débutant' : c.level === 'intermediaire' ? 'Intermédiaire' : 'Avancé'} ${c.cefr ?? ''}` : CATEGORY_SHORT[c.category]}</small></div>
          <Ring value={st.pct} size={52} stroke={5} label={`${st.pct} %`}><small className="num">{st.pct}%</small></Ring>
          <div className="popover-wrap">
            <button type="button" className="icon-btn mc-more" aria-label={`Options pour ${c.title}`} aria-expanded={menu} onClick={() => setMenu(!menu)} onBlur={(e) => { if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) setMenu(false); }}><Icon name="more" size={18} /></button>
            {menu && (
              <div className="popover menu" role="menu">
                {s.currentCourseId !== c.id && <button type="button" role="menuitem" onMouseDown={(e) => e.preventDefault()} onClick={() => { setMenu(false); store.setCurrentCourse(c.id); toast(`« ${c.title} » est ton parcours principal`, 'success'); }}><Icon name="flag" size={16} />Définir comme parcours principal</button>}
                <button type="button" role="menuitem" onMouseDown={(e) => e.preventDefault()} onClick={() => { setMenu(false); store.pauseCourse(c.id, !paused); toast(paused ? `« ${c.title} » reprend` : `« ${c.title} » est en pause`, 'success'); }}><Icon name={paused ? 'play' : 'pauseCircle'} size={16} />{paused ? 'Reprendre ce cours' : 'Mettre en pause'}</button>
              </div>
            )}
          </div>
        </div>
        <ModuleBars s={s} c={c} />
        <div className="mc-row-foot">
          {paused ? <span className="mc-note"><Icon name="pauseCircle" size={15} />En pause : ta progression est gardée</span>
            : idle >= 30 && st.pct < 100 ? <span className="mc-note is-warn"><Icon name="alert" size={15} />Pas d’activité depuis {idle} jours</span>
            : next ? <span className="mc-note">Prochaine : <b>{next.title}</b></span> : <span className="mc-note">Cours terminé</span>}
          {paused
            ? <button type="button" className="pill-btn" onClick={() => { store.pauseCourse(c.id, false); toast(`« ${c.title} » reprend`, 'success'); }}>Reprendre<Icon name="arrowRight" size={14} /></button>
            : next && isPlayable(next) ? <button type="button" className="pill-btn" onClick={() => { avatar.interacted = true; navigate({ page: 'lesson', lessonId: next.id }); }}>{st.done === 0 && !courseLessons(c).some((l) => s.attempts[l.id]) ? 'Commencer' : idle >= 30 ? 'Reprendre' : 'Continuer'}<Icon name="arrowRight" size={14} /></button>
            : <button type="button" className="pill-btn" onClick={() => navigate({ page: 'course', courseId: c.id })}>Voir<Icon name="arrowRight" size={14} /></button>}
        </div>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------- Léa's panel on « Mes cours »
function CoursesRail(_: { route: Route }) {
  const s = useLearner();
  const rows = byCourse(s, periodStart('week')).filter((r) => !s.enrollments[r.course.id]?.paused).sort((a, b) => b.minutes - a.minutes).slice(0, 5);
  const max = Math.max(1, ...rows.map((r) => r.minutes));
  const total = rows.reduce((a, r) => a + r.lessons, 0);
  return (
    <>
      <section className="rail-sec" aria-labelledby="cw-title">
        <div className="rail-sec-head"><h3 id="cw-title">Tes leçons cette semaine</h3><span className="muted num">{total} leçon{total > 1 ? 's' : ''}</span></div>
        <ul className="per-course">
          {rows.map((r) => (
            <li key={r.course.id}>
              {r.course.flag ? <Flag code={r.course.flag} size={22} /> : <span className="pc-dot" />}
              <HBar value={r.minutes} max={max} tone={r.minutes ? 'blue' : 'soft'} label={`${r.course.shortTitle} : ${r.lessons} leçons, ${r.minutes} minutes`} />
              <small className="num">{r.minutes ? minutesLabel(r.minutes) : '0 min'}</small>
            </li>
          ))}
        </ul>
      </section>
      <section className="rail-sec" aria-labelledby="help-title">
        <div className="rail-sec-head"><h3 id="help-title">Je peux t’aider à</h3></div>
        <AskChips items={['Planifier ma semaine', 'Choisir mes priorités', 'Mettre un cours en pause']} icons={['calendar', 'target', 'pauseCircle']} />
      </section>
    </>
  );
}
registerRail('courses', CoursesRail);
