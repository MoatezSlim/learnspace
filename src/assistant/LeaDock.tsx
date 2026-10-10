// Léa's place in the desktop layout: a panel on the right of every page (wide screens), or a floating
// bubble that opens the same panel (narrower screens, or when the learner prefers it). The panel shows
// her animated portrait (eyes following the pointer, expressions), what she is saying, a few things
// that matter on the current page, and a field to ask her something.
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Lea } from './Lea';
import { Typed, runAction, useAiStatus } from './AssistantPanels';
import { avatar, useAvatar } from './controller';
import { ask, useChat } from './assistant';
import { guide, useGuide, describeCourse } from './guideState';
import { pageLine } from './pageLines';
import { useLearner, store } from '../state/store';
import { useRoute, navigate } from '../router';
import { getCourse, courseLessons, isPlayable, LEVEL_SHORT } from '../data/courses';
import { courseStats } from '../state/selectors';
import { listen, sttSupported } from './speech';
import { Icon, IconName } from '../components/icons';
import { cx, toast } from '../components/ui';
import type { PageId, Route } from '../types';
import { leaAsset } from './leaRig';

export type DockMode = 'panel' | 'bubble';

// ---------------------------------------------------------------- open/close (floating mode) + focus
let popOpen = false; const pl = new Set<() => void>();
const setPop = (v: boolean) => { popOpen = v; pl.forEach((l) => l()); };
const usePop = () => useSyncExternalStore((l) => { pl.add(l); return () => pl.delete(l); }, () => popOpen);
/** Brings Léa forward: focuses her field (panel), opens her bubble (floating), or opens the chat (phone). */
export function openCoach(question?: string) {
  const field = () => document.getElementById('coach-input') as HTMLInputElement | null;
  if (window.matchMedia && window.matchMedia('(max-width: 999px)').matches) { navigate({ page: 'messages' }); if (question) void ask(question); return; }
  if (!document.querySelector('.rail.is-panel')) setPop(true);
  if (question) { void ask(question); return; }
  window.setTimeout(() => field()?.focus(), 60);
}

// ---------------------------------------------------------------- page bodies
type RailBody = React.ComponentType<{ route: Route }>;
const bodies: Partial<Record<PageId, RailBody>> = {};
/** Pages register what Léa shows under her bubble on that page. */
export function registerRail(page: PageId, body: RailBody) { bodies[page] = body; }

/** Chips under Léa's bubble: quick questions she answers in her bubble. */
export function AskChips({ items, icons }: { items: string[]; icons?: IconName[] }) {
  const chat = useChat();
  return (
    <div className="rail-chips">
      {items.map((t, i) => (
        <button key={t} type="button" className="chip chip-ask" disabled={chat.busy} onClick={() => { avatar.interacted = true; void ask(t); }}>
          <Icon name={icons?.[i] ?? 'sparkle'} size={15} />{t}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- what she says
function GuideSay() {
  const g = useGuide(); const s = useLearner(); const route = useRoute();
  const course = g.courseId ? getCourse(g.courseId) : undefined;
  if (!course) return null;
  const st = courseStats(s, course);
  const { hello, text } = describeCourse(course, s);
  const onPage = route.page === 'course' && route.courseId === course.id;
  const target = courseLessons(course).find((l) => !s.completions[l.id]?.passed && isPlayable(l));
  const start = () => {
    guide.close();
    if (!target) { navigate({ page: 'course', courseId: course.id }); return; }
    if (!st.enrolled) { store.enroll(course.id); toast(`Inscription confirmée : ${course.title}`, 'success'); }
    navigate({ page: 'lesson', lessonId: target.id });
  };
  return (
    <div className={cx('say', 'say-guide', g.mode === 'peek' && 'is-peek')} key={g.key} role={g.mode === 'open' ? 'region' : 'status'} aria-label={`Léa présente le cours ${course.title}`}
      onMouseEnter={() => guide.enterGuide()} onMouseLeave={() => guide.leaveGuide()}>
      {g.mode === 'open' && <button type="button" className="say-x" aria-label="Fermer la présentation" onClick={() => guide.close()}><Icon name="x" size={15} /></button>}
      <span className="say-kicker"><Icon name="sparkle" size={13} />Léa te présente</span>
      <strong className="guide-title">{course.title}</strong>
      <p className="guide-text"><b>{hello} </b><Typed text={text} at={g.at + 300} reserve={false} /></p>
      <div className="guide-meta">
        <span><Icon name="clock" size={13} />{course.hours} h</span>
        <span><Icon name="book" size={13} />{st.total} leçons</span>
        <span><Icon name="progress" size={13} />{LEVEL_SHORT[course.level]}</span>
        {st.enrolled && <span className="is-progress">{st.pct} % fait</span>}
      </div>
      <div className="guide-actions">
        {onPage
          ? <button type="button" className="btn btn-blue btn-sm" onClick={start} disabled={!target}><span className="btn-label">{st.pct >= 100 ? 'Revoir' : st.enrolled && st.done > 0 ? 'Continuer' : 'C’est parti'}</span><Icon name="arrowRight" size={15} /></button>
          : <button type="button" className="btn btn-blue btn-sm" onClick={() => { guide.close(); navigate({ page: 'course', courseId: course.id }); }}><span className="btn-label">Voir le cours</span><Icon name="arrowRight" size={15} /></button>}
        {g.mode === 'open' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => guide.close()}><span className="btn-label">Plus tard</span></button>}
      </div>
    </div>
  );
}

/** Her speech bubble: the line she is typing, or what she says about the current page. */
export function Say({ route, compact }: { route: Route; compact?: boolean }) {
  const v = useAvatar(); const s = useLearner(); const g = useGuide();
  if (g.courseId) return <GuideSay />;
  const line = pageLine(route, s);
  const discreet = (s.prefs.coach ?? 'encourage') === 'discreet';
  const thinking = v.status === 'thinking';
  return (
    <div className={cx('say', compact && 'is-compact')} aria-live="polite">
      {thinking ? <span className="typing" aria-label="Léa réfléchit"><i /><i /><i /></span>
        : v.bubble ? <p key={v.bubble.id} className="say-text"><Typed text={v.bubble.text} at={v.bubble.at} /></p>
        : discreet || !line.auto ? <p className="say-text"><Typed text={line.text} at={0} /></p>
        : <span className="typing" aria-label="Léa écrit"><i /><i /><i /></span>}
      {!thinking && v.bubble?.actions && v.bubble.actions.length > 0 && v.status !== 'speaking' && (
        <div className="say-actions">
          {v.bubble.actions.slice(0, 2).map((a, i) => <button key={i} type="button" className={cx('btn btn-sm', i === 0 ? 'btn-blue' : 'btn-line')} onClick={() => runAction(a)}><span className="btn-label">{a.label}</span>{i === 0 && <Icon name="arrowRight" size={14} />}</button>)}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- the field to ask her something
function Composer() {
  const [text, setText] = useState('');
  const [rec, setRec] = useState<{ stop: () => void } | null>(null);
  const chat = useChat();
  const send = () => { const t = text.trim(); if (!t || chat.busy) return; avatar.interacted = true; setText(''); void ask(t); };
  const mic = () => {
    if (rec) { rec.stop(); return; }
    avatar.setStatus('listening');
    setRec(listen({
      lang: 'fr-FR', onText: (t) => setText(t),
      onEnd: () => { setRec(null); if (avatar.view.status === 'listening') avatar.setStatus('idle'); },
      onError: () => { setRec(null); toast('La saisie vocale n’est pas disponible ici : écris ta question.'); },
    }));
  };
  return (
    <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
      <Icon name="sparkle" size={18} />
      <label htmlFor="coach-input" className="sr-only">Demande quelque chose à Léa</label>
      <input id="coach-input" value={text} maxLength={400} autoComplete="off" placeholder={rec ? 'Je t’écoute…' : 'Demande quelque chose à Léa…'}
        onChange={(e) => setText(e.target.value)} />
      {sttSupported && <button type="button" className={cx('composer-mic', rec && 'is-on')} aria-label={rec ? 'Arrêter la dictée' : 'Dicter ta question'} aria-pressed={!!rec} onClick={mic}><Icon name="mic" size={18} /></button>}
      <button type="submit" className="composer-send" aria-label="Envoyer à Léa" disabled={!text.trim() || chat.busy}><Icon name="send" size={18} /></button>
    </form>
  );
}

const STATUS_PILL: Record<string, string> = { idle: 'En ligne', speaking: 'En ligne', thinking: 'Réfléchit…', listening: 'T’écoute…' };

/** Header + portrait + bubble + page body + field. */
function CoachPanel({ route, mode, onClose }: { route: Route; mode: DockMode; onClose?: () => void }) {
  const v = useAvatar(); const ai = useAiStatus();
  const Body = bodies[route.page];
  const onChat = route.page === 'messages';
  return (
    <>
      <header className="rail-head">
        <div className="rail-who"><strong>Léa</strong><small>Ta coach d’apprentissage</small></div>
        <span className={cx('live-pill', v.status !== 'idle' && v.status !== 'speaking' && 'is-busy')} title={ai === 'available' ? 'Réponses en direct' : 'Réponses préparées'}><i aria-hidden="true" />{STATUS_PILL[v.status]}</span>
        {onClose && <button type="button" className="rail-x" aria-label="Fermer le panneau de Léa" onClick={onClose}><Icon name="x" size={16} /></button>}
      </header>
      <div className="rail-stage">
        <span className="rail-halo" aria-hidden="true" />
        <Lea framing="full" className="rail-lea" />
        {onChat && v.status === 'listening' && <span className="stage-status"><span className="typing" aria-hidden="true"><i /><i /><i /></span>Léa t’écoute…</span>}
      </div>
      {!onChat && <Say route={route} />}
      <div className={cx('rail-body', onChat && 'is-chat')}>{Body ? <Body route={route} /> : null}</div>
      {!onChat && <Composer />}
      {mode === 'bubble' && <span className="sr-only">Léa</span>}
    </>
  );
}

/** Speaks the page's line when the learner arrives on a page (not on the lesson and chat pages). */
function usePageVoice(route: Route) {
  const s = useLearner();
  const coach = s.prefs.coach ?? 'encourage';
  const key = `${route.page}:${route.courseId ?? ''}`;
  useEffect(() => {
    if (route.page === 'lesson' || route.page === 'messages') return;
    const line = pageLine(route, store.state);
    if (!line.auto || coach === 'discreet') return;
    const t = window.setTimeout(() => {
      if (line.enter) avatar.express(line.enter, 1100, line.mood);
      if (line.fx) avatar.burst(line.fx, 1800);
      void avatar.say(line.text, { mood: line.mood, id: `page:${key}`, hold: 6000 });
    }, 120);
    return () => window.clearTimeout(t);
  }, [key, coach]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function LeaDock({ mode }: { mode: DockMode }) {
  const route = useRoute();
  usePageVoice(route);
  if (mode === 'panel') return <aside className="rail is-panel" aria-label="Léa, ta coach">{<CoachPanel route={route} mode="panel" />}</aside>;
  return <LeaFloat route={route} />;
}

// ---------------------------------------------------------------- floating bubble
function LeaFloat({ route }: { route: Route }) {
  const open = usePop(); const v = useAvatar(); const g = useGuide();
  const [peek, setPeek] = useState<string | null>(null);
  const panel = useRef<HTMLElement>(null);
  // what she says pops up next to her bubble for a few seconds (answers and reactions, not page lines)
  useEffect(() => {
    if (!v.bubble || open || v.bubble.id.startsWith('page:') || route.page === 'lesson') return; // in a lesson she answers inside the feedback
    setPeek(v.bubble.id);
    const t = window.setTimeout(() => setPeek(null), 9000);
    return () => window.clearTimeout(t);
  }, [v.bubble?.id, open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setPop(false); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [open]);
  useEffect(() => { setPop(false); }, [route.page]);
  return (
    <>
      {open && (
        <aside ref={panel} className="rail is-pop" role="dialog" aria-label="Léa, ta coach">
          <CoachPanel route={route} mode="bubble" onClose={() => setPop(false)} />
        </aside>
      )}
      {!open && peek && v.bubble && !g.courseId && (
        <button type="button" className="fab-say" onClick={() => setPop(true)} aria-label="Ouvrir le panneau de Léa">
          <span className="fab-say-text"><Typed text={v.bubble.text} at={v.bubble.at} /></span>
        </button>
      )}
      <button type="button" className={cx('fab', open && 'is-open', v.status === 'thinking' && 'is-thinking')} onClick={() => { avatar.interacted = true; setPop(!open); }}
        aria-expanded={open} aria-label={open ? 'Fermer le panneau de Léa' : 'Parler à Léa, ta coach'}>
        <img src={leaAsset('face_light.webp')} alt="" draggable={false} />
        <i className="fab-dot" aria-hidden="true" />
      </button>
    </>
  );
}
