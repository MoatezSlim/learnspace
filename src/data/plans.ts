// Subscription offers. This prototype has no payment provider: paying is simulated (no card details
// are ever asked for, nothing is charged) and only extends the paid period in the learner's state.
import type { PlanId, Subscription } from '../types';
import { addMonths, endOfDay, addDays } from '../lib/dates';

export interface Plan { id: PlanId; label: string; price: number; months: number; per: string; perMonth: number; note?: string }

export const PLANS: Record<PlanId, Plan> = {
  monthly: { id: 'monthly', label: 'Mensuel', price: 9.99, months: 1, per: 'mois', perMonth: 9.99 },
  yearly: { id: 'yearly', label: 'Annuel', price: 89.99, months: 12, per: 'an', perMonth: 7.5, note: '−25 %' },
};
export const PLAN_NAME = 'LearnSpace Premium';
/** What the demo payment shows as the means of payment (nothing is ever entered or charged). */
export const DEMO_METHOD = 'Carte de démonstration •••• 4242';
/** Days before the end of the paid period from which the sidebar asks to pay. */
export const DUE_DAYS = 7;

const EUR = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
export const euros = (n: number) => EUR.format(n).replace(/ | /g, ' ');

/** Demo subscription: a monthly plan paid for four months, the current period ending in 3 days. */
export function seedSubscription(now: Date): Subscription {
  const paidUntil = endOfDay(addDays(now, 3));
  const invoices = [4, 3, 2, 1].map((k) => {
    const from = addMonths(paidUntil, -k);
    const at = new Date(from); at.setHours(9, 12, 0, 0);
    return {
      id: `F-${from.getFullYear()}${String(from.getMonth() + 1).padStart(2, '0')}-${String(1040 + (4 - k) * 37)}`,
      at: at.toISOString(), amount: PLANS.monthly.price, plan: 'monthly' as const,
      from: from.toISOString(), to: addMonths(paidUntil, -(k - 1)).toISOString(), method: DEMO_METHOD,
    };
  });
  return { plan: 'monthly', startedAt: invoices[0].at, paidUntil: paidUntil.toISOString(), invoices };
}
