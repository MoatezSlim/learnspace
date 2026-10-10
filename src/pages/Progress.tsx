import React, { useMemo, useState } from 'react';
import { useLearner } from '../state/store';
import { courseStats, progressSeries, dailySeries, weeklySeries, streak, totalMinutes, weekMinutes, skillLevels, competencies, assessments, averageScore } from '../state/selectors';
import { COURSES, getCourse, getLesson, SKILL_LABEL, KIND_LABEL } from '../data/courses';
import { navigate } from '../router';
import { Lea } from '../assistant/Lea';
import { openAssistant } from '../assistant/AssistantPanels';
import { Button, ProgressBar, Ring, Pill, cx } from '../components/ui';
import { Icon, IconName } from '../components/icons';
import { AreaChart, BarChart, DataTable, Point, useChartToggle } from '../components/charts';
import { minutesLabel, shortDate, weekday, relative } from '../lib/dates';
import type { SkillId } from '../types';

type Tab = 'overview' | 'skills' | 'history';
const SKILL_ICON: Partial<Record<SkillId, IconName>> = { listening: 'headphones', vocabulary: 'book', grammar: 'library', speaking: 'chat', reading: 'text', writing: 'pencil' };
const SKILL_TONE: Partial<Record<SkillId, string>> = { listening: 'blue', vocabulary: 'green', grammar: 'violet', speaking: 'amber', reading: 'blue', writing: 'green' };

export function ProgressPage() {
  const s = useLearner();
  const [tab, setTab] = useState<Tab>('overview');
  const [days, setDays] = useState(7);
  const course = getCourse(s.currentCourseId)!;
  const st = courseStats(s, course);
  const sk = streak(s);
  const total = totalMinutes(s); const week = weekMinutes(s);
  const skills = skillLevels(s, course.id);
  const comp = competencies(s, course.id);

  const line: Point[] = useMemo(() => progressSeries(s, course.id, days).map((p) => ({ label: `${weekday(p.date)} ${shortDate(p.date)}`, short: shortDate(p.date), value: p.value })), [s, course.id, days]);
  const bars: Point[] = useMemo(() => days <= 30
    ? dailySeries(s, days).map((p) => ({ label: `${weekday(p.date)} ${shortDate(p.date)}`, short: days === 7 ? weekday(p.date) : shortDate(p.date), value: p.minutes }))
    : weeklySeries(s, 13).map((p) => ({ label: `Semaine du ${shortDate(p.date)}`, short: shortDate(p.date), value: p.minutes })), [s, days]);
  const lineToggle = useChartToggle(); const barToggle = useChartToggle();
  const first = line[0]?.value ?? 0; const gain = st.pct - first;

  const tabs: { id: Tab; label: string }[] = [{ id: 'overview', label: 'Vue d’ensemble' }, { id: 'skills', label: 'Compétences' }, { id: 'history', label: 'Historique' }];

  return (
    <div className="page progress">
      <header className="page-head row-between">
        <h1>Ma progression</h1>
        <label className="select-wrap"><span className="sr-only">Période</span>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Période affichée">
            <option value={7}>7 jours</option><option value={30}>30 jours</option><option value={90}>90 jours</option>
          </select>
        </label>
      </header>
      <div className="tabs" role="tablist" aria-label="Sections de la progression">
        {tabs.map((t) => <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} className={cx('tab', tab === t.id && 'active')} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>

      {tab === 'overview' && (
        <div id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" className="stack">
          <section className="prog-stats">
            <article className="card stat-card"><Ring value={st.pct} size={70} stroke={8} /><div className="stat-body"><span className="card-label">Progression globale</span><strong className="stat-value">{st.done} / {st.total} leçons</strong><span className="stat-delta">{course.shortTitle} · {course.cefr}</span></div></article>
            <article className="card stat-card"><span className="stat-icon tone-blue"><Icon name="clock" size={22} /></span><div className="stat-body"><span className="card-label">Temps d’apprentissage</span><strong className="stat-value">{minutesLabel(total)}</strong><span className={cx('stat-delta', week > 0 && 'up')}>+{minutesLabel(week)} cette semaine</span></div></article>
            <article className="card stat-card"><span className="stat-icon tone-amber"><Icon name="flame" size={22} /></span><div className="stat-body"><span className="card-label">Série actuelle</span><strong className="stat-value">{sk.days} jour{sk.days > 1 ? 's' : ''}</strong><span className="stat-delta">{sk.todayActive ? '+1 aujourd’hui' : 'Apprends aujourd’hui pour la prolonger'} · record {sk.best} j</span></div></article>
          </section>

          <section className="prog-row">
            <article className="card chart-card">
              <div className="card-head"><h2>Évolution de ma progression</h2>{lineToggle.button}</div>
              <p className="muted small">Part du parcours {course.shortTitle.toLowerCase()} terminée, jour par jour{gain > 0 ? ` · +${gain} points sur la période` : ''}.</p>
              {lineToggle.table ? <DataTable caption="Évolution de la progression" rows={line} unit="%" /> : <AreaChart data={line} title="Évolution de ma progression" />}
            </article>
            <aside className="card coach-card">
              <div className="coach-stage"><Lea framing="bust" /></div>
              <div className="coach-body">
                <h2>{st.pct >= 50 ? 'Tu as dépassé la moitié de ton parcours !' : 'Tu avances bien !'}</h2>
                <p className="muted">{st.pct >= 50 ? `${st.pct} % du parcours est terminé. Continue comme ça, tu vas atteindre ton niveau !` : `Encore ${50 - st.pct} points pour atteindre la mi-parcours.`}</p>
                <Button block icon="chat" onClick={() => openAssistant(true)}>Faire le point avec Léa</Button>
              </div>
            </aside>
          </section>

          <section>
            <div className="section-head"><h2>Compétences acquises</h2><button type="button" className="link-inline" onClick={() => setTab('skills')}>Détail des compétences</button></div>
            <div className="skill-tiles">
              {skills.filter((x) => ['listening', 'vocabulary', 'grammar', 'speaking'].includes(x.skill)).map((x) => (
                <article key={x.skill} className="card skill-tile">
                  <span className={cx('stat-icon', `tone-${SKILL_TONE[x.skill] ?? 'blue'}`)}><Icon name={SKILL_ICON[x.skill] ?? 'star'} size={22} /></span>
                  <strong>{x.label}</strong>
                  <span className="skill-level">Niv. {x.level}</span>
                  <ProgressBar value={x.toNext * 100} size="sm" label={`${x.label} : vers le niveau ${x.level + 1}`} />
                  <small className="muted">{x.nextAt ? `${x.count} / ${x.nextAt} leçons pour le niv. ${x.level + 1}` : 'Niveau maximal'}</small>
                </article>
              ))}
            </div>
          </section>

          <section className="prog-row two">
            <article className="card chart-card">
              <div className="card-head"><h2>{days <= 30 ? 'Temps d’apprentissage par jour' : 'Temps d’apprentissage par semaine'}</h2>{barToggle.button}</div>
              <p className="muted small">{days <= 30 ? `Minutes par jour sur ${days} jours · objectif ${s.profile.dailyGoalMin} min.` : 'Minutes par semaine sur 13 semaines.'}</p>
              {barToggle.table ? <DataTable caption="Temps d’apprentissage" rows={bars} unit="min" /> : <BarChart data={bars} goal={days <= 30 ? s.profile.dailyGoalMin : undefined} title="Temps d’apprentissage" />}
            </article>
            <article className="card">
              <h2>Résultats aux évaluations</h2>
              <p className="muted small">Score du premier essai · validation à 70 %. Moyenne sur 30 jours : {averageScore(s) ?? '–'} %.</p>
              <ul className="assess">
                {assessments(s).map((a) => (
                  <li key={a.lesson.id}>
                    <span className="assess-name">{getCourse(a.lesson.courseId)!.shortTitle} · {a.lesson.title.replace('Évaluation du ', '')}</span>
                    <span className="assess-bar"><span style={{ width: `${a.pct}%` }} className={a.pct >= 70 ? 'ok' : 'ko'} /><i style={{ left: '70%' }} aria-hidden="true" /></span>
                    <span className="assess-val">{a.pct} %</span>
                    <Pill tone={a.pct >= 70 ? 'green' : 'amber'} icon={a.pct >= 70 ? 'check' : 'alert'}>{a.pct >= 70 ? 'Validé' : 'À repasser'}</Pill>
                  </li>
                ))}
                {assessments(s).length === 0 && <li className="muted">Aucune évaluation passée pour l’instant.</li>}
              </ul>
            </article>
          </section>

          <section className="card">
            <div className="section-head"><h2>Progression par cours</h2><button type="button" className="link-inline" onClick={() => navigate({ page: 'courses' })}>Mes cours</button></div>
            <ul className="course-progress-list">
              {COURSES.filter((c) => s.enrollments[c.id]).map((c) => { const cs = courseStats(s, c); return (
                <li key={c.id}><button type="button" onClick={() => navigate({ page: 'course', courseId: c.id })}><span className="cpl-name">{c.title}</span><ProgressBar value={cs.pct} size="sm" label={`${c.title} : ${cs.pct} %`} /><span className="cpl-val">{cs.done}/{cs.total} · {cs.pct}%</span></button></li>
              ); })}
            </ul>
          </section>
        </div>
      )}

      {tab === 'skills' && (
        <div id="panel-skills" role="tabpanel" aria-labelledby="tab-skills" className="stack">
          <section className="card">
            <h2>Niveaux par compétence · {course.shortTitle}</h2>
            <p className="muted small">Un niveau se gagne en terminant des leçons de la compétence : 3, 6, 10, 15 puis 21 leçons.</p>
            <ul className="skill-rows">
              {skills.map((x) => (
                <li key={x.skill}><span className="sr-name"><Icon name={SKILL_ICON[x.skill] ?? 'star'} size={16} />{x.label}</span><ProgressBar value={x.toNext * 100} size="sm" label={`${x.label} vers le niveau suivant`} /><span className="sr-val">Niv. {x.level} · {x.count} leçon{x.count > 1 ? 's' : ''}</span></li>
              ))}
            </ul>
          </section>
          <section className="card">
            <h2>Compétences du parcours <span className="muted">· {comp.acquired} / {comp.total}</span></h2>
            <ul className="comp-list">
              {comp.list.map((c) => (
                <li key={c.id} className={cx(c.acquired && 'ok')}>
                  <span className="comp-icon"><Icon name={c.acquired ? 'check' : 'target'} size={16} /></span>
                  <span><strong>{c.label}</strong><small>Module {c.module.index} · {c.done} / {c.lessonIds.length} leçons{c.acquiredAt ? ` · acquise ${relative(c.acquiredAt)}` : ''}</small></span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {tab === 'history' && (
        <div id="panel-history" role="tabpanel" aria-labelledby="tab-history" className="stack">
          <section className="card">
            <h2>Leçons terminées récemment</h2>
            <ul className="history">
              {Object.entries(s.completions).sort((a, b) => (a[1].at < b[1].at ? 1 : -1)).slice(0, 25).map(([id, c]) => {
                const l = getLesson(id); if (!l) return null; const course = getCourse(l.courseId)!;
                return (
                  <li key={id}>
                    <time dateTime={c.at}>{shortDate(new Date(c.at))}</time>
                    <span><strong>{l.title}</strong><small>{course.shortTitle} · {KIND_LABEL[l.kind]} · {SKILL_LABEL[l.skill]} · {c.minutes} min</small></span>
                    <Pill tone={c.passed ? (c.score === c.total ? 'green' : 'blue') : 'amber'}>{c.score}/{c.total}</Pill>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
