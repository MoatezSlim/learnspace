import React, { useMemo, useSyncExternalStore } from 'react';
import { COURSES, CATEGORIES, courseLessons, getCourse } from '../data/courses';
import type { CategoryId, Course, Level, LearnerState, Route } from '../types';
import { useLearner, store } from '../state/store';
import { courseStats, assessments } from '../state/selectors';
import { libraryPicks, peakHours } from '../state/insights';
import { navigate } from '../router';
import { Button, CourseCover, Empty, ProgressBar, Skeleton, cx, toast, Seg, LevelTag } from '../components/ui';
import { courseHoverProps } from '../assistant/guideState';
import { registerRail } from '../assistant/LeaDock';
import { avatar } from '../assistant/controller';
import { LeaPhoto } from '../assistant/Lea';
import { Icon } from '../components/icons';
import { CATEGORY_ICON, CATEGORY_SHORT } from '../data/labels';
import { moduleTitleOf } from '../assistant/brain';
import { theCourse } from '../assistant/pageLines';

type Sort = 'relevance' | 'popularity' | 'progress' | 'duration' | 'alpha';
const SORTS: { id: Sort; label: string }[] = [
  { id: 'relevance', label: 'Pertinence' }, { id: 'popularity', label: 'Popularité' }, { id: 'progress', label: 'Ma progression' },
  { id: 'duration', label: 'Durée' }, { id: 'alpha', label: 'Ordre alphabétique' },
];
type Preset = 'travel' | 'career' | 'short' | 'beginner';
export const PRESETS: { id: Preset; label: string; icon: 'globe' | 'briefcase' | 'clock' | 'sprout'; line: string; test: (c: Course) => boolean }[] = [
  { id: 'travel', label: 'Pour voyager', icon: 'globe', line: '**Pour voyager**, voici les cours qui t’aident à réserver, t’orienter et discuter sur place.',
    test: (c) => /voyag|hôtel|hotel|viaggi|unterwegs|en la ciudad|restaurant/i.test(`${c.description} ${c.modules.map((m) => m.title).join(' ')}`) },
  { id: 'career', label: 'Pour ma carrière', icon: 'briefcase', line: '**Pour ta carrière** : convaincre, négocier, écrire des courriels et analyser des données.',
    test: (c) => c.category === 'business' || c.category === 'informatique' || /professionnel|courriel|courrier/i.test(c.description) },
  { id: 'short', label: '10 minutes par jour', icon: 'clock', line: '**Des cours courts**, faciles à suivre avec 10 minutes par jour.', test: (c) => c.hours <= 10 },
  { id: 'beginner', label: 'Je débute de zéro', icon: 'sprout', line: '**Pour débuter** : aucun prérequis, on avance pas à pas.', test: (c) => c.level === 'debutant' },
];

// filters shared by the page and Léa's panel (quick searches)
interface Filters { level: Level | 'all'; cat: CategoryId | 'all'; preset: Preset | null; sort: Sort; picks: number }
let filters: Filters = { level: 'all', cat: 'all', preset: null, sort: 'relevance', picks: 0 };
const fl = new Set<() => void>();
const setFilters = (p: Partial<Filters>) => { filters = { ...filters, ...p }; fl.forEach((l) => l()); };
const useFilters = () => useSyncExternalStore((l) => { fl.add(l); return () => fl.delete(l); }, () => filters);

const lc = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

/** Why Léa suggests a course, from the learner's own figures. */
export function pickReason(c: Course, s: LearnerState): string {
  const main = getCourse(s.currentCourseId)!;
  const ph = peakHours(s);
  if (c.id === 'biz-pitch') {
    const oral = main.modules.find((m) => !m.lessons.every((l) => s.completions[l.id]?.passed) && /opinion|présent|oral/i.test(m.title) && m.lessons.some((l) => l.skill === 'speaking'));
    return oral ? `Pour pratiquer l’oral en situation réelle, comme dans ton module ${oral.index}.` : 'Pour pratiquer l’oral en situation réelle, avec des exemples concrets.';
  }
  if (c.category === 'business') {
    const best = [...assessments(s)].sort((a, b) => b.pct - a.pct)[0];
    return best && best.pct >= 80 ? `Tu as validé « ${moduleTitleOf(best.lesson.id)} » à ${best.pct} % : tu as déjà les bases pour argumenter.` : 'Des fiches courtes pour préparer tes échanges professionnels.';
  }
  if (c.category === 'devperso') return ph ? `Tu apprends surtout ${ph.moment} : ce cours t’aide à protéger ce créneau.` : 'Ce cours t’aide à garder un rythme régulier.';
  if (c.category === 'informatique') return `Un cours de ${c.hours} h, idéal avec ton objectif de ${s.profile.dailyGoalMin} minutes par jour.`;
  if (c.category === 'langues') {
    const n = COURSES.filter((x) => x.category === 'langues' && courseStats(s, x).done > 0).length;
    return `Tu progresses déjà dans ${n} langue${n > 1 ? 's' : ''} : ${lc(c.shortTitle)} complète bien ta collection.`;
  }
  return `Une pause culture de ${c.hours} h pour varier tes séances.`;
}

export function Library({ hydrated }: { hydrated: boolean }) {
  const s = useLearner();
  const f = useFilters();
  const results = useMemo(() => {
    const preset = PRESETS.find((p) => p.id === f.preset);
    const list = COURSES.filter((c) => (f.cat === 'all' || c.category === f.cat) && (f.level === 'all' || c.level === f.level) && (!preset || preset.test(c)));
    const prog = (c: Course) => courseStats(s, c).pct;
    return [...list].sort((a, b) => {
      switch (f.sort) {
        case 'popularity': return b.popularity - a.popularity;
        case 'progress': return prog(b) - prog(a);
        case 'duration': return a.hours - b.hours;
        case 'alpha': return a.title.localeCompare(b.title, 'fr');
        default: return (s.enrollments[b.id] ? 1 : 0) - (s.enrollments[a.id] ? 1 : 0) || (a.id === s.currentCourseId ? -1 : b.id === s.currentCourseId ? 1 : 0) || b.popularity - a.popularity;
      }
    });
  }, [f, s]);
  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map((c) => [c.id, COURSES.filter((x) => x.category === c.id).length])), []);
  const preset = PRESETS.find((p) => p.id === f.preset);
  const reset = () => setFilters({ level: 'all', cat: 'all', preset: null, sort: 'relevance' });

  return (
    <div className="page library">
      <header className="page-head">
        <div>
          <h1>Bibliothèque</h1>
          <p className="lead">{COURSES.length} cours dans {CATEGORIES.length} domaines. Ajoute un cours en un clic, Léa l’intègre à ton plan de la semaine.</p>
        </div>
        <Seg label="Niveau" value={f.level} onChange={(level) => setFilters({ level })} options={[{ id: 'all', label: 'Tous niveaux' }, { id: 'debutant', label: 'Débutant' }, { id: 'intermediaire', label: 'Intermédiaire' }, { id: 'avance', label: 'Avancé' }]} />
      </header>
      <div className="cat-chips" role="group" aria-label="Domaines">
        <button type="button" className={cx('chip', f.cat === 'all' && 'on')} aria-pressed={f.cat === 'all'} onClick={() => setFilters({ cat: 'all' })}><Icon name="sparkle" size={16} />Tout<span className="chip-count">{COURSES.length}</span></button>
        {CATEGORIES.map((c) => (
          <button key={c.id} type="button" className={cx('chip', f.cat === c.id && 'on')} aria-pressed={f.cat === c.id} onClick={() => setFilters({ cat: c.id })}>
            <Icon name={CATEGORY_ICON[c.id]} size={16} />{c.label === 'Art & Culture' ? 'Art et culture' : c.label}<span className="chip-count">{counts[c.id]}</span>
          </button>
        ))}
      </div>
      <Picks s={s} />
      <div className="sec-head">
        <h2>Tous les cours<span className="sec-count">{results.length} résultat{results.length > 1 ? 's' : ''}</span></h2>
        <div className="sec-side">
          {preset && <button type="button" className="chip on" onClick={() => setFilters({ preset: null })} aria-label={`Retirer le filtre ${preset.label}`}><Icon name={preset.icon} size={15} />{preset.label}<Icon name="x" size={14} /></button>}
          <label className="sort"><span>Trier par</span>
            <select value={f.sort} onChange={(e) => setFilters({ sort: e.target.value as Sort })} aria-label="Trier les cours">{SORTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
            <Icon name="chevronDown" size={16} />
          </label>
        </div>
      </div>
      <section aria-label="Résultats" aria-busy={!hydrated}>
        <p className="sr-only" role="status">{results.length} cours affichés</p>
        {!hydrated ? (
          <div className="course-grid">{Array.from({ length: 4 }, (_, i) => <div key={i} className="card course-card"><Skeleton h={140} r={14} /><Skeleton h={14} w="60%" /><Skeleton h={10} w="40%" /></div>)}</div>
        ) : results.length === 0 ? (
          <Empty title="Aucun cours ne correspond" action={<Button variant="line" onClick={reset}>Effacer les filtres</Button>}>Essaie un autre niveau ou un autre domaine.</Empty>
        ) : (
          <div className="course-grid">{results.map((c) => <CourseCard key={c.id} course={c} />)}</div>
        )}
      </section>
    </div>
  );
}

function Picks({ s }: { s: LearnerState }) {
  const f = useFilters();
  const ranked = libraryPicks(s);
  if (ranked.length === 0) return null;
  const start = (f.picks * 3) % Math.max(3, ranked.length);
  const three = [...ranked, ...ranked].slice(start, start + Math.min(3, ranked.length));
  const main = getCourse(s.currentCourseId)!;
  const st = courseStats(s, main);
  const goal = s.profile.goal?.trim();
  return (
    <section className="picks" aria-labelledby="picks-title">
      <div className="picks-intro">
        <span className="picks-kicker"><LeaPhoto className="picks-face" />Sélection de Léa</span>
        <h2 id="picks-title">Trois cours pour aller plus loin que {theCourse(main)}</h2>
        <p>Je les ai choisis à partir de tes {st.done} leçons terminées{goal ? <> et de ton objectif : {lc(goal)}.</> : '.'}</p>
        <Button className="picks-more" go="replay" onClick={() => { setFilters({ picks: f.picks + 1 }); avatar.express('curious', 900, 'smile'); }}>Proposer d’autres cours</Button>
      </div>
      <div className="picks-cards">
        {three.map((c) => (
          <article key={c.id} className="pick" {...courseHoverProps(c.id, s)}>
            <button type="button" className="pick-hit" onClick={() => navigate({ page: 'course', courseId: c.id })} aria-label={`${c.title} : voir le cours`}>
              <CourseCover course={c} className="pick-cover" flag={false} word={false}><span className="cv-tags"><LevelTag course={{ ...c, cefr: undefined }} /></span></CourseCover>
            </button>
            <div className="pick-body">
              <span className="meta-row"><b>{CATEGORY_SHORT[c.category]}</b><span><Icon name="clock" size={13} />{c.hours} h</span><span><Icon name="book" size={13} />{courseLessons(c).length} leçons</span></span>
              <h3>{c.title}</h3>
              <p className="pick-why"><Icon name="sparkle" size={14} />{pickReason(c, s)}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function CourseCard({ course }: { course: Course }) {
  const s = useLearner();
  const st = courseStats(s, course);
  const lessons = courseLessons(course).length;
  const open = () => navigate({ page: 'course', courseId: course.id });
  const add = () => { store.enroll(course.id); toast(`« ${course.title} » ajouté à Mes cours`, 'success'); avatar.react('point'); };
  return (
    <article className={cx('card course-card', st.enrolled && 'is-mine')} {...courseHoverProps(course.id, s)}>
      <button type="button" className="course-card-hit" onClick={open} aria-label={`${course.title}, ${course.level === 'debutant' ? 'débutant' : course.level === 'intermediaire' ? 'intermédiaire' : 'avancé'}${st.enrolled ? `, ${st.pct} % terminé` : ''}`}>
        <CourseCover course={course} className="course-cover">
          <span className="cv-tags"><LevelTag course={course} />{course.tag === 'new' ? <span className="cv-badge is-new"><Icon name="sparkle" size={13} />Nouveau</span> : !st.enrolled && course.popularity >= 85 ? <span className="cv-badge"><Icon name="flameSolid" size={13} />Populaire</span> : null}</span>
        </CourseCover>
      </button>
      <div className="course-card-body">
        <span className="meta-row"><b>{CATEGORY_SHORT[course.category]}</b><span><Icon name="clock" size={13} />{course.hours} h</span><span><Icon name="book" size={13} />{lessons} leçons</span></span>
        <h3>{course.title}</h3>
        <p className="course-desc">{course.description}</p>
        <div className="course-card-foot">
          {st.enrolled ? (
            <div className="course-progress"><ProgressBar value={st.pct} size="sm" label={`${course.title} : ${st.pct} %`} /><b className="num">{st.pct} %</b></div>
          ) : (
            <>
              <button type="button" className="preview" onClick={open}><Icon name="eye" size={15} />Aperçu gratuit</button>
              <button type="button" className="add" onClick={add} aria-label={`Ajouter ${course.title} à mes cours`}><Icon name="plus" size={15} />Ajouter</button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------- Léa's panel on the library
function LibraryRail(_: { route: Route }) {
  const f = useFilters();
  const top = [...COURSES].sort((a, b) => b.popularity - a.popularity).slice(0, 3);
  return (
    <>
      <section className="rail-sec" aria-labelledby="qs-title">
        <div className="rail-sec-head"><h3 id="qs-title">Recherches rapides</h3>{f.preset && <button type="button" className="link" onClick={() => setFilters({ preset: null })}>Effacer</button>}</div>
        <div className="rail-chips">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" className={cx('chip chip-ask', f.preset === p.id && 'on')} aria-pressed={f.preset === p.id}
              onClick={() => { const on = f.preset !== p.id; setFilters({ preset: on ? p.id : null, cat: 'all' }); if (on) { avatar.react('point'); void avatar.say(p.line, { mood: 'happy' }); } }}>
              <Icon name={p.icon} size={15} />{p.label}
            </button>
          ))}
        </div>
      </section>
      <section className="rail-sec" aria-labelledby="top-title">
        <div className="rail-sec-head"><h3 id="top-title">Les plus populaires</h3></div>
        <ol className="rank">
          {top.map((c, i) => (
            <li key={c.id}><button type="button" onClick={() => navigate({ page: 'course', courseId: c.id })}><span className="rank-n num">{i + 1}</span><strong>{c.title}</strong><small>{CATEGORY_SHORT[c.category]}</small></button></li>
          ))}
        </ol>
      </section>
    </>
  );
}
registerRail('library', LibraryRail);
