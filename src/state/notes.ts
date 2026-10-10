// Automatic in-app notifications (see Settings › Notifications): the daily reminder when the goal is
// not reached yet, and the weekly summary on Sunday evening.
import type { LearnerState } from '../types';
import { recommendation, todayMinutes } from './selectors';
import { periodMinutes, lessonsDone, periodStart } from './insights';
import { minutesLabel } from '../lib/dates';

export function autoNotes(store: { state: LearnerState }) {
  return {
    daily: () => {
      const s = store.state; const goal = s.profile.dailyGoalMin; const today = todayMinutes(s);
      if (today >= goal) return null;
      const rec = recommendation(s);
      return { title: 'Ton objectif du jour t’attend', body: `Encore ${goal - today} min${rec ? ` : « ${rec.lesson.title} » prend ${rec.lesson.minutes} minutes.` : '.'}` };
    },
    weekly: () => {
      const s = store.state; const now = new Date();
      const n = lessonsDone(s, periodStart('week', now));
      return { title: 'Ton bilan de la semaine', body: `${minutesLabel(periodMinutes(s, 'week', now))} d’apprentissage et ${n} leçon${n > 1 ? 's' : ''} terminée${n > 1 ? 's' : ''}. Bonne semaine !` };
    },
  };
}
