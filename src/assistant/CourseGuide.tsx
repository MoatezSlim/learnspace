import React, { useEffect, useRef } from 'react';
import { Lea } from './Lea';
import { Typed } from './AssistantPanels';
import { guide, useGuide, describeCourse } from './guideState';
import { useLearner, store } from '../state/store';
import { useRoute, navigate } from '../router';
import { getCourse, courseLessons, isPlayable, LEVEL_LABEL } from '../data/courses';
import { courseStats } from '../state/selectors';
import { Icon } from '../components/icons';
import { cx, toast } from '../components/ui';

/** Léa pops up and presents the course the learner moved to (desktop corner card, mobile sheet). */
export function CourseGuide({ mobile }: { mobile: boolean }) {
  const g = useGuide();
  const s = useLearner();
  const route = useRoute();
  const ref = useRef<HTMLElement>(null);
  const course = g.courseId ? getCourse(g.courseId) : undefined;

  useEffect(() => {
    if (!course) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') guide.close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [course]);

  if (!course) return null;
  const st = courseStats(s, course);
  const { hello, text } = describeCourse(course, s);
  const onCoursePage = route.page === 'course' && route.courseId === course.id;
  const target = courseLessons(course).find((l) => !s.completions[l.id]?.passed && isPlayable(l));
  const start = () => {
    guide.close();
    if (!target) { navigate({ page: 'course', courseId: course.id }); return; }
    if (!st.enrolled) { store.enroll(course.id); toast(`Inscription confirmée : ${course.title}`, 'success'); }
    navigate({ page: 'lesson', lessonId: target.id });
  };

  return (
    <aside ref={ref} key={g.key} className={cx('guide', mobile ? 'guide-sheet' : 'guide-corner', g.mode === 'peek' && 'is-peek')}
      role={g.mode === 'open' ? 'dialog' : 'status'} aria-label={`Léa présente le cours ${course.title}`}
      onMouseEnter={() => guide.enterGuide()} onMouseLeave={() => guide.leaveGuide()}>
      <div className="guide-lea"><Lea framing="guide" decorative /></div>
      <div className="guide-bubble">
        {g.mode === 'open' && <button type="button" className="guide-close" aria-label="Fermer" onClick={() => guide.close()}><Icon name="x" size={16} /></button>}
        <span className="guide-who">Léa</span>
        <strong className="guide-title">{course.title}</strong>
        <p className="guide-text"><b>{hello} </b><Typed text={text} at={g.at + 350} reserve={false} /></p>
        <div className="guide-meta">
          <span><Icon name="clock" size={13} />{course.hours} h</span>
          <span><Icon name="book" size={13} />{st.total} leçons</span>
          <span><Icon name="progress" size={13} />{LEVEL_LABEL[course.level].replace(/^Niveau /, '')}</span>
          {st.enrolled && <span className="is-progress">{st.pct} % fait</span>}
        </div>
        <div className="guide-actions">
          {onCoursePage
            ? <button type="button" className="guide-btn" onClick={start} disabled={!target}>{st.pct >= 100 ? 'Revoir' : st.enrolled && st.done > 0 ? 'Continuer' : 'C’est parti'}<Icon name="arrowRight" size={14} /></button>
            : <button type="button" className="guide-btn" onClick={() => { guide.close(); navigate({ page: 'course', courseId: course.id }); }}>Voir le cours<Icon name="arrowRight" size={14} /></button>}
          {g.mode === 'open' && <button type="button" className="guide-later" onClick={() => guide.close()}>Plus tard</button>}
        </div>
      </div>
    </aside>
  );
}
