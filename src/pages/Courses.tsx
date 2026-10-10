import React, { useEffect, useState } from 'react';
import { COURSES, getCourse, LEVEL_LABEL, KIND_LABEL, SKILL_LABEL, isPlayable } from '../data/courses';
import { useLearner, store } from '../state/store';
import { courseStats, recommendation } from '../state/selectors';
import { navigate } from '../router';
import { Button, CourseCover, Empty, ProgressBar, Pill, cx, toast } from '../components/ui';
import { Icon, IconName } from '../components/icons';
import { CourseCard } from './Library';
import type { Lesson } from '../types';
import { shortDate } from '../lib/dates';
import { guide } from '../assistant/guideState';

export function MyCourses() {
  const s = useLearner();
  const enrolled = COURSES.filter((c) => s.enrollments[c.id]).sort((a, b) => (s.enrollments[b.id].lastActiveAt > s.enrollments[a.id].lastActiveAt ? 1 : -1));
  const rec = recommendation(s);
  return (
    <div className="page">
      <header className="page-head row-between">
        <div><h1>Mes cours</h1><p className="muted">{enrolled.length} cours en cours · reprends là où tu t’es arrêté.</p></div>
        <Button variant="secondary" icon="library" onClick={() => navigate({ page: 'library' })}>Explorer la bibliothèque</Button>
      </header>
      {rec && (
        <article className="card next-banner">
          <span className="stat-icon tone-blue"><Icon name={rec.lesson.kind === 'video' ? 'video' : rec.lesson.kind === 'audio' ? 'headphones' : 'text'} size={22} /></span>
          <div><span className="card-label">Recommandé maintenant</span><strong>{rec.lesson.title}</strong><span className="muted small">{rec.course.title} · {KIND_LABEL[rec.lesson.kind]} · {rec.lesson.minutes} min</span></div>
          <Button iconRight="arrowRight" onClick={() => navigate({ page: 'lesson', lessonId: rec.lesson.id })}>Commencer</Button>
        </article>
      )}
      {enrolled.length === 0
        ? <Empty icon="courses" title="Tu n’as encore commencé aucun cours" action={<Button onClick={() => navigate({ page: 'library' })}>Choisir un cours</Button>} />
        : <div className="course-grid wide">{enrolled.map((c) => <CourseCard key={c.id} course={c} />)}</div>}
    </div>
  );
}

const KIND_ICON: Record<Lesson['kind'], IconName> = { audio: 'headphones', video: 'video', reading: 'text', practice: 'pencil', assessment: 'medal' };

export function CourseDetail({ courseId }: { courseId?: string }) {
  const s = useLearner();
  const course = courseId ? getCourse(courseId) : undefined;
  const [open, setOpen] = useState<Record<string, boolean>>({});
  // moving to a course: Léa pops up and presents it
  useEffect(() => { if (course) { const t = window.setTimeout(() => guide.open(course.id, store.state), 350); return () => window.clearTimeout(t); } return undefined; }, [course?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!course) return <div className="page"><Empty icon="alert" title="Cours introuvable" action={<Button onClick={() => navigate({ page: 'library' })}>Retour à la bibliothèque</Button>} /></div>;
  const st = courseStats(s, course);
  const isOpen = (id: string) => open[id] ?? id === st.module?.id;
  const firstPlayable = course.modules.flatMap((m) => m.lessons).find((l) => !s.completions[l.id]?.passed && isPlayable(l));

  return (
    <div className="page course-detail">
      <button type="button" className="back-link" onClick={() => navigate({ page: st.enrolled ? 'courses' : 'library' })}><Icon name="arrowLeft" size={16} />{st.enrolled ? 'Mes cours' : 'Bibliothèque'}</button>
      <header className="course-hero card">
        <CourseCover course={course} className="course-hero-cover" />
        <div className="course-hero-body">
          <span className="eyebrow">{LEVEL_LABEL[course.level]}{course.cefr ? ` · CECRL ${course.cefr}` : ''}</span>
          <h1>{course.title}</h1>
          <p>{course.description}</p>
          <p className="muted small"><Icon name="clock" size={14} /> {course.hours} h · {st.total} leçons · {course.modules.length} modules</p>
          {st.enrolled && <div className="course-progress big"><ProgressBar value={st.pct} label={`Progression : ${st.pct} %`} /><span>{st.done} / {st.total} · {st.pct}%</span></div>}
          <div className="row-gap">
            {firstPlayable ? (
              <Button iconRight="arrowRight" onClick={() => { if (!st.enrolled) { store.enroll(course.id); toast(`Inscription confirmée : ${course.title}`, 'success'); } navigate({ page: 'lesson', lessonId: firstPlayable.id }); }}>
                {st.enrolled && st.done > 0 ? 'Continuer' : 'Commencer le cours'}
              </Button>
            ) : <Pill tone="amber" icon="lock">Prochaines leçons bientôt disponibles</Pill>}
            {st.enrolled && s.currentCourseId !== course.id && <Button variant="secondary" onClick={() => { store.setCurrentCourse(course.id); toast('Parcours principal mis à jour', 'success'); }}>Définir comme parcours principal</Button>}
            {s.currentCourseId === course.id && <Pill tone="blue" icon="flag">Parcours principal</Pill>}
          </div>
        </div>
      </header>

      <section aria-label="Programme du cours" className="modules">
        <h2>Programme</h2>
        {course.modules.map((m) => {
          const done = m.lessons.filter((l) => s.completions[l.id]?.passed).length;
          const expanded = isOpen(m.id);
          return (
            <div key={m.id} className={cx('card module', expanded && 'open')}>
              <button type="button" className="module-head" aria-expanded={expanded} aria-controls={`mod-${m.id}`} onClick={() => setOpen({ ...open, [m.id]: !expanded })}>
                <span className={cx('module-num', done === m.lessons.length && 'complete')}>{done === m.lessons.length ? <Icon name="check" size={16} /> : m.index}</span>
                <span className="module-title"><strong>Module {m.index} · {m.title}</strong><small>{done} / {m.lessons.length} leçons terminées</small></span>
                <ProgressBar value={(done / m.lessons.length) * 100} size="sm" className="module-bar" label={`Module ${m.index} : ${done} sur ${m.lessons.length}`} />
                <Icon name="chevronDown" size={18} className="module-chev" />
              </button>
              {expanded && (
                <ol className="lessons" id={`mod-${m.id}`}>
                  {m.lessons.map((l) => {
                    const c = s.completions[l.id];
                    const playable = isPlayable(l);
                    const state = c?.passed ? 'done' : st.next?.id === l.id ? 'next' : c && !c.passed ? 'retry' : 'todo';
                    return (
                      <li key={l.id} className={cx('lesson-item', `is-${state}`)}>
                        <span className="li-icon"><Icon name={state === 'done' ? 'check' : KIND_ICON[l.kind]} size={16} /></span>
                        <span className="li-body">
                          <strong>{l.index}. {l.title}</strong>
                          <small>{KIND_LABEL[l.kind]} · {SKILL_LABEL[l.skill]} · {l.minutes} min{c ? ` · ${c.score}/${c.total} le ${shortDate(new Date(c.at))}` : ''}</small>
                        </span>
                        {playable
                          ? <Button size="sm" variant={state === 'next' ? 'primary' : 'ghost'} onClick={() => navigate({ page: 'lesson', lessonId: l.id })}>{state === 'done' ? 'Revoir' : state === 'retry' ? 'Retenter' : state === 'next' ? 'Commencer' : 'Ouvrir'}</Button>
                          : state === 'done' ? <span className="muted small">Terminée</span> : <span className="muted small li-soon"><Icon name="lock" size={13} />Bientôt</span>}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
