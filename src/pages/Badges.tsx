import React, { useState } from 'react';
import { useLearner } from '../state/store';
import { ACHIEVEMENTS, AchievementDef } from '../state/achievements';
import { recommendation } from '../state/selectors';
import { bestStreak, bestDay, perfectCount } from '../state/insights';
import { navigate } from '../router';
import { Button, Medal, ProgressBar, Seg } from '../components/ui';
import { Icon } from '../components/icons';
import { AskChips, registerRail } from '../assistant/LeaDock';
import { nextBadges, BADGE_UNIT, badgeLeft } from '../assistant/pageLines';
import { BADGE_TONE } from './Dashboard';
import { daysBetween } from '../lib/dates';
import type { LearnerState, Route } from '../types';

const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const earnedLabel = (iso: string) => {
  const d = new Date(iso); const n = daysBetween(d, new Date());
  return n === 0 ? 'Gagné aujourd’hui' : n === 1 ? 'Gagné hier' : `Gagné le ${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`;
};
const unitOf = (a: AchievementDef, n: number) => (BADGE_UNIT[a.id] ? (n > 1 ? BADGE_UNIT[a.id][1] : BADGE_UNIT[a.id][0]) : '');

/** What to do to move a badge forward. */
function actionFor(a: AchievementDef, s: LearnerState): { label: string; go: () => void } {
  const rec = recommendation(s);
  if (a.id === 'curious') return { label: 'Poser une question', go: () => navigate({ page: 'messages' }) };
  if (rec) return { label: a.id === 'marathon' || a.id.startsWith('streak') ? 'Apprendre maintenant' : 'Faire la leçon', go: () => navigate({ page: 'lesson', lessonId: rec.lesson.id }) };
  return { label: 'Voir mes cours', go: () => navigate({ page: 'courses' }) };
}

export function BadgesPage() {
  const s = useLearner();
  const [filter, setFilter] = useState<'all' | 'earned' | 'locked'>('all');
  const earned = ACHIEVEMENTS.filter((a) => s.achievements[a.id]).sort((a, b) => (s.achievements[a.id] < s.achievements[b.id] ? -1 : 1));
  const locked = nextBadges(s);
  const next = locked[0];
  const rec = recommendation(s);
  const newest = [...earned].pop();
  return (
    <div className="page badges-page">
      <header className="page-head">
        <div>
          <h1>Badges</h1>
          <p className="lead">{earned.length} badge{earned.length > 1 ? 's' : ''} gagné{earned.length > 1 ? 's' : ''} sur {ACHIEVEMENTS.length}.{next ? ` Le prochain est à ${badgeLeft(next.a.id, next.left)} de toi.` : ' Tu les as tous !'}</p>
        </div>
        <Seg label="Afficher" value={filter} onChange={setFilter} options={[{ id: 'all', label: 'Tous' }, { id: 'earned', label: 'Gagnés' }, { id: 'locked', label: 'À débloquer' }]} />
      </header>
      {next && filter !== 'earned' && (
        <section className="next-badge" aria-labelledby="nb-title">
          <div className="nb-medal"><Medal icon={next.a.icon} tone={BADGE_TONE[next.a.id] ?? 'gold'} size={150} /></div>
          <div className="nb-main">
            <span className="nb-kicker"><Icon name="sparkle" size={14} />Prochain badge</span>
            <h2 id="nb-title">{next.a.title}</h2>
            <p>{next.a.description.replace(/\.$/, '')}.{next.left === 1 && rec && ['quarter', 'ten', 'first', 'listener'].includes(next.a.id) ? ` Il ne t’en reste qu’une : « ${rec.lesson.title} ».` : ` Encore ${badgeLeft(next.a.id, next.left)}.`}</p>
            <div className="nb-progress"><ProgressBar value={next.ratio * 100} tone="flame" label={`${next.a.title} : ${Math.min(next.p.cur, next.p.target)} sur ${next.p.target}`} /><b className="num">{Math.min(next.p.cur, next.p.target)} / {next.p.target}</b></div>
            <Button variant="navy" go onClick={actionFor(next.a, s).go}>{actionFor(next.a, s).label}</Button>
          </div>
          {locked.length > 1 && (
            <aside className="almost" aria-labelledby="almost-title">
              <h3 id="almost-title">Presque débloqués</h3>
              <ul>
                {locked.slice(1, 4).map((x) => (
                  <li key={x.a.id}>
                    <Medal icon={x.a.icon} tone={BADGE_TONE[x.a.id] ?? 'gold'} size={34} />
                    <span className="almost-body"><strong>{x.a.title}</strong><small>{Math.min(x.p.cur, x.p.target)} sur {x.p.target} {unitOf(x.a, x.p.target)}</small><ProgressBar value={x.ratio * 100} size="xs" tone="gold" label={`${Math.round(x.ratio * 100)} %`} /></span>
                    <b className="num">{Math.round(x.ratio * 100)} %</b>
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </section>
      )}
      {filter !== 'locked' && (
        <section aria-labelledby="earned-title">
          <div className="sec-head"><h2 id="earned-title">Gagnés<span className="sec-count">{earned.length} badge{earned.length > 1 ? 's' : ''}</span></h2></div>
          <div className="badge-grid">
            {earned.map((a) => (
              <article key={a.id} className="card badge-card is-earned" style={{ ['--glow' as string]: `var(--${BADGE_TONE[a.id] === 'mint' ? 'mint' : BADGE_TONE[a.id] === 'flame' ? 'flame' : BADGE_TONE[a.id] === 'gold' ? 'gold' : BADGE_TONE[a.id] === 'coral' ? 'coral' : BADGE_TONE[a.id] === 'violet' ? 'violet' : 'blue'})` }}>
                {a.id === newest?.id && daysBetween(new Date(s.achievements[a.id]), new Date()) <= 2 && <span className="badge-new">Nouveau</span>}
                <Medal icon={a.icon} tone={BADGE_TONE[a.id]} size={64} />
                <h3>{a.title}</h3>
                <p>{a.description}</p>
                <span className="pill pill-mint"><Icon name="check" size={13} />{earnedLabel(s.achievements[a.id])}</span>
              </article>
            ))}
          </div>
        </section>
      )}
      {filter !== 'earned' && locked.length > 0 && (
        <section aria-labelledby="locked-title">
          <div className="sec-head"><h2 id="locked-title">À débloquer<span className="sec-count">{locked.length} badge{locked.length > 1 ? 's' : ''}</span></h2></div>
          <div className="badge-grid">
            {locked.map((x) => (
              <article key={x.a.id} className="card badge-card is-locked">
                <span className="badge-lock" aria-hidden="true"><Icon name="lock" size={14} /></span>
                <Medal icon={x.a.icon} locked size={64} />
                <h3>{x.a.title}</h3>
                <p>{x.a.description}</p>
                <div className="badge-prog">
                  <ProgressBar value={x.ratio * 100} size="sm" label={`${x.a.title} : ${Math.min(x.p.cur, x.p.target)} sur ${x.p.target}`} />
                  <span><b>{Math.min(x.p.cur, x.p.target)}</b> sur {x.p.target} {unitOf(x.a, x.p.target)}<em>{Math.round(x.ratio * 100)} %</em></span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Léa's panel on the badges page
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
function BadgesRail(_: { route: Route }) {
  const s = useLearner();
  const bs = bestStreak(s);
  const bd = bestDay(s, new Date(2000, 0, 1));
  const perfect = perfectCount(s);
  const curious = ACHIEVEMENTS.find((a) => a.id === 'curious')!;
  const nb = nextBadges(s).find((x) => x.a.id !== 'quarter') ?? nextBadges(s)[0];
  return (
    <>
      <section className="rail-sec" aria-labelledby="rec-title">
        <div className="rail-sec-head"><h3 id="rec-title">Tes records</h3></div>
        <ul className="facts">
          {bs && <li className="fact"><span className="fact-ic is-flame"><Icon name="flameSolid" size={18} /></span><span className="fact-body"><strong>{bs.days} jours de suite</strong><small>Du {bs.start.getDate()} {MONTHS[bs.start.getMonth()]} au {bs.end.getDate()} {MONTHS[bs.end.getMonth()]}</small></span></li>}
          {bd && <li className="fact"><span className="fact-ic"><Icon name="clock" size={18} /></span><span className="fact-body"><strong>{bd.minutes} minutes en une journée</strong><small>Le {bd.date.getDate()} {MONTHS[bd.date.getMonth()]}.{!s.achievements.marathon ? ' Marathon demande 60 minutes.' : ''}</small></span></li>}
          <li className="fact"><span className="fact-ic is-gold"><Icon name="star" size={18} /></span><span className="fact-body"><strong>{perfect} leçon{perfect > 1 ? 's' : ''} sans faute</strong><small>Toutes les réponses justes du premier coup</small></span></li>
        </ul>
      </section>
      <AskChips items={[!s.achievements.curious ? `Comment gagner « ${curious.title} » ?` : nb ? `Comment gagner « ${nb.a.title} » ?` : 'Mes prochains badges', 'Mes prochains badges']} icons={['chat', 'medal']} />
    </>
  );
}
registerRail('badges', BadgesRail);
