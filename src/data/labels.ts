// Short labels used by the interface (module names under progress bars, category names).
import type { CategoryId, Course, Module } from '../types';
import type { IconName } from '../components/icons';

const MODULE_SHORT: Record<string, string> = {
  'en-b1-m1': 'Se présenter', 'en-b1-m2': 'Vie quotidienne', 'en-b1-m3': 'Raconter', 'en-b1-m4': 'Compréhension orale', 'en-b1-m5': 'Opinion', 'en-b1-m6': 'Projet final',
  'es-a2-m1': 'Primeros pasos', 'es-a2-m2': 'En la ciudad', 'es-a2-m3': 'Restaurante', 'es-a2-m4': 'Viajar',
  'fr-b1-m1': 'Raconter', 'fr-b1-m2': 'Sentiments', 'fr-b1-m3': 'Argumenter', 'fr-b1-m4': 'Courriel',
  'de-a1-m1': 'Hallo!', 'de-a1-m2': 'Im Alltag', 'de-a1-m3': 'Im Hotel', 'de-a1-m4': 'Unterwegs',
  'it-b1-m1': 'Parlare di sé', 'it-b1-m2': 'Al mercato', 'it-b1-m3': 'Viaggiare',
  'ru-c1-m1': 'Presse', 'ru-c1-m2': 'Pro', 'ru-c1-m3': 'Société', 'ru-c1-m4': 'Discussion',
};
export const moduleShort = (m: Module) => MODULE_SHORT[m.id] ?? m.title.split(/\s+/).slice(0, 2).join(' ').replace(/[,:]$/, '');

export const CATEGORY_SHORT: Record<CategoryId, string> = { langues: 'Langues', business: 'Business', informatique: 'Informatique', devperso: 'Dév. personnel', sciences: 'Sciences', art: 'Art et culture' };
export const CATEGORY_ICON: Record<CategoryId, IconName> = { langues: 'globe', business: 'briefcase', informatique: 'monitor', devperso: 'sprout', sciences: 'flask', art: 'palette' };

/** « Anglais B1 », « Python », … */
export const courseBadge = (c: Course) => `${c.shortTitle}${c.cefr ? ` ${c.cefr}` : ''}`;
/** Language taught, in lower case after « l’ » / « le » (for sentences). */
export const languageName = (c: Course) => c.shortTitle.toLowerCase();
