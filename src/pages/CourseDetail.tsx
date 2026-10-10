import React, { useEffect, useState } from 'react';
import { getCourse, KIND_LABEL, SKILL_LABEL, isPlayable, courseLessons, LEVEL_SHORT } from '../data/courses';
import { useLearner, store } from '../state/store';
import { courseStats, skillLevels } from '../state/selectors';
import { estimatedFinish, accuracy, moduleStats, remainingMinutes, nextAssessment, pace } from '../state/insights';
import { navigate } from '../router';
import { Button, CourseCover, Empty, Ring, cx, toast, Segments, downloadText, Pill } from '../components/ui';
import { Icon, Flag, IconName } from '../components/icons';
import { Check } from '../components/charts';
import { guide } from '../assistant/guideState';
import { AskChips, registerRail } from '../assistant/LeaDock';
import { KIND_ICON } from './Dashboard';
import { CATEGORY_SHORT } from '../data/labels';
import { minutesLabel, addDays, startOfDay, daysBetween } from '../lib/dates';
import { dayName } from '../state/insights';
import type { Course, LearnerState, Lesson, Module, Route } from '../types';

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const short = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;

function programmeText(c: Course, s: LearnerState) {
  const lines = [`${c.title}`, `${c.description}`, `${c.hours} heures · ${courseLessons(c).length} leçons · ${c.modules.length} modules`, ''];
  for (const m of c.modules) {
    lines.push(`Module ${m.index} · ${m.title}`);
    for (const l of m.lessons) lines.push(`  ${s.completions[l.id]?.passed ? '[x]' : '[ ]'} ${l.index}. ${l.title} (${KIND_LABEL[l.kind]}, ${l.minutes} min)`);
    lines.push('');
  }
  lines.push('Programme exporté depuis LearnSpace.');
  return lines.join('\n');
}

export function CourseDetail({ courseId }: { courseId?: string }) {
  const s = useLearner();
  const course = courseId ? getCourse(courseId) : undefined;
  // moving to a course: Léa presents it
  useEffect(() => { if (course) { const t = window.setTimeout(() => guide.open(course.id, store.state), 350); return () => window.clearTimeout(t); } return undefined; }, [course?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!course) return <div className="page"><Empty icon="alert" title="Cours introuvable" action={<Button onClick={() => navigate({ page: 'library' })}>Retour à la bibliothèque</Button>} /></div>;
  return <CourseView s={s} course={course} />;
}

function CourseView({ s, course }: { s: LearnerState; course: Course }) {
  const st = courseStats(s, course);
  const target = courseLessons(course).find((l) => !s.completions[l.id]?.passed && isPlayable(l));
  const finish = estimatedFinish(s, course);
  const acc = accuracy(s, { courseId: course.id });
  const modulesDone = course.modules.filter((m) => moduleStats(s, m).complete).length;
  const audio = courseLessons(course).filter((l) => l.kind === 'audio').length;
  const left = remainingMinutes(s, course);
  const [openMods, setOpenMods] = useState<Record<string, boolean>>({});
  const [all, setAll] = useState(false);
  const isOpen = (m: Module) => openMods[m.id] ?? (all || m.id === st.module?.id);
  const start = () => {
    if (!st.enrolled) { store.enroll(course.id); toast(`« ${course.title} » ajouté à Mes cours`, 'success'); }
    if (target) navigate({ page: 'lesson', lessonId: target.id });
  };
  return (
    <div className="page course-page">
      <section className={cx('cd-hero', course.cover.kind === 'photo' && 'has-photo')}>
        <CourseCover course={course} className="cd-bg" flag={false} word={false} />
        <span className="cd-shade" aria-hidden="true" />
        <div className="cd-main">
          <nav className="cd-crumbs" aria-label="Fil d’Ariane">
            <button type="button" className="cd-back" onClick={() => navigate({ page: st.enrolled ? 'courses' : 'library' })} aria-label="Retour"><Icon name="arrowLeft" size={17} /></button>
            <ol>
              <li><button type="button" onClick={() => navigate({ page: st.enrolled ? 'courses' : 'library' })}>{st.enrolled ? 'Mes cours' : 'Bibliothèque'}</button></li>
              <li><span>{CATEGORY_SHORT[course.category]}</span></li>
              <li aria-current="page"><span>{course.shortTitle}</span></li>
            </ol>
          </nav>
          <h1>{course.flag && <Flag code={course.flag} size={52} />}<span>{course.title}</span></h1>
          <p className="cd-desc">{course.description}{course.cefr ? ` Le cours suit le niveau ${course.cefr} du cadre européen.` : ''}</p>
          <div className="cd-chips">
            <span><Icon name="progress" size={15} />{course.cefr ? `Niveau ${course.cefr}` : LEVEL_SHORT[course.level]}</span>
            <span><Icon name="clock" size={15} />{course.hours} heures</span>
            <span><Icon name="book" size={15} />{st.total} leçons en {course.modules.length} modules</span>
            {audio > 0 && <span><Icon name="headphones" size={15} />{audio} écoute{audio > 1 ? 's' : ''}</span>}
            <span><Icon name="medal" size={15} />Certificat de fin de parcours</span>
          </div>
          <div className="cd-ctas">
            {target ? <Button variant="white" go onClick={start}>{st.enrolled ? (st.done > 0 ? `Continuer : ${target.title}` : `Commencer : ${target.title}`) : 'Ajouter et commencer'}</Button>
              : st.enrolled ? <Pill tone="gold" icon="lock">Prochaines leçons bientôt disponibles</Pill>
              : <Button variant="white" go onClick={() => { store.enroll(course.id); toast(`« ${course.title} » ajouté à Mes cours`, 'success'); }}>Ajouter à mes cours</Button>}
            <button type="button" className="hero-link" onClick={() => { if (downloadText(`programme-${course.id}.txt`, programmeText(course, s))) toast('Programme téléchargé', 'success'); }}>Télécharger le programme</button>
          </div>
        </div>
        <aside className="cd-side" aria-label="Ta progression dans ce cours">
          <Ring value={st.pct} size={128} stroke={11} color="#8FB0FF" track="rgba(255,255,255,.16)" label={`${st.pct} % du cours`}><strong className="num">{st.pct} %</strong></Ring>
          <strong className="cd-count">{st.done} leçons sur {st.total}</strong>
          <small>{st.pct >= 100 ? 'Cours terminé, bravo !' : `Il te reste environ ${minutesLabel(left)}`}</small>
          <div className="cd-mini">
            <span><strong className="num">{modulesDone}</strong><small>module{modulesDone > 1 ? 's' : ''} fini{modulesDone > 1 ? 's' : ''}</small></span>
            <span><strong className="num">{acc.pct ?? '–'}{acc.pct !== null ? ' %' : ''}</strong><small>de réussite</small></span>
            <span><strong className="num">{finish ? short(finish) : '–'}</strong><small>fin estimée</small></span>
          </div>
          {st.enrolled && s.currentCourseId !== course.id && <button type="button" className="cd-main-btn" onClick={() => { store.setCurrentCourse(course.id); toast('Parcours principal mis à jour', 'success'); }}>Définir comme parcours principal</button>}
        </aside>
      </section>

      <div className="grid cd-grid">
        <section className="c8 cd-programme" aria-labelledby="prog-title">
          <div className="sec-head">
            <h2 id="prog-title">Programme du cours<span className="sec-count">{course.modules.length} modules</span></h2>
            <button type="button" className="link" onClick={() => { setAll(!all); setOpenMods({}); }}>{all ? 'Tout replier' : 'Tout déplier'}<Icon name="chevronDown" size={14} /></button>
          </div>
          <ol className="modules">
            {course.modules.map((m) => <ModuleCard key={m.id} s={s} m={m} open={isOpen(m)} current={m.id === st.module?.id && st.pct < 100} onToggle={() => setOpenMods({ ...openMods, [m.id]: !isOpen(m) })} />)}
          </ol>
        </section>
        <div className="c4 cd-aside">
          <Outcomes s={s} course={course} />
          <Skills s={s} course={course} />
          <article className="cert">
            <span className="cert-ic"><Icon name="medal" size={24} /></span>
            <div><strong>Certificat {course.shortTitle}{course.cefr ? ` ${course.cefr}` : ''}</strong><small>{st.pct >= 100 ? 'Disponible : bravo pour ce parcours complet !' : 'Disponible à la fin du parcours, avec ta note globale.'}</small></div>
          </article>
        </div>
      </div>
    </div>
  );
}

function lessonState(s: LearnerState, l: Lesson, next?: Lesson) {
  const c = s.completions[l.id];
  if (c?.passed) return 'done' as const;
  if (next?.id === l.id) return 'next' as const;
  if (c && !c.passed) return 'retry' as const;
  return isPlayable(l) ? 'open' as const : 'locked' as const;
}

function ModuleCard({ s, m, open, current, onToggle }: { s: LearnerState; m: Module; open: boolean; current: boolean; onToggle: () => void }) {
  const ms = moduleStats(s, m);
  const c = getCourse(m.courseId)!;
  const next = courseStats(s, c).next;
  const anyPlayable = m.lessons.some(isPlayable);
  return (
    <li className={cx('module', ms.complete && 'is-done', current && 'is-current', !ms.complete && !current && !anyPlayable && 'is-locked')}>
      <button type="button" className="module-head" aria-expanded={open} aria-controls={`mod-${m.id}`} onClick={onToggle}>
        <span className="module-n">{ms.complete ? <Icon name="check" size={20} /> : <span className="num">{m.index}</span>}</span>
        <span className="module-title">
          <small>{current ? `Module ${m.index} en cours, ${ms.done} leçon${ms.done > 1 ? 's' : ''} sur ${ms.total} terminée${ms.done > 1 ? 's' : ''}` : `Module ${m.index}`}</small>
          <strong>{m.title}</strong>
        </span>
        <span className="module-side">
          {!current && <span className="module-meta">{ms.total} leçons{!ms.complete ? `, ${ms.minutes} min` : ''}</span>}
          {ms.result ? <span className={cx('pill', ms.result.passed ? 'pill-mint' : 'pill-gold')}><Icon name="medal" size={13} />Évaluation {ms.result.score}/{ms.result.total}</span>
            : current && ms.assess ? <span className="pill pill-blue">Évaluation à {Math.round((ms.assess.passMark ?? 0.7) * 100)} %</span>
            : !ms.complete && !anyPlayable ? <Icon name="lock" size={16} className="module-lock" /> : null}
          <Icon name="chevronDown" size={18} className="module-chev" />
        </span>
      </button>
      {open && (
        <ol className="lessons" id={`mod-${m.id}`}>
          {m.lessons.map((l) => {
            const state = lessonState(s, l, next);
            const comp = s.completions[l.id];
            return (
              <li key={l.id} className={cx('lesson-row', `is-${state}`)}>
                <span className={cx('lr-ic', `k-${l.kind}`)}><Icon name={KIND_ICON[l.kind]} size={17} /></span>
                <span className="lr-body">
                  <strong>{l.title}</strong>
                  <small>{KIND_LABEL[l.kind]}{comp ? `, ${comp.score} bonne${comp.score > 1 ? 's' : ''} réponse${comp.score > 1 ? 's' : ''} sur ${comp.total}` : l.questions ? `, ${l.questions.length} questions` : `, ${SKILL_LABEL[l.skill].toLowerCase()}`}{l.kind === 'assessment' && l.passMark ? `, ${Math.round(l.passMark * 100)} % pour valider` : ''}</small>
                </span>
                <span className="lr-min">{l.minutes} min</span>
                {state === 'done' ? <button type="button" className="lr-done" onClick={() => isPlayable(l) && navigate({ page: 'lesson', lessonId: l.id })} disabled={!isPlayable(l)} aria-label={`Terminée : ${l.title}${isPlayable(l) ? ', revoir' : ''}`}><Icon name="check" size={15} /></button>
                  : state === 'next' || state === 'retry' ? (isPlayable(l) ? <Button size="sm" icon="play" onClick={() => navigate({ page: 'lesson', lessonId: l.id })}>{s.attempts[l.id] ? 'Reprendre' : state === 'retry' ? 'Retenter' : 'Commencer'}</Button> : <span className="lr-lock" aria-label="Bientôt disponible"><Icon name="lock" size={14} /></span>)
                  : state === 'open' ? <button type="button" className="round-play" onClick={() => navigate({ page: 'lesson', lessonId: l.id })} aria-label={`Ouvrir : ${l.title}`}><Icon name="play" size={12} /></button>
                  : <span className="lr-lock" aria-label="Bientôt disponible"><Icon name="lock" size={14} /></span>}
              </li>
            );
          })}
        </ol>
      )}
    </li>
  );
}

function Outcomes({ s, course }: { s: LearnerState; course: Course }) {
  const items = course.outcomes ?? course.modules.flatMap((m) => m.competencies.map((c) => c.label)).slice(0, 4);
  const pct = courseStats(s, course).pct;
  return (
    <section className="card outcomes" aria-labelledby="out-title">
      <h2 id="out-title">Ce que tu sauras faire</h2>
      <ul>{items.map((t, i) => <li key={t}><Check on={pct >= ((i + 1) / items.length) * 100 - 1} /><span>{t}</span></li>)}</ul>
    </section>
  );
}

function Skills({ s, course }: { s: LearnerState; course: Course }) {
  const skills = skillLevels(s, course.id).slice(0, 5);
  return (
    <section className="card skills-card" aria-labelledby="sk-title">
      <div className="card-head"><h2 id="sk-title">Tes compétences</h2><button type="button" className="link" onClick={() => navigate({ page: 'progress' })}>Détails</button></div>
      <ul className="skill-list">
        {skills.map((x) => (
          <li key={x.skill}>
            <div><strong>{x.label}</strong><small>{x.count ? `Niveau ${x.level} sur 5` : 'À découvrir'}</small></div>
            <Segments values={[0, 1, 2, 3, 4].map((k) => (k < x.level ? 1 : k === x.level ? x.toNext : 0))} label={`${x.label} : niveau ${x.level} sur 5`} />
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------- Léa's panel on a course page
function CourseRail({ route }: { route: Route }) {
  const s = useLearner();
  const c = getCourse(route.courseId ?? '');
  if (!c) return null;
  const st = courseStats(s, c);
  const list = c.modules.filter((m) => m.lessons.some((l) => l.kind === 'assessment')).map((m) => ({ m, ms: moduleStats(s, m) }));
  const done = list.filter((x) => x.ms.result);
  const avg = done.length ? Math.round((done.reduce((a, x) => a + x.ms.result!.score / x.ms.result!.total, 0) / done.length) * 100) : null;
  const na = nextAssessment(s, c);
  const p = pace(s, c.id);
  const when = na && p > 0 ? addDays(startOfDay(new Date()), Math.max(1, Math.ceil(na.before / p))) : null;
  const lastDone = [...done].pop();
  return (
    <>
      <section className="rail-sec" aria-labelledby="ev-title">
        <div className="rail-sec-head"><h3 id="ev-title">Tes évaluations</h3>{avg !== null && <span className="muted">moyenne {avg} %</span>}</div>
        <ul className="evals">
          {list.slice(0, 5).map(({ m, ms }) => (
            <li key={m.id} className={cx(ms.result?.passed && 'done', na?.module.id === m.id && 'next')}>
              <Check on={!!ms.result?.passed} />
              <span className="ev-title">Module {m.index} : {m.title.split(/ et | – /)[0]}</span>
              <span className="ev-score num">{ms.result ? `${ms.result.score}/${ms.result.total}` : na?.module.id === m.id && when ? (daysBetween(new Date(), when) <= 6 ? `${dayName(when.getDay())} ?` : short(when)) : '–'}</span>
            </li>
          ))}
        </ul>
      </section>
      {st.enrolled && (() => {
        const chips: [string, IconName][] = [...(lastDone ? [[`Réviser le module ${lastDone.m.index}`, 'replay'] as [string, IconName]] : []), ...(na ? [['M’entraîner à l’évaluation', 'target'] as [string, IconName]] : []), [`Résumer le module ${st.module?.index ?? 1}`, 'text']];
        return <AskChips items={chips.map((x) => x[0])} icons={chips.map((x) => x[1])} />;
      })()}
    </>
  );
}
registerRail('course', CourseRail);
