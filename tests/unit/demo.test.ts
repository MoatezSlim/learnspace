// Demo history and stored-state upgrades (src/state/demo.ts). Run with: npm test
import { adopt, demoState, reanchor, migrate } from '../../src/state/demo';
import { courseStats, todayMinutes, streak, competencies, lessonsCompletedOn, subscriptionInfo } from '../../src/state/selectors';
import { getCourse } from '../../src/data/courses';
// A state saved by the previous version (v1, goal 15 min) about 30 hours ago: the demo history plus
// one answer in a lesson in progress, as a learner would leave it.
const anchor = new Date(Date.now() - 30 * 3600e3);
const stored: any = demoState(anchor);
stored.version = 1; stored.profile.dailyGoalMin = 15;
const t1 = new Date(anchor.getTime() + 60e3).toISOString();
stored.attempts = { 'en-b1-m4-l2': { step: 1, answers: { q1: [{ value: 'a', correct: true }] }, revealed: {}, startedAt: t1, activeMs: 50000, mediaDone: true } };
stored.answerLog = [{ lessonId: 'en-b1-m4-l2', questionId: 'q1', value: 'a', correct: true, attempt: 1, at: t1 }];
stored.enrollments['en-b1'] = { ...stored.enrollments['en-b1'], lastActiveAt: t1 };
stored.updatedAt = t1;
const RealDate = Date;
const withNow = <T,>(t: Date, fn: () => T): T => {
  const fixed = t.getTime();
  class FakeDate extends RealDate { constructor(...args: any[]) { if (args.length === 0) super(fixed); else super(...(args as [any])); } static now() { return fixed; } }
  (globalThis as any).Date = FakeDate;
  try { return fn(); } finally { (globalThis as any).Date = RealDate; }
};
let fails = 0;
const check = (name: string, ok: boolean, extra = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) fails++; };
const dash = (s: any) => {
  const c = getCourse(s.currentCourseId)!; const st = courseStats(s, c); const sk = streak(s); const comp = competencies(s, c.id);
  return { pct: st.pct, done: `${st.done}/${st.total}`, module: `${st.module?.index} ${st.module?.title}`, today: todayMinutes(s), goal: s.profile.dailyGoalMin,
    doneToday: lessonsCompletedOn(s, 0, c.id), streak: sk.days, todayActive: sk.todayActive, comp: `${comp.acquired}/${comp.total}`, compWeek: comp.thisWeek };
};

// 1) how the stored state looks today without re-anchoring
const now = new Date(new Date(stored.seededAt).getTime() + 30 * 3600e3);
console.log('stored (migrated only), a day later:', JSON.stringify(withNow(now, () => dash(migrate(stored)))));
// 2) adopt: re-anchored to today
const a = adopt(stored, now)!;
const d = withNow(now, () => dash(a));
console.log('adopted today:', JSON.stringify(d));
check('re-anchored', a.seededAt === now.toISOString());
check('reference figures', d.pct === 68 && d.done === '24/35' && d.today >= 10 && d.goal === 10 && d.doneToday === 1 && d.streak === 5 && d.todayActive && d.comp === '6/12' && d.compWeek === 2, JSON.stringify(d));
check('attempt kept', JSON.stringify(a.attempts) === JSON.stringify(stored.attempts));
check('answers kept', JSON.stringify(a.answerLog) === JSON.stringify(stored.answerLog));
check('updatedAt kept', a.updatedAt === stored.updatedAt);
check('badges count kept', Object.keys(a.achievements).length === Object.keys(stored.achievements).length, String(Object.keys(a.achievements).length));
check('messages kept', a.conversation.length === stored.conversation.length && a.conversation.every((m: any, i: number) => m.text === stored.conversation[i].text));
check('notifications kept', a.notifications.length === stored.notifications.length && a.notifications.every((n: any) => stored.notifications.some((o: any) => o.id === n.id && o.read === n.read)));
check('no future timestamps', [...Object.values(a.completions).map((c: any) => c.at), ...a.notifications.map((n: any) => n.at), ...a.conversation.map((m: any) => m.at)].every((t) => t <= now.toISOString()));
check('enrollment activity kept', a.enrollments['en-b1'].lastActiveAt >= stored.enrollments['en-b1'].lastActiveAt);

// 3) same day: unchanged
check('same day is a no-op', reanchor(a, new Date(now.getTime() + 60e3)) === a);

// 4) next day, with things the learner did in between
const later = JSON.parse(JSON.stringify(a));
later.conversation.push({ id: 'u1', role: 'user', text: 'Bonjour Léa', at: new Date(now.getTime() + 3600e3).toISOString() });
later.assistantQuestions += 1;
later.notifications[0].read = true;
later.activity[Object.keys(later.activity).sort().slice(-1)[0]] += 3;
later.enrollments['de-a1'] = { ...later.enrollments['de-a1'], lastActiveAt: new Date(now.getTime() + 7200e3).toISOString() };
const tomorrow = new Date(now.getTime() + 86400e3);
const b = reanchor(later, tomorrow);
check('next day re-anchors again', b !== later && b.seededAt === tomorrow.toISOString());
check('own message kept', b.conversation.some((m: any) => m.id === 'u1' && m.at === later.conversation.find((x: any) => x.id === 'u1').at));
check('read flag kept', b.notifications.find((n: any) => n.id === later.notifications[0].id)!.read === true);
check('own minutes kept', Object.values(b.activity).reduce((x: number, y: any) => x + y, 0) === 760 + 3 + (Object.values(a.activity).reduce((x: number, y: any) => x + y, 0) - 760), String(Object.values(b.activity).reduce((x: number, y: any) => x + y, 0)));
check('own course activity kept', b.enrollments['de-a1'].lastActiveAt === later.enrollments['de-a1'].lastActiveAt);
const db = withNow(tomorrow, () => dash(b));
check('tomorrow shows the reference day', db.doneToday === 1 && db.streak === 5 && db.todayActive && db.today >= 10, JSON.stringify(db));

// 5) a lesson finished by the learner freezes the history
const own = JSON.parse(JSON.stringify(a));
own.completions['en-b1-m4-l2'] = { at: new Date(now.getTime() + 60e3).toISOString(), score: 3, total: 3, minutes: 9, passed: true };
check('own completion freezes', reanchor(own, tomorrow) === own);
const retake = JSON.parse(JSON.stringify(a));
retake.completions['en-b1-m1-l1'] = { ...retake.completions['en-b1-m1-l1'], at: new Date(now.getTime() + 60e3).toISOString(), score: 5 };
check('retaken lesson freezes', reanchor(retake, tomorrow) === retake);

// 6) a fresh demo state is the reference day
const f = withNow(now, () => dash(demoState(now)));
check('fresh demo = reference', f.pct === 68 && f.today === 10 && f.doneToday === 1 && f.streak === 5 && f.comp === '6/12' && f.compWeek === 2, JSON.stringify(f));
// 6b) just after midnight the demo lesson is still "today"
for (const [h, m] of [[0, 0], [0, 2], [0, 43], [5, 59], [23, 59]]) {
  const t0 = new Date(now); t0.setHours(h, m, 30, 0);
  const g = withNow(t0, () => dash(demoState(t0)));
  check(`demo day at ${h}:${String(m).padStart(2, '0')}`, g.doneToday === 1 && g.today === 10 && g.streak === 5 && g.todayActive, JSON.stringify(g));
}
// 7) rubbish is refused
check('rejects unknown versions', adopt({ version: 9 } as any) === null && adopt(null) === null);
// 8) older saves named the live answers mode after the model: upgraded to the neutral name
const legacy: any = demoState(new Date());
legacy.prefs.aiMode = 'claude';
legacy.conversation = [...legacy.conversation, { id: 'x1', role: 'assistant', text: 'Bonjour', at: new Date().toISOString(), source: 'claude' }];
const up = migrate(legacy);
check('old answer-mode name upgraded', up.prefs.aiMode === 'live' && up.conversation.find((m: any) => m.id === 'x1')?.source === 'live' && !/claude/i.test(JSON.stringify(up)));
check('current saves untouched by the upgrade', migrate(demoState(new Date())).prefs.aiMode === 'live');
// 9) subscription: anchored on the demo date, kept once the learner pays
{
  const t0 = new Date(2026, 9, 10, 11, 0, 0);
  const d0 = withNow(t0, () => demoState(t0));
  const sub = d0.subscription;
  const until = new Date(sub.paidUntil);
  check('demo subscription: monthly, 4 payments, ends in 3 days at midnight', sub.plan === 'monthly' && sub.invoices.length === 4 && until.getDate() === 13 && until.getHours() === 23 && sub.invoices.every((i) => i.at < d0.seededAt), sub.paidUntil);
  const i0 = withNow(t0, () => subscriptionInfo(d0, t0));
  check('due soon: label and state', i0.state === 'due' && i0.daysLeft === 3 && i0.label === 'Se termine dans 3 jours', JSON.stringify([i0.state, i0.daysLeft, i0.label]));
  const later = new Date(2026, 9, 12, 9, 0, 0);
  const moved = withNow(later, () => reanchor(d0, later));
  check('unpaid subscription follows the calendar', new Date(moved.subscription.paidUntil).getDate() === 15, moved.subscription.paidUntil);
  const paid = JSON.parse(JSON.stringify(d0));
  paid.subscription.invoices.push({ id: 'F-x', at: new Date(2026, 9, 10, 12, 0).toISOString(), amount: 9.99, plan: 'monthly', from: sub.paidUntil, to: new Date(2026, 10, 13, 23, 59, 59).toISOString(), method: 'demo' });
  paid.subscription.paidUntil = new Date(2026, 10, 13, 23, 59, 59).toISOString();
  const kept = withNow(later, () => reanchor(paid, later));
  check('paid subscription is kept as paid', kept.subscription.paidUntil === paid.subscription.paidUntil && kept.subscription.invoices.length === 5);
  const ia = withNow(later, () => subscriptionInfo(kept, later));
  check('after paying: active until 13 nov.', ia.state === 'active' && ia.label === 'Actif jusqu’au 13 nov.', ia.label);
  const exp = JSON.parse(JSON.stringify(d0)); exp.subscription.paidUntil = new Date(2026, 9, 8, 23, 59, 59).toISOString();
  const ie = withNow(t0, () => subscriptionInfo(exp, t0));
  check('expired: label', ie.state === 'expired' && ie.label === 'Expiré depuis 2 jours', ie.label);
  const old: any = JSON.parse(JSON.stringify(d0)); delete old.subscription;
  const up2 = withNow(t0, () => migrate(old, t0));
  check('older saves get the demo subscription', !!up2.subscription && up2.subscription.invoices.length === 4);
}
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
