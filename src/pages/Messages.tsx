import React, { useEffect, useRef, useState } from 'react';
import { useLearner, store } from '../state/store';
import { useChat, ask, stopAnswer } from '../assistant/assistant';
import { avatar, useAvatar } from '../assistant/controller';
import { runAction } from '../assistant/AssistantPanels';
import { Lea, LeaPhoto } from '../assistant/Lea';
import { registerRail } from '../assistant/LeaDock';
import { listen, sttSupported } from '../assistant/speech';
import { getCourse, getLesson, KIND_LABEL } from '../data/courses';
import { courseStats } from '../state/selectors';
import { moduleStats, peakHours } from '../state/insights';
import { ACHIEVEMENTS } from '../state/achievements';
import { navigate } from '../router';
import { Icon, Flag } from '../components/icons';
import { cx, Rich, toast, ProgressBar, Button } from '../components/ui';
import { timeHM, relative, daysBetween, shortDate } from '../lib/dates';
import type { ChatCard, ChatMessage, LearnerState, Route } from '../types';

const CEFR_NEXT: Record<string, string> = { A1: 'A2', A2: 'B1', B1: 'B2', B2: 'C1', C1: 'C2' };
const hm = (iso: string) => timeHM(new Date(iso)).replace(':', ' h ');

function Card({ card }: { card: ChatCard }) {
  const s = useLearner();
  if (card.kind === 'course') {
    const c = getCourse(card.courseId); if (!c) return null;
    const st = courseStats(s, c);
    return (
      <button type="button" className="msg-card mc-course" onClick={() => navigate({ page: 'course', courseId: c.id })}>
        <span className="mcc-top">
          {c.flag && <Flag code={c.flag} size={34} />}
          <span className="mcc-title"><strong>{c.title}</strong><small>{st.module ? `Module ${st.module.index} : ${st.module.title}` : 'Parcours terminé'}</small></span>
          <b className="mcc-pct num">{st.pct} %</b>
        </span>
        <span className="mcc-bars" aria-hidden="true">{c.modules.map((m) => { const x = moduleStats(s, m); return <i key={m.id} className={cx(x.complete && 'done')}><b style={{ width: `${(x.done / x.total) * 100}%` }} /></i>; })}</span>
      </button>
    );
  }
  if (card.kind === 'words') {
    return (
      <div className="msg-card mc-words">
        {card.items.map((w) => (
          <div key={w.term} className="mcw-row">
            <strong lang="en">{w.term}</strong>
            <span><span lang="en">{w.ex}</span>{s.prefs.translate !== false && <small>{w.fr}</small>}</span>
          </div>
        ))}
      </div>
    );
  }
  const l = getLesson(card.lessonId); if (!l) return null;
  return (
    <button type="button" className="msg-card mc-lesson" onClick={() => navigate({ page: 'lesson', lessonId: l.id })}>
      <Icon name="play" size={14} /><strong>{l.title}</strong><small>{KIND_LABEL[l.kind]} · {l.minutes} min</small>
    </button>
  );
}

function Message({ m, streaming }: { m: ChatMessage; streaming: boolean }) {
  const mine = m.role === 'user';
  return (
    <li className={cx('msg', mine ? 'msg-me' : 'msg-lea', m.error && 'msg-error')}>
      {!mine && <LeaPhoto className="msg-face" />}
      <div className="msg-col">
        <div className="msg-bubble">
          {m.text ? m.text.split('\n').map((p, i) => <p key={i}><Rich text={p} /></p>) : <span className="typing" aria-label="Réponse en cours"><i /><i /><i /></span>}
          {m.card && !streaming && <Card card={m.card} />}
          {!!m.actions?.length && !streaming && (
            <div className="msg-actions">{m.actions.map((a, i) => <button key={i} type="button" className={cx('btn btn-sm', i === 0 ? 'btn-blue' : 'btn-line')} onClick={() => runAction(a)}>{i === 0 && <Icon name={a.kind === 'lesson' ? 'play' : 'arrowRight'} size={14} />}<span className="btn-label">{a.label}</span></button>)}</div>
          )}
        </div>
        <span className="msg-meta">{mine ? <>{hm(m.at)}<Icon name="check" size={13} /></> : `Léa, ${daysBetween(new Date(m.at), new Date()) === 0 ? hm(m.at) : relative(m.at)}`}</span>
      </div>
    </li>
  );
}

/** Suggestions under the conversation, depending on Léa's last answer. */
function suggestions(s: LearnerState) {
  const last = [...s.conversation].reverse().find((m) => m.role === 'assistant');
  const c = getCourse(s.currentCourseId)!;
  const done = c.modules.filter((m) => moduleStats(s, m).complete).pop();
  const out: { text: string; icon: 'target' | 'replay' | 'translate' | 'pencil' | 'progress' | 'play' }[] = [];
  if (last?.card?.kind === 'words') out.push({ text: 'Un exercice sur ces mots', icon: 'target' });
  else out.push({ text: 'Un exercice rapide', icon: 'target' });
  if (done) out.push({ text: `Réviser le module ${done.index}`, icon: 'replay' });
  out.push({ text: 'Traduire une phrase', icon: 'translate' });
  out.push({ text: 'Prochaine leçon', icon: 'play' });
  return out;
}

function History({ s }: { s: LearnerState }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('mousedown', close); return () => window.removeEventListener('mousedown', close);
  }, [open]);
  const chats = s.chats ?? [];
  return (
    <div className="popover-wrap" ref={ref}>
      <Button variant="line" icon="history" aria-expanded={open} onClick={() => setOpen(!open)}>Historique</Button>
      {open && (
        <div className="popover menu history-pop" role="menu">
          {chats.length === 0 ? <p className="muted small" style={{ padding: 10 }}>Aucune autre discussion pour l’instant.</p>
            : chats.map((t) => <button key={t.id} type="button" role="menuitem" onClick={() => { setOpen(false); store.openThread(t.id); }}><Icon name="chat" size={16} /><span>{t.title}</span><small>{shortDate(new Date(t.at))}</small></button>)}
        </div>
      )}
    </div>
  );
}

export function MessagesPage({ mobile }: { mobile: boolean }) {
  const s = useLearner(); const chat = useChat(); const v = useAvatar();
  const [text, setText] = useState('');
  const [rec, setRec] = useState<{ stop: () => void } | null>(null);
  const [plus, setPlus] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [s.conversation.length, s.conversation[s.conversation.length - 1]?.text, chat.busy]);
  // while the learner types, Léa listens
  useEffect(() => {
    if (text.trim() && !chat.busy && avatar.view.status === 'idle') avatar.setStatus('listening');
    if (!text.trim() && avatar.view.status === 'listening' && !rec) avatar.setStatus('idle');
  }, [text, chat.busy, rec]);
  useEffect(() => () => { if (avatar.view.status === 'listening') avatar.setStatus('idle'); }, []);
  const send = (t = text) => { if (!t.trim() || chat.busy) return; avatar.interacted = true; setText(''); setPlus(false); void ask(t); };
  const newChat = () => { store.newConversation({ role: 'assistant', source: 'demo', text: `Nouvelle discussion ! Que veux-tu travailler, ${s.profile.firstName} ?` }); toast('La discussion précédente est dans l’historique', 'success'); };
  const toggleMic = () => {
    if (rec) { rec.stop(); return; }
    avatar.setStatus('listening');
    setRec(listen({
      lang: 'fr-FR', onText: (t, final) => { setText(t); if (final) inputRef.current?.focus(); },
      onEnd: () => { setRec(null); if (avatar.view.status === 'listening') avatar.setStatus('idle'); },
      onError: (code) => toast(code === 'not-allowed' || code === 'service-not-allowed' ? 'Le micro n’est pas autorisé ici : écris ton message.' : 'La saisie vocale n’est pas disponible ici : écris ton message.'),
    }));
  };
  const sugg = suggestions(s);

  const list = (
    <ol className="chat-list" ref={listRef} aria-live="polite" aria-relevant="additions">
      {s.conversation.length === 0 && <li className="chat-empty"><Icon name="chat" size={22} /><p>Pose-moi une question sur tes cours, demande un exercice ou ta prochaine leçon.</p></li>}
      {s.conversation.map((m) => <Message key={m.id} m={m} streaming={chat.streamingId === m.id} />)}
      {chat.busy && !chat.streamingId && <li className="msg msg-lea"><LeaPhoto className="msg-face" /><div className="msg-col"><div className="msg-bubble is-typing"><span className="typing" aria-label="Léa réfléchit"><i /><i /><i /></span></div></div></li>}
    </ol>
  );
  const composer = (
    <>
      <div className="chat-chips" role="group" aria-label="Suggestions">
        {sugg.map((x) => <button key={x.text} type="button" className="chip chip-ask" disabled={chat.busy} onClick={() => send(x.text)}><Icon name={x.icon} size={15} />{x.text}</button>)}
      </div>
      <form className="chat-composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <div className="popover-wrap">
          <button type="button" className="cc-plus" aria-label="Idées de questions" aria-expanded={plus} onClick={() => setPlus(!plus)}><Icon name="plus" size={20} /></button>
          {plus && (
            <div className="popover menu cc-menu" role="menu">
              {['Où en suis-je ?', 'Planifier ma semaine', 'Quelle est la différence entre « say » et « tell » ?', 'Comment gagner « Curiosité » ?'].map((q) => <button key={q} type="button" role="menuitem" onClick={() => send(q)}><Icon name="sparkle" size={15} />{q}</button>)}
            </div>
          )}
        </div>
        <label htmlFor="chat-text" className="sr-only">Écris un message à Léa</label>
        <textarea id="chat-text" ref={inputRef} rows={1} value={text} placeholder={rec ? 'Je t’écoute…' : mobile ? 'Écris à Léa…' : 'Écris à Léa : une question, un mot, une phrase à corriger…'} maxLength={600}
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
        {sttSupported && <button type="button" className={cx('cc-mic', rec && 'is-on')} aria-label={rec ? 'Arrêter la dictée' : 'Dicter un message'} aria-pressed={!!rec} onClick={toggleMic}><Icon name="mic" size={19} /></button>}
        {chat.busy && chat.streamingId
          ? <button type="button" className="cc-send" aria-label="Arrêter la réponse" onClick={stopAnswer}><Icon name="stop" size={18} /></button>
          : <button type="submit" className="cc-send" aria-label="Envoyer" disabled={!text.trim() || chat.busy}>{!mobile && <span>Envoyer</span>}<Icon name="send" size={18} /></button>}
      </form>
    </>
  );

  if (mobile) {
    return (
      <div className="page chat-m">
        <header className="cm-head">
          <button type="button" className="cm-btn" onClick={() => (history.length > 1 ? history.back() : navigate({ page: 'home' }))} aria-label="Retour"><Icon name="arrowLeft" size={20} /></button>
          <div className="cm-lea">
            <span className="cm-face"><Lea framing="face" label="Léa, ta coach" /></span>
            <span className="cm-name"><strong>Léa</strong><small className={cx(v.status !== 'idle' && v.status !== 'speaking' && 'busy')}><i className="cm-dot" aria-hidden="true" />{v.status === 'thinking' ? 'Réfléchit…' : v.status === 'listening' ? 'T’écoute…' : 'En ligne'}</small></span>
          </div>
          <button type="button" className="cm-btn" onClick={newChat} aria-label="Nouvelle discussion"><Icon name="plus" size={20} /></button>
        </header>
        {chat.notice && <p className="chat-notice" role="status"><Icon name="info" size={15} />{chat.notice}</p>}
        {list}
        <div className="cm-bottom">{composer}</div>
      </div>
    );
  }
  return (
    <div className="page chat-page">
      <header className="page-head chat-head">
        <div><h1>Discussion avec Léa</h1><p className="lead">Pose une question sur un cours, demande une révision ou un conseil d’organisation.</p></div>
        <div className="chat-head-actions"><History s={s} /><Button onClick={newChat} icon="plus">Nouvelle discussion</Button></div>
      </header>
      <section className="card chat-card" aria-label="Conversation avec Léa">
        {chat.notice && <p className="chat-notice" role="status"><Icon name="info" size={15} />{chat.notice}</p>}
        {list}
        {composer}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- Léa's panel next to the conversation
function ChatRail(_: { route: Route }) {
  const s = useLearner();
  const c = getCourse(s.currentCourseId)!;
  const ph = peakHours(s);
  const curious = ACHIEVEMENTS.find((a) => a.id === 'curious')!;
  const cp = curious.progress(s);
  const chats = (s.chats ?? []).slice(0, 4);
  return (
    <>
      <section className="rail-sec" aria-labelledby="know-title">
        <div className="rail-sec-head"><h3 id="know-title">Ce que Léa sait de toi</h3><button type="button" className="link" onClick={() => navigate({ page: 'settings' })}>Modifier</button></div>
        <ul className="facts">
          <li className="fact"><span className="fact-ic"><Icon name="target" size={18} /></span><span className="fact-body"><small>Ton objectif</small><strong>{s.profile.goal?.trim() || 'À préciser dans tes paramètres'}</strong></span></li>
          <li className="fact"><span className="fact-ic is-mint"><Icon name="step" size={18} /></span><span className="fact-body"><small>Ton niveau</small><strong>{c.shortTitle}{c.cefr ? ` ${c.cefr}${CEFR_NEXT[c.cefr] ? `, en route vers le ${CEFR_NEXT[c.cefr]}` : ''}` : ''}</strong></span></li>
          <li className="fact"><span className="fact-ic is-flame"><Icon name="clock" size={18} /></span><span className="fact-body"><small>Ton rythme</small><strong>{s.profile.dailyGoalMin} minutes par jour{ph ? `, plutôt ${ph.moment === 'à l’heure du déjeuner' ? 'à midi' : ph.moment}` : ''}</strong></span></li>
        </ul>
      </section>
      {chats.length > 0 && (
        <section className="rail-sec" aria-labelledby="recent-title">
          <div className="rail-sec-head"><h3 id="recent-title">Discussions récentes</h3></div>
          <ul className="threads">
            {chats.map((t) => <li key={t.id}><button type="button" onClick={() => store.openThread(t.id)}><Icon name="chat" size={16} /><span>{t.title}</span><small>{daysBetween(new Date(t.at), new Date()) === 1 ? 'Hier' : shortDate(new Date(t.at))}</small></button></li>)}
          </ul>
        </section>
      )}
      {!s.achievements.curious && (
        <button type="button" className="badge-tease" onClick={() => navigate({ page: 'badges' })}>
          <span className="bt-medal" aria-hidden="true"><Icon name="medal" size={22} /></span>
          <span><strong>Badge {curious.title} : {Math.min(cp.cur, cp.target)} sur {cp.target}</strong><small>{cp.target - cp.cur === 1 ? 'Encore une question pour le débloquer' : `Encore ${cp.target - cp.cur} questions pour le débloquer`}</small>
            <ProgressBar value={(cp.cur / cp.target) * 100} size="xs" tone="gold" label={`${cp.cur} sur ${cp.target}`} /></span>
        </button>
      )}
    </>
  );
}
registerRail('messages', ChatRail);
