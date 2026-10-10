// Subscription page: the offer, the paid period, changing offer, the means of payment and invoices.
// Payments are simulated (see src/data/plans.ts): nothing is charged and no card details are asked for.
import React, { useState } from 'react';
import { Icon } from '../components/icons';
import { Button, Dialog, ProgressBar, cx } from '../components/ui';
import { useLearner } from '../state/store';
import { subscriptionInfo } from '../state/selectors';
import { overlays } from '../state/ui';
import { PLANS, PLAN_NAME, DEMO_METHOD, euros } from '../data/plans';
import { COURSES, courseLessons } from '../data/courses';
import { longDate, numericDate, spanLabel } from '../lib/dates';
import type { Invoice } from '../types';

const STATE_PILL = { active: ['pill-green', 'Actif'], due: ['pill-amber', 'Paiement à prévoir'], expired: ['pill-red', 'Expiré'] } as const;

export function SubscriptionPage() {
  const s = useLearner();
  const now = new Date();
  const info = subscriptionInfo(s, now);
  const [receipt, setReceipt] = useState<Invoice | null>(null);
  const due = info.state !== 'active';
  const lessons = COURSES.reduce((n, c) => n + courseLessons(c).length, 0);
  const [pillTone, pillText] = STATE_PILL[info.state];
  const period = (i: Invoice) => spanLabel(new Date(i.from), new Date(i.to), now);

  return (
    <div className="page sub-page">
      <div className="page-head">
        <h1>Abonnement</h1>
        <p className="muted">Ton offre, la période payée, tes paiements et tes factures.</p>
      </div>

      <div className="sub-top">
        <section className={cx('sub-status', `is-${info.state}`)} aria-labelledby="sub-status-title">
          <div className="sub-status-head">
            <span className="sub-crown"><Icon name="crown" size={24} /></span>
            <div className="sub-status-name">
              <p className="eyebrow light">Ton offre</p>
              <h2 id="sub-status-title">{PLAN_NAME}</h2>
            </div>
            <span className={cx('pill', pillTone)}><span className="dot" />{pillText}</span>
          </div>
          <p className="sub-until">
            {info.state === 'expired' ? <>Ton accès a pris fin le <strong>{longDate(info.until, now)}</strong>.</> : <>Accès payé jusqu’au <strong>{longDate(info.until, now)}</strong>{due ? ` · ${info.label.toLowerCase()}` : ''}.</>}
          </p>
          <div className="sub-period">
            <ProgressBar value={info.elapsed * 100} tone="light" size="sm" label="Période en cours écoulée" />
            <span>{info.plan.label} · {euros(info.plan.price)} / {info.plan.per}</span>
          </div>
          <div className="sub-actions">
            <Button variant="light" icon="card" onClick={() => overlays.openPayment()}>{due ? `Payer l’abonnement · ${euros(info.plan.price)}` : `Prolonger · ${euros(info.plan.price)}`}</Button>
            {due && <span className="sub-hint">{info.state === 'expired' ? 'Réactive ton accès en un clic.' : 'Règle-le maintenant pour ne pas perdre ton accès.'}</span>}
          </div>
        </section>

        <section className="card sub-benefits" aria-labelledby="sub-benefits-title">
          <h2 id="sub-benefits-title">Ce que comprend Premium</h2>
          <ul>
            <li><Icon name="check" size={18} />Les {COURSES.length} cours du catalogue et leurs {lessons} leçons</li>
            <li><Icon name="check" size={18} />Léa, ton assistante, pour t’expliquer et te guider</li>
            <li><Icon name="check" size={18} />Ta progression, tes statistiques et tes badges</li>
            <li><Icon name="check" size={18} />Ta progression enregistrée et retrouvée sur tes appareils</li>
          </ul>
        </section>
      </div>

      <section className="card sub-plans-card" aria-labelledby="sub-plans-title">
        <div className="sub-plans-head">
          <h2 id="sub-plans-title">Changer d’offre</h2>
          <p className="muted small">Chaque paiement prolonge ton accès à partir de la fin de la période en cours.</p>
        </div>
        <div className="sub-plans">
          {Object.values(PLANS).map((pl) => {
            const current = pl.id === s.subscription.plan;
            return (
              <div key={pl.id} className={cx('sub-plan', current && 'is-current')}>
                <div className="sub-plan-top">
                  <strong>{pl.label}</strong>
                  {current ? <span className="pill pill-blue">Offre actuelle</span> : pl.note ? <span className="pill pill-green">{pl.note}</span> : null}
                </div>
                <p className="sub-price"><strong>{euros(pl.price)}</strong> / {pl.per}</p>
                <p className="muted small">{pl.id === 'yearly' ? `Soit ${euros(pl.perMonth)} par mois, réglé une fois par an.` : 'Sans engagement, réglé chaque mois.'}</p>
                <Button size="sm" variant={current ? 'secondary' : 'primary'} onClick={() => overlays.openPayment(pl.id)}>
                  {current ? 'Payer cette offre' : `Passer à l’offre ${pl.label.toLowerCase()}`}
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      <div className="sub-bottom">
        <section className="card sub-method" aria-labelledby="sub-method-title">
          <h2 id="sub-method-title">Moyen de paiement</h2>
          <div className="sub-cardvis" aria-hidden="true">
            <span className="sub-chip" />
            <span className="sub-num">•••• •••• •••• 4242</span>
            <span className="sub-cardname">{s.profile.firstName} {s.profile.lastName}<em>12/28</em></span>
          </div>
          <p className="sub-method-line"><Icon name="card" size={16} />{DEMO_METHOD}</p>
          <p className="muted small">Démonstration : aucune carte réelle n’est enregistrée et aucun paiement n’est effectué.</p>
        </section>

        <section className="card sub-invoices" aria-labelledby="sub-invoices-title">
          <h2 id="sub-invoices-title">Factures</h2>
          <div className="table-wrap">
            <table className="sub-table">
              <thead><tr><th scope="col">Date</th><th scope="col">Période</th><th scope="col">Offre</th><th scope="col" className="num">Montant</th><th scope="col">Statut</th><th scope="col"><span className="sr-only">Détail</span></th></tr></thead>
              <tbody>
                {info.invoices.map((i) => (
                  <tr key={i.id}>
                    <td>{numericDate(new Date(i.at))}</td>
                    <td>{period(i)}</td>
                    <td>{PLANS[i.plan].label}</td>
                    <td className="num">{euros(i.amount)}</td>
                    <td><span className="pill pill-green">Payée</span></td>
                    <td><button type="button" className="link-inline small" onClick={() => setReceipt(i)} aria-label={`Voir la facture ${i.id}`}><Icon name="receipt" size={15} />Voir</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Dialog open={!!receipt} title={receipt ? `Facture ${receipt.id}` : 'Facture'} onClose={() => setReceipt(null)}
        actions={<Button onClick={() => setReceipt(null)}>Fermer</Button>}>
        {receipt && (
          <dl className="pay-summary">
            <div><dt>Date</dt><dd>{numericDate(new Date(receipt.at))}</dd></div>
            <div><dt>Offre</dt><dd>{PLAN_NAME} · {PLANS[receipt.plan].label}</dd></div>
            <div><dt>Période</dt><dd>du {numericDate(new Date(receipt.from))} au {numericDate(new Date(receipt.to))}</dd></div>
            <div><dt>Moyen de paiement</dt><dd>{receipt.method}</dd></div>
            <div><dt>Client</dt><dd>{s.profile.firstName} {s.profile.lastName}</dd></div>
            <div className="pay-total"><dt>Montant payé</dt><dd>{euros(receipt.amount)}</dd></div>
          </dl>
        )}
      </Dialog>
    </div>
  );
}
