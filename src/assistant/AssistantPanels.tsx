import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Lea, STATUS_LABEL } from './Lea';
import { avatar, useAvatar, TYPE_CPS } from './controller';
import { ask, useChat, stopAnswer } from './assistant';
import { getAiStatus, onAiStatus, SUGGESTIONS_BY_PAGE } from './brain';
import { listen, sttSupported } from './speech';
import { store, useLearner } from '../state/store';
import { navigate } from '../router';
import { Icon } from '../components/icons';
import { Button, IconButton, cx, toast } from '../components/ui';
import type { AssistantAction, ChatMessage } from '../types';
import { getLesson } from '../data/courses';
import { timeHM, relative } from '../lib/dates';
import { overlays } from '../state/ui';

export const useAiStatus = () => useSyncExternalStore(onAiStatus, getAiStatus);

export function runAction(a: AssistantAction) {
  if (a.kind === 'lesson' && getLesson(a.lessonId)) navigate({ page: 'lesson', lessonId: a.lessonId });
  else if (a.kind === 'page') navigate({ page: a.page });
  else if (a.kind === 'ask') void ask(a.text);
  else if (a.kind === 'open') { if (a.target === 'newCourse') overlays.openNewCourse(); else overlays.openPayment(); }
}

export function StatusDot() {
  const v = useAvatar();
  return <span className={cx('status-dot', `st-${v.status}`)}><i aria-hidden="true" />{v.status === 'idle' ? 'En ligne' : STATUS_LABEL[v.status][0].toUpperCase() + STATUS_LABEL[v.status].slice(1)}</span>;
}

/** Text typed out as if Léa were saying it (shown at once with reduced motion). The full text is
 * laid out from the start, so the bubble keeps its size while the letters appear. `bold` puts the
 * first characters in bold on their own line (the dashboard greeting of the reference). */
export function Typed({ text, at, bold = 0, reserve = true }: { text: string; at: number; bold?: number; reserve?: boolean }) {
  const reduced = avatar.reduced;
  const count = () => (reduced ? text.length : Math.max(0, Math.min(text.length, Math.floor(((performance.now() - at) / 1000) * TYPE_CPS))));
  const [n, setN] = useState(count);
  useEffect(() => {
    let raf = 0;
    const step = () => { const k = count(); setN(k); if (k < text.length) raf = requestAnimationFrame(step); };
    step();
    return () => cancelAnimationFrame(raf);
  }, [text, at, reduced]); // eslint-disable-line react-hooks/exhaustive-deps
  const typing = n < text.length;
  const seg = (from: number, to: number) => {
    const shown = text.slice(from, Math.max(from, Math.min(n, to)));
    const rest = text.slice(Math.max(from, Math.min(n, to)), to);
    const caret = typing && n >= from && n < to;
    return <>{shown}{caret && <i className="caret" />}{reserve && rest && <span className="typed-rest">{rest}</span>}</>;
  };
  return (
    <>
      <span className={cx('typed', typing && 'is-typing')} aria-hidden="true">
        {bold > 0 ? <><strong>{seg(0, bold)}</strong><br />{seg(bold, text.length)}</> : seg(0, text.length)}
      </span>
      <span className="sr-only">{text}</span>
    </>
  );
}

/** Speech bubble with what Léa is saying, typed out as if she were talking. */
export function Bubble({ fallback, className, tail = 'right' }: { fallback: React.ReactNode; className?: string; tail?: 'right' | 'top' | 'left' }) {
  const v = useAvatar();
  return (
    <div className={cx('bubble', `tail-${tail}`, className)} aria-live="polite">
      {v.status === 'thinking' ? <span className="typing" aria-label="Léa réfléchit"><i /><i /><i /></span>
        : v.bubble ? <p key={v.bubble.id} className="bubble-text"><Typed text={v.bubble.text} at={v.bubble.at} /></p>
        : <p className="bubble-text">{fallback}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- chat
function MessageBubble({ m }: { m: ChatMessage }) {
  const chat = useChat();
  const streaming = chat.streamingId === m.id;
  return (
    <li className={cx('msg', `msg-${m.role}`, m.error && 'msg-error')}>
      {m.role === 'assistant' && <span className="msg-avatar"><Lea framing="face" live={false} decorative /></span>}
      <div className="msg-col">
        <div className="msg-bubble">
          {m.text ? m.text.split('\n').map((p, i) => <p key={i}>{p}</p>) : <span className="typing" aria-label="Réponse en cours"><i /><i /><i /></span>}
          {m.role === 'user' && <time dateTime={m.at}>{timeHM(new Date(m.at))}</time>}
        </div>
        {!!m.actions?.length && !streaming && (
          <div className="msg-actions">{m.actions.map((a, i) => <button key={i} type="button" className="chip chip-action" onClick={() => runAction(a)}>{a.label}<Icon name="arrowRight" size={14} /></button>)}</div>
        )}
        {m.role === 'assistant' && m.source && m.source !== 'system' && !streaming && (
          <span className="msg-meta">Léa · {relative(m.at)}</span>
        )}
      </div>
    </li>
  );
}

const EMOJIS = ['😊', '👍', '🙏', '💡', '🎉', '🤔'];

export function ChatPanel({ variant = 'page', onClose }: { variant?: 'page' | 'drawer'; onClose?: () => void }) {
  const s = useLearner(); const chat = useChat(); const v = useAvatar();
  const [text, setText] = useState('');
  const [emoji, setEmoji] = useState(false);
  const [menu, setMenu] = useState(false);
  const [rec, setRec] = useState<{ stop: () => void } | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const suggestions = SUGGESTIONS_BY_PAGE.default;

  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [s.conversation.length, s.conversation[s.conversation.length - 1]?.text, chat.busy]);

  const send = (t = text) => { if (!t.trim() || chat.busy) return; avatar.interacted = true; setText(''); setEmoji(false); void ask(t); };

  const toggleMic = () => {
    if (rec) { rec.stop(); return; }
    setMicError(null); avatar.setStatus('listening');
    const r = listen({
      lang: 'fr-FR',
      onText: (t, final) => { setText(t); if (final) inputRef.current?.focus(); },
      onEnd: () => { setRec(null); if (avatar.view.status === 'listening') avatar.setStatus('idle'); },
      onError: (code) => setMicError(code === 'not-allowed' || code === 'service-not-allowed' ? 'Le micro n’est pas autorisé dans cette vue. Tu peux écrire ton message.' : code === 'no-speech' ? 'Je n’ai rien entendu. Réessaie ou écris ton message.' : 'La saisie vocale n’est pas disponible ici. Tu peux écrire ton message.'),
    });
    setRec(r);
  };

  return (
    <section className={cx('chat', `chat-${variant}`)} aria-label="Conversation avec Léa">
      <header className="chat-head">
        <span className="chat-avatar"><Lea framing="face" live={false} /></span>
        <div className="chat-title">
          <h2>Léa · ton assistante</h2>
          <StatusDot />
        </div>
        <div className="menu-wrap">
          <IconButton icon="more" label="Options de la conversation" aria-expanded={menu} onClick={() => setMenu(!menu)} />
          {menu && (
            <div className="menu" role="menu" onMouseLeave={() => setMenu(false)}>
              <button role="menuitem" type="button" onClick={() => { setMenu(false); navigate({ page: 'settings' }); }}><Icon name="settings" size={16} />Réglages de l’assistante</button>
              <button role="menuitem" type="button" onClick={() => { setMenu(false); store.clearConversation(); toast('Conversation effacée'); }}><Icon name="x" size={16} />Effacer la conversation</button>
            </div>
          )}
        </div>
        {onClose && <IconButton icon="x" label="Fermer la conversation" onClick={onClose} />}
      </header>

      {chat.notice && <p className="chat-notice" role="status"><Icon name="info" size={15} />{chat.notice}</p>}

      <ol className="chat-list" ref={listRef} aria-live="polite" aria-relevant="additions">
        {s.conversation.length === 0 && (
          <li className="chat-empty"><Icon name="chat" size={22} /><p>Pose-moi une question sur tes cours, demande un indice ou ta prochaine leçon.</p></li>
        )}
        {s.conversation.map((m) => <MessageBubble key={m.id} m={m} />)}
        {chat.busy && !chat.streamingId && (
          <li className="msg msg-assistant"><span className="msg-avatar"><Lea framing="face" live={false} decorative /></span><div className="msg-col"><div className="msg-bubble"><span className="typing" aria-label="Léa réfléchit"><i /><i /><i /></span></div></div></li>
        )}
      </ol>

      <div className="chat-suggestions" role="group" aria-label="Suggestions">
        {suggestions.map((t) => <button key={t} type="button" className="chip" disabled={chat.busy} onClick={() => send(t)}>{t}</button>)}
      </div>

      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <label htmlFor={`chat-text-${variant}`} className="sr-only">Écris un message</label>
        <div className="chat-field">
          <textarea id={`chat-text-${variant}`} ref={inputRef} rows={1} value={text} placeholder={rec ? 'Je t’écoute…' : 'Écris un message…'} maxLength={600}
            onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <div className="emoji-wrap">
            <IconButton icon="smile" label="Insérer un emoji" aria-expanded={emoji} onClick={() => setEmoji(!emoji)} />
            {emoji && <div className="emoji-pop" role="menu">{EMOJIS.map((e) => <button type="button" role="menuitem" key={e} onClick={() => { setText((t) => t + e); setEmoji(false); inputRef.current?.focus(); }}>{e}</button>)}</div>}
          </div>
          {sttSupported && <IconButton icon="mic" label={rec ? 'Arrêter l’écoute' : 'Dicter un message'} className={cx(rec && 'is-recording')} aria-pressed={!!rec} onClick={toggleMic} />}
        </div>
        {chat.busy && chat.streamingId
          ? <button type="button" className="send-btn" aria-label="Arrêter la réponse" onClick={stopAnswer}><Icon name="stop" size={18} /></button>
          : <button type="submit" className="send-btn" aria-label="Envoyer" disabled={!text.trim() || chat.busy}><Icon name="send" size={20} /></button>}
      </form>
      {micError && <p className="chat-error" role="alert">{micError}</p>}
      {v.status === 'listening' && <p className="sr-only" role="status">Écoute en cours</p>}
    </section>
  );
}

// ---------------------------------------------------------------- drawer + launcher
let drawerOpen = false; const dl = new Set<() => void>();
export const openAssistant = (open = true) => { drawerOpen = open; dl.forEach((l) => l()); };
const useDrawer = () => useSyncExternalStore((l) => { dl.add(l); return () => dl.delete(l); }, () => drawerOpen);

export function AssistantDrawer() {
  const open = useDrawer();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') openAssistant(false); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  if (!open) return null;
  return (
    <div className="drawer-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) openAssistant(false); }}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Assistante Léa">
        <ChatPanel variant="drawer" onClose={() => openAssistant(false)} />
      </aside>
    </div>
  );
}

export function AssistantLauncher() {
  const v = useAvatar(); const open = useDrawer();
  if (open) return null;
  return (
    <button type="button" className={cx('launcher', v.status === 'speaking' && 'is-speaking')} onClick={() => { avatar.interacted = true; openAssistant(true); }} aria-label="Parler à Léa, ton assistante">
      <span className="launcher-avatar"><Lea framing="face" live={false} decorative /></span>
      <span className="launcher-label">Besoin d’aide ?</span>
    </button>
  );
}

export function AskButton({ children = 'Demander à Léa' }: { children?: React.ReactNode }) {
  return <Button variant="secondary" size="sm" icon="chat" onClick={() => { avatar.interacted = true; openAssistant(true); }}>{children}</Button>;
}
