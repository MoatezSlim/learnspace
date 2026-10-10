// The subscription page: the current offer and its period, the two offers side by side, what Premium
// includes, and the invoices (each receipt can be opened and downloaded). Payments are a demonstration:
// no card details are ever asked for and nothing is charged.
import React, { useState } from 'react';
import { useLearner } from '../state/store';
import { overlays } from '../state/ui';
import { subscriptionInfo } from '../state/selectors';
import { estimatedFinish, lessonsDone, minutesBetween } from '../state/insights';
import { PLANS, PLAN_NAME, DEMO_METHOD, euros } from '../data/plans';
import { getCourse } from '../data/courses';
import { daysBetween, longDate, minutesLabel, numericDate, shortDate, shortDateY, spanLabel } from '../lib/dates';
import { Button, Dialog, IconButton, Pill, cx, downloadText, toast } from '../components/ui';
import { Icon, IconName } from '../components/icons';
import { LeaPhoto } from '../assistant/Lea';
import { AskChips, registerRail } from '../assistant/LeaDock';
import { yourCourse } from '../assistant/pageLines';
import type { Invoice, LearnerState, PlanId, Route } from '../types';

const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
/** « fin octobre », « mi-mars 2027 » */
const roughDate = (d: Date, now: Date) => `${d.getDate() <= 10 ? 'début' : d.getDate() <= 20 ? 'mi-' : 'fin'}${d.getDate() <= 10 || d.getDate() > 20 ? ' ' : ''}${MONTHS_LONG[d.getMonth()]}${d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : ''}`;
const planName = (id: PlanId) => `Premium ${PLANS[id].label.toLowerCase()}`;
/** What a year of the monthly offer costs more than the yearly one. */
const SAVING = PLANS.monthly.price * 12 - PLANS.yearly.price;

const INCLUDED: { icon: IconName; title: string; text: string }[] = [
  { icon: 'book', title: 'Tous les cours', text: 'Langues, code, business, arts…' },
  { icon: 'sparkle', title: 'Léa, sans limite', text: 'Questions, exercices, révisions' },
  { icon: 'headphones', title: 'Audios et vidéos', text: 'Avec transcriptions et traductions' },
  { icon: 'mortarboard', title: 'Certificats', text: 'À la fin de chaque parcours' },
  { icon: 'shield', title: 'Tes progrès gardés', text: 'Même après une pause' },
];

function receiptText(inv: Invoice, s: LearnerState) {
  const p = PLANS[inv.plan];
  return [
    'LearnSpace — Reçu de paiement',
    '',
    `Numéro : ${inv.id}`,
    `Date : ${numericDate(new Date(inv.at))}`,
    `Client : ${s.profile.firstName} ${s.profile.lastName}`,
    `Offre : ${PLAN_NAME} (${p.label.toLowerCase()})`,
    `Période : du ${numericDate(new Date(inv.from))} au ${numericDate(new Date(inv.to))}`,
    `Moyen de paiement : ${inv.method}`,
    `Montant : ${euros(inv.amount)}`,
    'Statut : payé',
    '',
    'Démonstration : aucun paiement réel n’a été effectué.',
    '',
  ].join('\n');
}

export function SubscriptionPage() {
  const s = useLearner();
  const now = new Date();
  const info = subscriptionInfo(s, now);
  const [receipt, setReceipt] = useState<Invoice | null>(null);
  const plan = info.plan;
  const last = s.subscription.invoices[s.subscription.invoices.length - 1];
  const start = last ? new Date(last.from) : new Date(s.subscription.startedAt);
  const spanDays = Math.max(1, daysBetween(start, info.until));
  const usedDays = Math.max(0, Math.min(spanDays, daysBetween(start, now)));
  const total = s.subscription.invoices.reduce((a, i) => a + i.amount, 0);
  const main = getCourse(s.currentCourseId);
  const finish = main ? estimatedFinish(s, main, now) : null;
  const monthsToFinish = finish ? Math.max(1, Math.ceil(daysBetween(now, finish) / 30.4)) : null;

  const status = info.state === 'expired'
    ? `${info.label}. Réactive-le pour retrouver tous tes cours.`
    : info.state === 'due'
      ? `${info.label}, le ${longDate(info.until, now)}.`
      : `Actif jusqu’au ${longDate(info.until, now)}.`;
  const pay = (id: PlanId | null) => overlays.openPayment(id);
  const download = (inv: Invoice) => {
    if (downloadText(`recu-${inv.id}.txt`, receiptText(inv, s))) toast(`Reçu ${inv.id} téléchargé`, 'success');
  };
  const downloadAll = () => {
    const rows = [['Numéro', 'Date', 'Offre', 'Début', 'Fin', 'Montant (EUR)', 'Moyen de paiement'].join(';')];
    for (const i of [...s.subscription.invoices].reverse()) {
      rows.push([i.id, numericDate(new Date(i.at)), planName(i.plan), numericDate(new Date(i.from)), numericDate(new Date(i.to)), i.amount.toFixed(2).replace('.', ','), i.method].join(';'));
    }
    if (downloadText('factures-learnspace.csv', `﻿${rows.join('\n')}\n`, 'text/csv;charset=utf-8')) toast('Factures téléchargées', 'success');
  };

  return (
    <div className="page sub-page">
      <header className="page-head">
        <div>
          <h1>Abonnement</h1>
          <p className="lead">Ton accès à tous les cours et à Léa. Paiements de démonstration : rien n’est jamais débité.</p>
        </div>
      </header>

      <section className={cx('sub-hero', `is-${info.state}`)} aria-labelledby="sub-title">
        <span className="sub-hero-glow" aria-hidden="true" />
        <div className="sub-main">
          <span className="sub-kicker"><span className="sub-crown"><Icon name="crown" size={17} /></span>{PLAN_NAME}</span>
          <h2 id="sub-title">{planName(plan.id)}</h2>
          <p className="sub-status"><i aria-hidden="true" />{status}</p>
          <div className="sub-period">
            <div className="sub-period-top">
              <span><small>Depuis le</small><b>{shortDateY(start, now)}</b></span>
              <span><small>Jusqu’au</small><b>{shortDateY(info.until, now)}</b></span>
            </div>
            <div className="sub-track" role="progressbar" aria-valuemin={0} aria-valuemax={spanDays} aria-valuenow={usedDays} aria-label={`Période en cours : ${usedDays} jours sur ${spanDays}`}>
              <i style={{ width: `${Math.round(info.elapsed * 100)}%` }} />
            </div>
            <small className="sub-left">{info.state === 'expired' ? 'Période terminée' : `${usedDays} jours sur ${spanDays} · ${info.daysLeft} jour${info.daysLeft > 1 ? 's' : ''} restant${info.daysLeft > 1 ? 's' : ''}`}</small>
          </div>
          <div className="sub-ctas">
            <Button variant="white" go onClick={() => pay(plan.id)}>{info.state === 'expired' ? 'Réactiver' : 'Renouveler'} pour {euros(plan.price)}</Button>
            {plan.id === 'monthly'
              ? <button type="button" className="hero-link" onClick={() => pay('yearly')}>Passer à l’offre annuelle</button>
              : <span className="sub-saved"><Icon name="check" size={15} />Tu économises {euros(SAVING)} par an</span>}
          </div>
        </div>
        <div className="sub-side">
          <div className="demo-card" role="img" aria-label="Moyen de paiement : carte de démonstration se terminant par 4242">
            <span className="dc-shine" aria-hidden="true" />
            <div className="dc-top"><span className="dc-chip" aria-hidden="true" /><span className="dc-brand"><Icon name="mortarboard" size={16} />LearnSpace</span></div>
            <span className="dc-label">Carte de démonstration</span>
            <span className="dc-num">•••• •••• •••• 4242</span>
            <div className="dc-foot">
              <span><small>Titulaire</small><b>{s.profile.firstName} {s.profile.lastName}</b></span>
              <span><small>Expire</small><b>12/29</b></span>
            </div>
          </div>
          <p className="dc-note"><Icon name="lock" size={14} />Aucune donnée bancaire n’est demandée</p>
        </div>
      </section>

      <section aria-labelledby="plans-title" className="plans-sec">
        <div className="sec-head"><h2 id="plans-title">Les offres</h2><span className="sec-count">Mêmes cours, même Léa : seul le prix change</span></div>
        <div className="plans">
          {(['monthly', 'yearly'] as PlanId[]).map((id) => {
            const p = PLANS[id];
            const current = plan.id === id;
            return (
              <article key={id} className={cx('card', 'offer', id === 'yearly' && 'is-best', current && 'is-current')} aria-labelledby={`offer-${id}`}>
                <header className="offer-head">
                  <h3 id={`offer-${id}`}>{p.label}</h3>
                  {current ? <Pill tone="blue" icon="check">Ton offre</Pill> : id === 'yearly' && <span className="offer-ribbon"><Icon name="star" size={13} />Recommandé · {p.note}</span>}
                </header>
                <div className="offer-price"><strong className="num">{euros(p.price)}</strong><span>/ {p.per}</span></div>
                <p className="offer-sub">{id === 'yearly' ? <>soit <b>{euros(p.perMonth)} par mois</b>, {euros(SAVING)} d’économie par an</> : <>Sans engagement : tu prolonges <b>mois par mois</b></>}</p>
                {id === 'yearly' && main && (
                  <div className="offer-tip">
                    <LeaPhoto className="offer-tip-face" />
                    <p>{finish && monthsToFinish && monthsToFinish <= 1
                      ? <>Tu finis {yourCourse(main)} vers <b>{roughDate(finish, now)}</b>. Avec l’annuel, tu enchaînes sur la suite ou un autre cours, à {euros(p.perMonth)} par mois.</>
                      : finish && monthsToFinish
                        ? <>À ton rythme, tu finis {yourCourse(main)} vers <b>{roughDate(finish, now)}</b>{monthsToFinish <= 12 ? ' : l’annuel couvre tout ton parcours.' : '.'}</>
                        : <>Un an pour aller au bout de {yourCourse(main)} et commencer un autre cours, sans y penser chaque mois.</>}</p>
                  </div>
                )}
                {id === 'monthly' && (
                  <ul className="offer-points">
                    <li><Icon name="check" size={15} />Payé au mois, arrêt quand tu veux</li>
                    <li><Icon name="check" size={15} />Rappel une semaine avant la fin</li>
                    <li><Icon name="check" size={15} />Passage à l’annuel quand tu veux</li>
                  </ul>
                )}
                <Button variant={id === 'yearly' ? 'blue' : 'line'} block go={id === 'yearly'} onClick={() => pay(id)}>
                  {current ? `Renouveler · ${euros(p.price)}` : id === 'yearly' ? 'Passer à l’annuel' : 'Revenir au mensuel'}
                </Button>
              </article>
            );
          })}
          <article className="card offer-inc" aria-labelledby="inc-title">
            <h3 id="inc-title">Inclus dans Premium</h3>
            <ul>
              {INCLUDED.map((f) => (
                <li key={f.title}><span className="inc-ic"><Icon name={f.icon} size={17} /></span><span><strong>{f.title}</strong><small>{f.text}</small></span></li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="card invoices" aria-labelledby="inv-title">
        <div className="card-head">
          <div>
            <h2 id="inv-title">Factures</h2>
            <p className="muted">{info.invoices.length} paiement{info.invoices.length > 1 ? 's' : ''} · {euros(total)} depuis le {shortDateY(new Date(s.subscription.startedAt), now)}</p>
          </div>
          {info.invoices.length > 0 && <Button variant="line" size="sm" icon="download" onClick={downloadAll}>Tout télécharger</Button>}
        </div>
        {info.invoices.length === 0 ? <p className="muted">Aucune facture pour l’instant.</p> : (
          <table className="inv-table">
            <thead>
              <tr><th scope="col">Date</th><th scope="col">Numéro</th><th scope="col">Période</th><th scope="col">Offre</th><th scope="col" className="is-num">Montant</th><th scope="col">Statut</th><th scope="col"><span className="sr-only">Reçu</span></th></tr>
            </thead>
            <tbody>
              {info.invoices.map((inv, i) => (
                <tr key={inv.id} className={cx(i === 0 && 'is-last')}>
                  <td data-label="Date">{numericDate(new Date(inv.at))}</td>
                  <td data-label="Numéro"><button type="button" className="inv-id" onClick={() => setReceipt(inv)} aria-label={`Voir le reçu ${inv.id}`}><Icon name="receipt" size={15} />{inv.id}</button></td>
                  <td data-label="Période">{spanLabel(new Date(inv.from), new Date(inv.to), now, ' → ')}</td>
                  <td data-label="Offre">{planName(inv.plan)}</td>
                  <td data-label="Montant" className="is-num"><b className="num">{euros(inv.amount)}</b></td>
                  <td data-label="Statut"><span className="inv-paid"><i aria-hidden="true" />Payée</span></td>
                  <td className="inv-dl"><IconButton icon="download" size={18} label={`Télécharger le reçu ${inv.id}`} onClick={() => download(inv)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <Dialog open={!!receipt} title={receipt ? `Reçu ${receipt.id}` : 'Reçu'} onClose={() => setReceipt(null)} className="receipt-dlg"
        subtitle={receipt ? `Payé le ${longDate(new Date(receipt.at), now)}` : undefined}
        actions={receipt ? <><Button variant="line" onClick={() => setReceipt(null)}>Fermer</Button><Button icon="download" onClick={() => download(receipt)}>Télécharger</Button></> : undefined}>
        {receipt && (
          <div className="receipt">
            <div className="receipt-top">
              <span className="receipt-ic"><Icon name="receipt" size={22} /></span>
              <div><strong>{PLAN_NAME}</strong><small>{PLANS[receipt.plan].label} · du {shortDateY(new Date(receipt.from), now)} au {shortDateY(new Date(receipt.to), now)}</small></div>
              <b className="num">{euros(receipt.amount)}</b>
            </div>
            <dl className="receipt-list">
              <div><dt>Client</dt><dd>{s.profile.firstName} {s.profile.lastName}</dd></div>
              <div><dt>Moyen de paiement</dt><dd><Icon name="card" size={15} />{DEMO_METHOD}</dd></div>
              <div><dt>Statut</dt><dd><span className="inv-paid"><i aria-hidden="true" />Payée</span></dd></div>
              <div className="receipt-total"><dt>Total</dt><dd className="num">{euros(receipt.amount)}</dd></div>
            </dl>
            <p className="notice"><Icon name="info" size={16} />Démonstration : aucun paiement réel n’a été effectué.</p>
          </div>
        )}
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------- Léa's panel on the subscription page
function SubscriptionRail(_: { route: Route }) {
  const s = useLearner();
  const since = new Date(s.subscription.startedAt);
  const lessons = lessonsDone(s, since);
  const minutes = minutesBetween(s, since);
  const badges = Object.values(s.achievements).filter((at) => at && at >= s.subscription.startedAt).length;
  return (
    <>
      <section className="rail-sec" aria-labelledby="since-title">
        <div className="rail-sec-head"><h3 id="since-title">Depuis ton inscription</h3><span className="muted">{shortDate(since)}</span></div>
        <div className="mini-stats">
          <div><strong className="num">{lessons}</strong><small>leçon{lessons > 1 ? 's' : ''}</small></div>
          <div><strong className="num">{minutesLabel(minutes)}</strong><small>d’apprentissage</small></div>
          <div><strong className="num">{badges}</strong><small>badge{badges > 1 ? 's' : ''}</small></div>
        </div>
      </section>
      <AskChips items={['Comparer les offres', 'Me rappeler avant la fin']} icons={['sliders', 'bell']} />
    </>
  );
}
registerRail('subscription', SubscriptionRail);
