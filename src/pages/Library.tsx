import React, { useEffect, useMemo, useRef, useState } from 'react';
import { COURSES, CATEGORIES, LEVEL_LABEL, LEVEL_SHORT, courseLessons } from '../data/courses';
import type { CategoryId, Course, Level } from '../types';
import { useLearner, store } from '../state/store';
import { courseStats, normalizeAnswer } from '../state/selectors';
import { navigate } from '../router';
import { Button, CourseCover, Empty, ProgressBar, Skeleton, cx, toast } from '../components/ui';
import { courseHoverProps } from '../assistant/guideState';
import { Icon, IconName } from '../components/icons';

type Sort = 'relevance' | 'popularity' | 'progress' | 'duration' | 'alpha';
const SORTS: { id: Sort; label: string }[] = [
  { id: 'relevance', label: 'Pertinence' }, { id: 'popularity', label: 'Popularité' }, { id: 'progress', label: 'Ma progression' },
  { id: 'duration', label: 'Durée (courte d’abord)' }, { id: 'alpha', label: 'Ordre alphabétique' },
];
const CAT_ICON: Record<CategoryId, IconName> = { langues: 'globe', business: 'briefcase', informatique: 'monitor', devperso: 'sprout', sciences: 'flask', art: 'palette' };
const LEVELS: (Level | 'all')[] = ['all', 'debutant', 'intermediaire', 'avance'];

export function Library({ hydrated }: { hydrated: boolean }) {
  const s = useLearner();
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<Level | 'all'>('all');
  const [cat, setCat] = useState<CategoryId | 'all'>('langues');
  const [sort, setSort] = useState<Sort>('relevance');
  const [maxHours, setMaxHours] = useState<number>(0);
  const [mine, setMine] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filtersOpen) return;
    const close = (e: MouseEvent) => { if (!panelRef.current?.contains(e.target as Node)) setFiltersOpen(false); };
    window.addEventListener('mousedown', close); return () => window.removeEventListener('mousedown', close);
  }, [filtersOpen]);

  const results = useMemo(() => {
    const n = normalizeAnswer(query);
    let list = COURSES.filter((c) => (cat === 'all' || c.category === cat) && (level === 'all' || c.level === level)
      && (!n || normalizeAnswer(`${c.title} ${c.description} ${c.modules.map((m) => m.title).join(' ')}`).includes(n))
      && (!maxHours || c.hours <= maxHours) && (!mine || !!s.enrollments[c.id]));
    const prog = (c: Course) => courseStats(s, c).pct;
    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'popularity': return b.popularity - a.popularity;
        case 'progress': return prog(b) - prog(a);
        case 'duration': return a.hours - b.hours;
        case 'alpha': return a.title.localeCompare(b.title, 'fr');
        default: return (s.enrollments[b.id] ? 1 : 0) - (s.enrollments[a.id] ? 1 : 0) || b.popularity - a.popularity;
      }
    });
    return list;
  }, [query, level, cat, sort, maxHours, mine, s]);

  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map((c) => [c.id, COURSES.filter((x) => x.category === c.id).length])), []);
  const activeFilters = (maxHours ? 1 : 0) + (mine ? 1 : 0) + (sort !== 'relevance' ? 1 : 0);
  const reset = () => { setQuery(''); setLevel('all'); setCat('all'); setSort('relevance'); setMaxHours(0); setMine(false); };

  return (
    <div className="page library">
      <header className="page-head">
        <h1>Bibliothèque de cours</h1>
        <p className="muted">Explore nos cours et trouve celui qui correspond à tes objectifs.</p>
      </header>
      <div className="lib-search">
        <Icon name="search" size={18} />
        <label htmlFor="lib-q" className="sr-only">Rechercher un cours</label>
        <input id="lib-q" type="search" placeholder="Rechercher un cours…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="lib-toolbar">
        <div className="seg" role="group" aria-label="Niveau">
          {LEVELS.map((l) => <button key={l} type="button" className={cx('seg-btn', level === l && 'active')} aria-pressed={level === l} onClick={() => setLevel(l)}>{l === 'all' ? 'Tout' : LEVEL_SHORT[l]}</button>)}
        </div>
        <div className="popover-wrap" ref={panelRef}>
          <button type="button" className={cx('filter-btn', activeFilters > 0 && 'has')} aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>
            Plus de filtres{activeFilters ? ` (${activeFilters})` : ''}<Icon name="chevronDown" size={16} />
          </button>
          {filtersOpen && (
            <div className="popover filters" role="dialog" aria-label="Filtres et tri">
              <label htmlFor="lib-sort">Trier par</label>
              <select id="lib-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>{SORTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
              <label htmlFor="lib-hours">Durée maximale</label>
              <select id="lib-hours" value={maxHours} onChange={(e) => setMaxHours(Number(e.target.value))}>
                <option value={0}>Toutes les durées</option><option value={8}>8 h ou moins</option><option value={15}>15 h ou moins</option><option value={25}>25 h ou moins</option>
              </select>
              <label className="check"><input id="lib-mine" type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Seulement mes cours commencés</label>
              <Button variant="ghost" size="sm" onClick={() => { setSort('relevance'); setMaxHours(0); setMine(false); }}>Réinitialiser</Button>
            </div>
          )}
        </div>
      </div>

      <div className="lib-body">
        <nav className="cats" aria-label="Catégories">
          <h2>Catégories</h2>
          <ul>
            <li><button type="button" className={cx('cat', cat === 'all' && 'active')} aria-pressed={cat === 'all'} onClick={() => setCat('all')}><span className="cat-icon"><Icon name="library" size={16} /></span>Toutes<span className="cat-count">{COURSES.length}</span></button></li>
            {CATEGORIES.map((c) => (
              <li key={c.id}><button type="button" className={cx('cat', cat === c.id && 'active')} aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
                <span className="cat-icon"><Icon name={CAT_ICON[c.id]} size={16} /></span>{c.label}<span className="cat-count">{counts[c.id]}</span>
              </button></li>
            ))}
          </ul>
        </nav>
        <section className="lib-results" aria-label="Résultats" aria-busy={!hydrated}>
          <p className="sr-only" role="status">{results.length} cours affichés</p>
          {!hydrated ? (
            <div className="course-grid">{Array.from({ length: 6 }, (_, i) => <div key={i} className="card course-card"><Skeleton h={120} r={12} /><Skeleton h={14} w="60%" /><Skeleton h={10} w="40%" /><Skeleton h={6} /></div>)}</div>
          ) : results.length === 0 ? (
            <Empty title="Aucun cours ne correspond" action={<Button variant="secondary" onClick={reset}>Effacer les filtres</Button>}>Essaie un autre mot-clé, un autre niveau ou une autre catégorie.</Empty>
          ) : (
            <div className="course-grid">{results.map((c) => <CourseCard key={c.id} course={c} />)}</div>
          )}
        </section>
      </div>
    </div>
  );
}

export function CourseCard({ course }: { course: Course }) {
  const s = useLearner();
  const st = courseStats(s, course);
  const lessons = courseLessons(course).length;
  const open = () => navigate({ page: 'course', courseId: course.id });
  return (
    <article className="card course-card" {...courseHoverProps(course.id, s)}>
      <button type="button" className="course-card-hit" onClick={open} aria-label={`${course.title}, ${LEVEL_LABEL[course.level].toLowerCase()}${st.enrolled ? `, ${st.pct} % terminé` : ''}`}>
        <CourseCover course={course} />
      </button>
      <div className="course-card-body">
        <h3>{course.shortTitle === course.title ? course.title : course.shortTitle}</h3>
        <span className="muted small">{LEVEL_LABEL[course.level]}{course.cefr ? ` · ${course.cefr}` : ''}</span>
        <p className="course-desc">{course.description}</p>
        <span className="muted small"><Icon name="clock" size={13} /> {course.hours} h · {lessons} leçons</span>
        {st.enrolled ? (
          <div className="course-progress"><ProgressBar value={st.pct} size="sm" label={`${course.title} : ${st.pct} %`} /><span>{st.pct}%</span></div>
        ) : null}
        <div className="course-card-actions">
          {st.enrolled
            ? <Button size="sm" variant="secondary" iconRight="arrowRight" onClick={open}>{st.pct >= 100 ? 'Revoir' : st.done > 0 ? 'Continuer' : 'Commencer'}</Button>
            : <Button size="sm" variant="secondary" icon="sparkle" onClick={() => { store.enroll(course.id); toast(`Inscription confirmée : ${course.title}`, 'success'); open(); }}>S’inscrire</Button>}
        </div>
      </div>
    </article>
  );
}
