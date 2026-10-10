import React, { useMemo, useState } from 'react';
import { useLearner } from '../state/store';
import { courseStats, streak, assessments, competencies } from '../state/selectors';
import { activeDays, firstActiveDay, periodMinutes, minutesBetween, lessonsDone, accuracy, heatmap, bestWeekday, bestStreak, skillInsights, dailyMinutes, cumulativeLessons, streakSeries, accuracySeries, risingSkill, bestDay, periodStart } from '../state/insights';
import { COURSES, getCourse, SKILL_LABEL } from '../data/courses';
import { navigate } from '../router';
import { Seg, downloadText, toast, ProgressBar } from '../components/ui';
import { Icon, Flag } from '../components/icons';
import { Spark, Heatmap, Radar } from '../components/charts';
import { AskChips, registerRail } from '../assistant/LeaDock';
import { minutesLabel, addDays, startOfDay, daysBetween } from '../lib/dates';
import type { LearnerState, Route, SkillId } from '../types';

type P = '7' | '30' | 'all';
const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const longDay = (d: Date) => `${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`;
const SKILL_SHORT: Record<SkillId, string> = { listening: 'Écoute', vocabulary: 'Vocabulaire', grammar: 'Grammaire', speaking: 'Oral', reading: 'Lecture', writing: 'Écrit', method: 'Méthode', culture: 'Culture' };
const partOfMonth = (d: Date) => `${d.getDate() <= 10 ? 'début' : d.getDate() <= 20 ? 'mi' : 'fin'} ${MONTHS_LONG[d.getMonth()]}`.replace('mi ', 'mi-');
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function Hours({ min }: { min: number }) {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? <>{h}<small>h</small>{String(m).padStart(2, '0')}</> : <>{m}<small> min</small></>;
}

export function ProgressPage() {
  const s = useLearner();
  const [p, setP] = useState<P>('all');
  const now = new Date();
  const first = firstActiveDay(s);
  const since = p === 'all' ? null : startOfDay(addDays(now, -(Number(p) - 1)));
  const days = activeDays(s);
  const sinceDays = first ? daysBetween(first, now) + 1 : 0;
  const k = useMemo(() => {
    const minutes = since ? minutesBetween(s, since, now) : periodMinutes(s, 'all');
    const lessons = lessonsDone(s, since ?? undefined);
    const mainLessons = lessonsDone(s, since ?? undefined, s.currentCourseId);
    const acc = accuracy(s, { since: since ?? undefined });
    const sparkDays = p === '7' ? 7 : p === '30' ? 30 : 60;
    return { minutes: Math.round(minutes), lessons, mainLessons, acc, sparkDays };
  }, [s, p]); // eslint-disable-line react-hooks/exhaustive-deps
  const week = periodMinutes(s, 'week', now);
  const sk = streak(s); const best = bestStreak(s);
  const main = getCourse(s.currentCourseId)!;
  const periodWord = p === '7' ? 'sur les 7 derniers jours' : p === '30' ? 'sur les 30 derniers jours' : null;
  return (
    <div className="page progress-page">
      <header className="page-head">
        <div>
          <h1>Ta progression</h1>
          <p className="lead">{first ? `Depuis le ${longDay(first)} : ${days.length} jours d’apprentissage et ${lessonsDone(s)} leçons terminées.` : 'Termine une leçon pour voir ta progression ici.'}</p>
        </div>
        <Seg label="Période" value={p} onChange={setP} options={[{ id: '7', label: '7 jours' }, { id: '30', label: '30 jours' }, { id: 'all', label: 'Depuis le début' }]} />
      </header>
      <section className="card kpis" aria-label="Chiffres clés">
        <div className="kpi">
          <span className="kpi-top"><span className="kpi-ic is-blue"><Icon name="clock" size={16} /></span>Temps d’apprentissage</span>
          <div className="kpi-row"><strong className="kpi-value num"><Hours min={k.minutes} /></strong><Spark values={dailyMinutes(s, k.sparkDays)} color="#2F6BFF" label="Minutes par jour" /></div>
          <small>{periodWord ?? <><b className="up">+{minutesLabel(week)}</b> cette semaine</>}</small>
        </div>
        <div className="kpi">
          <span className="kpi-top"><span className="kpi-ic is-mint"><Icon name="check" size={16} /></span>Leçons terminées</span>
          <div className="kpi-row"><strong className="kpi-value num">{k.lessons}</strong><Spark values={cumulativeLessons(s, k.sparkDays)} color="#16A472" label="Leçons terminées, cumul" /></div>
          <small>dont {k.mainLessons} dans ton parcours principal{periodWord ? `, ${periodWord}` : ''}</small>
        </div>
        <div className="kpi">
          <span className="kpi-top"><span className="kpi-ic is-flame"><Icon name="flameSolid" size={16} /></span>Série actuelle</span>
          <div className="kpi-row"><strong className="kpi-value num">{sk.days}<small> jour{sk.days > 1 ? 's' : ''}</small></strong><Spark values={streakSeries(s, Math.min(k.sparkDays, 45))} color="#FF7A2F" label="Série jour après jour" /></div>
          <small>{best ? `Ton record : ${best.days} jours, ${partOfMonth(best.end)}` : 'Apprends deux jours de suite pour lancer ta série'}</small>
        </div>
        <div className="kpi">
          <span className="kpi-top"><span className="kpi-ic is-gold"><Icon name="target" size={16} /></span>Bonnes réponses</span>
          <div className="kpi-row"><strong className="kpi-value num">{k.acc.pct ?? '–'}<small>%</small></strong><Spark values={accuracySeries(s, k.sparkDays)} color="#EFA92A" label="Bonnes réponses du premier coup" /></div>
          <small>{k.acc.right} réponses justes sur {k.acc.total}{periodWord ? ` ${periodWord}` : ''}</small>
        </div>
      </section>
      <div className="grid prog-grid">
        <Regularity s={s} sinceDays={sinceDays} />
        <SkillsRadar s={s} courseId={main.id} />
        <PerCourse s={s} />
        <Evaluations s={s} />
      </div>
    </div>
  );
}

function Regularity({ s, sinceDays }: { s: LearnerState; sinceDays: number }) {
  const now = new Date();
  const weeks = Math.max(9, Math.min(13, Math.ceil((sinceDays + ((now.getDay() + 6) % 7)) / 7)));
  const cols = heatmap(s, weeks, now);
  const shown = cols.flat().filter((d) => !d.future);
  const active = shown.filter((d) => d.minutes > 0);
  const avg = active.length ? Math.round(active.reduce((a, d) => a + d.minutes, 0) / active.length) : 0;
  const bw = bestWeekday(s, now);
  const exportCsv = () => {
    const rows = Object.entries(s.activity).sort().map(([d, m]) => `${d};${Math.round(m)}`);
    if (downloadText('learnspace-temps-par-jour.csv', ['date;minutes', ...rows].join('\n'), 'text/csv;charset=utf-8')) toast('Export téléchargé', 'success');
  };
  return (
    <section className="card c7 regularity" aria-labelledby="reg-title">
      <div className="card-head">
        <div><h2 id="reg-title">Ta régularité</h2><p className="muted">Chaque case est une journée. Plus elle est foncée, plus tu as appris.</p></div>
        <button type="button" className="link" onClick={exportCsv}><Icon name="download" size={15} />Exporter</button>
      </div>
      <div className="reg-body">
        <div style={{ ['--hm-cols' as string]: weeks }}><Heatmap cols={cols} today={now} /></div>
        <div className="reg-stats">
          <div><strong className="num">{active.length} jours</strong><small>actifs sur {shown.length}</small></div>
          <div><strong className="num">{avg} min</strong><small>par jour actif, en moyenne</small></div>
          <div><strong>{cap(bw.name)}</strong><small>ton jour le plus régulier</small></div>
        </div>
      </div>
    </section>
  );
}

function SkillsRadar({ s, courseId }: { s: LearnerState; courseId: string }) {
  const ins = skillInsights(s, courseId);
  const comp = competencies(s, courseId);
  const items = ins.skills.slice(0, 6).map((x) => ({ label: SKILL_SHORT[x.skill], sub: x.count ? `Niveau ${x.level}` : 'À découvrir', value: x.level + (x.count ? x.toNext * 0.6 : 0) }));
  return (
    <section className="card c5 radar-card" aria-labelledby="rad-title">
      <div className="card-head"><h2 id="rad-title">Tes compétences</h2><span className="pill pill-mint">{comp.acquired} sur {comp.total}</span></div>
      <Radar items={items} max={5} size={300} />
      {ins.rising && (
        <div className="insight">
          <span className="insight-ic"><Icon name="ear" size={18} /></span>
          <div><strong>{SKILL_SHORT[ins.rising.skill]} : niveau {ins.rising.level + 1} dans {ins.rising.left} leçon{ins.rising.left > 1 ? 's' : ''}</strong><small>La compétence la plus proche du niveau suivant</small></div>
        </div>
      )}
    </section>
  );
}

function PerCourse({ s }: { s: LearnerState }) {
  const list = COURSES.filter((c) => s.enrollments[c.id]).map((c) => ({ c, st: courseStats(s, c) })).sort((a, b) => (a.c.id === s.currentCourseId ? -1 : b.c.id === s.currentCourseId ? 1 : b.st.pct - a.st.pct));
  return (
    <section className="card c6 per-course-card" aria-labelledby="pc-title">
      <div className="card-head"><h2 id="pc-title">Avancement par cours</h2><button type="button" className="link" onClick={() => navigate({ page: 'courses' })}>Mes cours<Icon name="chevronRight" size={14} /></button></div>
      <ul className="pc-list">
        {list.map(({ c, st }) => (
          <li key={c.id}>
            <button type="button" onClick={() => navigate({ page: 'course', courseId: c.id })}>
              {c.flag ? <Flag code={c.flag} size={30} /> : <span className="pc-dot" />}
              <span className="pc-name"><strong>{c.shortTitle}</strong><small>{c.cefr ?? ''}{c.id === s.currentCourseId ? `${c.cefr ? ', ' : ''}parcours principal` : ''}</small></span>
              <ProgressBar value={st.pct} tone={c.id === s.currentCourseId ? 'blue' : 'soft'} label={`${c.title} : ${st.pct} %`} />
              <b className="num">{st.pct} %</b>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Evaluations({ s }: { s: LearnerState }) {
  const list = [...assessments(s)].reverse();
  const avg = list.length ? Math.round(list.reduce((a, x) => a + x.pct, 0) / list.length) : null;
  return (
    <section className="card c6 evals-card" aria-labelledby="ev2-title">
      <div className="card-head"><h2 id="ev2-title">Tes évaluations</h2>{avg !== null && <span className="pill pill-neutral">Moyenne {avg} %</span>}</div>
      {list.length === 0 ? <p className="muted">Aucune évaluation passée pour l’instant : elles concluent chaque module.</p> : (
        <ul className="ev-list">
          {list.slice(0, 5).map((a) => {
            const c = getCourse(a.lesson.courseId)!;
            const m = c.modules.find((x) => x.id === a.lesson.moduleId)!;
            return (
              <li key={a.lesson.id}>
                {c.flag ? <Flag code={c.flag} size={34} /> : <span className="pc-dot" />}
                <span className="ev-name"><strong>{c.shortTitle}, module {m.index}</strong><small>{longDay(new Date(a.c.at))}</small></span>
                <span className="ev-res"><b className="num">{a.c.score}/{a.c.total}</b><ProgressBar value={a.pct} size="xs" tone={a.pct >= 70 ? 'mint' : 'gold'} label={`${a.pct} %`} /></span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- Léa's panel on the progress page
function ProgressRail(_: { route: Route }) {
  const s = useLearner();
  const now = new Date();
  const wk = bestDay(s, periodStart('week', now), now);
  const month = bestDay(s, periodStart('month', now), now);
  const rising = risingSkill(s, now);
  const ins = skillInsights(s, s.currentCourseId);
  return (
    <>
      <section className="rail-sec" aria-labelledby="wk-title">
        <div className="rail-sec-head"><h3 id="wk-title">Ton bilan de la semaine</h3></div>
        <ul className="facts">
          {wk && <li className="fact"><span className="fact-ic"><Icon name="calendar" size={18} /></span><span className="fact-body"><strong>Meilleure journée : {['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][wk.date.getDay()]}</strong><small>{wk.minutes} minutes{month && month.minutes === wk.minutes ? ', ton record du mois' : ''}</small></span></li>}
          {rising && <li className="fact"><span className="fact-ic is-mint"><Icon name="trend" size={18} /></span><span className="fact-body"><strong>En hausse : {SKILL_LABEL[rising.skill].toLowerCase()}</strong><small>{rising.count} leçon{rising.count > 1 ? 's' : ''} ces deux dernières semaines</small></span></li>}
          {ins.fresh && <li className="fact"><span className="fact-ic is-gold"><Icon name="text" size={18} /></span><span className="fact-body"><strong>À découvrir : {SKILL_LABEL[ins.fresh.skill].toLowerCase()}</strong><small>{ins.firstOfFresh ? `Commence par « ${ins.firstOfFresh.title} »` : 'Bientôt dans ton parcours'}</small></span></li>}
        </ul>
      </section>
      <AskChips items={['Mon bilan du mois', 'Changer mon objectif']} icons={['history', 'target']} />
    </>
  );
}
registerRail('progress', ProgressRail);
