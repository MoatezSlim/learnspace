import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { avatar, useAvatar, TYPE_CPS } from './controller';
import { ask } from './assistant';
import { getAiStatus, onAiStatus } from './brain';
import { STATUS_LABEL } from './Lea';
import { store } from '../state/store';
import { navigate } from '../router';
import { cx, toast } from '../components/ui';
import type { AssistantAction } from '../types';
import { getCourse, getLesson } from '../data/courses';
import { overlays } from '../state/ui';
import { longDate } from '../lib/dates';

export const useAiStatus = () => useSyncExternalStore(onAiStatus, getAiStatus);

export function runAction(a: AssistantAction) {
  avatar.interacted = true;
  if (a.kind === 'lesson' && getLesson(a.lessonId)) navigate({ page: 'lesson', lessonId: a.lessonId });
  else if (a.kind === 'page') navigate(a.page === 'course' && a.courseId ? { page: 'course', courseId: a.courseId } : { page: a.page });
  else if (a.kind === 'ask') void ask(a.text);
  else if (a.kind === 'open') { if (a.target === 'newCourse') overlays.openNewCourse(); else overlays.openPayment(); }
  else if (a.kind === 'pause') {
    const c = getCourse(a.courseId); if (!c) return;
    store.pauseCourse(c.id, true);
    toast(`« ${c.title} » est en pause. Tu le retrouves dans Mes cours › En pause.`, 'success');
  } else if (a.kind === 'remind') {
    store.addReminder(a.at, a.title, 'Rappel demandé à Léa.');
    toast(`C’est noté : rappel le ${longDate(new Date(a.at))}.`, 'success');
  }
}

export function StatusDot() {
  const v = useAvatar();
  return <span className={cx('status-dot', `st-${v.status}`)}><i aria-hidden="true" />{v.status === 'idle' ? 'En ligne' : STATUS_LABEL[v.status][0].toUpperCase() + STATUS_LABEL[v.status].slice(1)}</span>;
}

/** Splits « **bold** text » into segments. */
function segments(text: string) {
  const out: { t: string; b: boolean }[] = [];
  for (const p of text.split(/(\*\*[^*]+\*\*)/g)) if (p) out.push(p.startsWith('**') && p.endsWith('**') && p.length > 4 ? { t: p.slice(2, -2), b: true } : { t: p, b: false });
  return out;
}

/** Text typed out as if Léa were saying it (shown at once with reduced motion, or when `at` is 0).
 * The full text is laid out from the start, so the bubble keeps its size while the letters appear.
 * Parts between ** ** are bold. */
export function Typed({ text, at, reserve = true }: { text: string; at: number; reserve?: boolean }) {
  const reduced = avatar.reduced;
  const segs = segments(text);
  const plain = segs.map((x) => x.t).join('');
  const count = () => (reduced || at === 0 ? plain.length : Math.max(0, Math.min(plain.length, Math.floor(((performance.now() - at) / 1000) * TYPE_CPS))));
  const [n, setN] = useState(count);
  useEffect(() => {
    let raf = 0;
    const step = () => { const k = count(); setN(k); if (k < plain.length) raf = requestAnimationFrame(step); };
    step();
    return () => cancelAnimationFrame(raf);
  }, [text, at, reduced]); // eslint-disable-line react-hooks/exhaustive-deps
  const typing = n < plain.length;
  let pos = 0;
  return (
    <>
      <span className={cx('typed', typing && 'is-typing')} aria-hidden="true">
        {segs.map((sg, i) => {
          const from = pos; const to = pos + sg.t.length; pos = to;
          const cut = Math.max(from, Math.min(n, to));
          const shown = sg.t.slice(0, cut - from); const rest = sg.t.slice(cut - from);
          const caret = typing && n >= from && n < to;
          const body = <>{shown}{caret && <i className="caret" />}{reserve && rest && <span className="typed-rest">{rest}</span>}</>;
          return sg.b ? <strong key={i}>{body}</strong> : <React.Fragment key={i}>{body}</React.Fragment>;
        })}
      </span>
      <span className="sr-only">{plain}</span>
    </>
  );
}
