// Writes two stored states anchored ~26 h ago, in the v1 format the published app saved:
//  stale.json  — demo untouched except one answer in a lesson in progress
//  frozen.json — the learner finished a lesson of their own after the anchor
import { demoState } from '../../src/state/demo';
import * as fs from 'fs';
import * as path from 'path';
const dir = process.argv[2] || '.';
const anchor = new Date(Date.now() - 26 * 3600e3);
const s: any = demoState(anchor);
s.version = 1; s.profile.dailyGoalMin = 15;
const t1 = new Date(anchor.getTime() + 60e3).toISOString();
s.attempts = { 'en-b1-m4-l2': { step: 1, answers: { q1: [{ value: 'a', correct: true }] }, revealed: {}, startedAt: t1, activeMs: 50000, mediaDone: true } };
s.answerLog = [{ lessonId: 'en-b1-m4-l2', questionId: 'q1', value: 'a', correct: true, attempt: 1, at: t1 }];
s.updatedAt = t1;
fs.writeFileSync(path.join(dir, 'stale.json'), JSON.stringify(s));
const f = JSON.parse(JSON.stringify(s));
f.completions['en-b1-m4-l2'] = { at: new Date(anchor.getTime() + 9 * 60e3).toISOString(), score: 3, total: 3, minutes: 9, passed: true };
f.attempts = {};
f.updatedAt = f.completions['en-b1-m4-l2'].at;
fs.writeFileSync(path.join(dir, 'frozen.json'), JSON.stringify(f));

