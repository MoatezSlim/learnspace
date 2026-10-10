// Date helpers. Days are keyed in the learner's local time zone ("YYYY-MM-DD").

export const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayKey = () => dayKey(new Date());
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const parseDay = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const daysBetween = (a: Date, b: Date) => Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
export const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 0);
/** Same day of the month n months later (clamped to the month's last day), same time. */
export const addMonths = (d: Date, n: number) => {
  const x = new Date(d); const day = x.getDate();
  x.setDate(1); x.setMonth(x.getMonth() + n);
  x.setDate(Math.min(day, new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()));
  return x;
};

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const DAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
export const shortDate = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
export const weekday = (d: Date) => DAYS[d.getDay()];
export const timeHM = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DAYS_LONG = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
/** « jeudi 13 novembre » (+ the year when it is not the current one) */
export const longDate = (d: Date, now = new Date()) => `${DAYS_LONG[d.getDay()]} ${d.getDate()} ${MONTHS_LONG[d.getMonth()]}${d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : ''}`;
/** « 13 oct. → 13 nov. », with the years when the span crosses a year or is not in the current one */
export const spanLabel = (a: Date, b: Date, now = new Date(), sep = ' → ') => {
  if (a.getFullYear() !== b.getFullYear()) return `${shortDate(a)} ${a.getFullYear()}${sep}${shortDate(b)} ${b.getFullYear()}`;
  return `${shortDate(a)}${sep}${shortDate(b)}${b.getFullYear() !== now.getFullYear() ? ` ${b.getFullYear()}` : ''}`;
};
/** « 13 oct. » (+ the year when it is not the current one) */
export const shortDateY = (d: Date, now = new Date()) => `${shortDate(d)}${d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : ''}`;
/** « 13/10/2026 » */
export const numericDate = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

export function relative(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return 'à l’instant';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  const days = daysBetween(d, now);
  if (days === 0) return `aujourd’hui à ${timeHM(d)}`;
  if (days === 1) return `hier à ${timeHM(d)}`;
  if (days < 7) return `il y a ${days} jours`;
  return `le ${shortDate(d)}`;
}

export function minutesLabel(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h ${pad(r)}` : `${h}h`;
}
