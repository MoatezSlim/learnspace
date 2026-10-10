// High-level assistant API used by pages: contextual reactions and the chat.
import { useSyncExternalStore } from 'react';
import { avatar, Mood } from './controller';
import { askLive, demoReply, getAiStatus, BrainContext, Reply, stripTags } from './brain';
import { store } from '../state/store';
import type { Lesson, PageId } from '../types';
import { getLesson } from '../data/courses';
import { LINES } from './lines';
import { recommendation } from '../state/selectors';
import { achievement } from '../state/achievements';

let context: BrainContext = { page: 'home' };
export const setAssistantPage = (page: PageId) => { context = { ...context, page, lesson: page === 'lesson' ? context.lesson : undefined }; };
export const setLessonContext = (lesson: BrainContext['lesson']) => { context = { ...context, lesson }; };
export const getContext = () => context;

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

/** Contextual reactions: her face reacts and the line is typed in her bubble (not added to the chat). */
export const react = {
  /** Dashboard: a wink, then what the reference bubble says. */
  greet() {
    avatar.react('hello', 'smile');
    return avatar.say(LINES.dashIntro, { mood: 'smile' });
  },
  recommend() {
    const rec = recommendation(store.state); if (!rec) return Promise.resolve();
    avatar.react('point');
    return avatar.say(LINES.recommend(rec.lesson), { mood: 'happy' });
  },
  lessonStart(l: Lesson) {
    const text = l.kind === 'assessment' ? LINES.intro.assessment(Math.round((l.passMark ?? 0.7) * 100)) : LINES.intro[l.kind];
    avatar.react('explain');
    return avatar.say(text, { mood: 'smile' });
  },
  /** Good answer: she lights up. */
  correct(questionId: string, lesson: Lesson) {
    avatar.react('correct', 'happy');
    const main = lesson.content?.heading === 'Listen and answer' && questionId === 'q1';
    return avatar.say(main ? LINES.correctMain : pick(LINES.correct), { mood: 'happy' });
  },
  /** Wrong answer: she is sad for the learner (a little sadder when the correction is shown). */
  incorrect(firstTry: boolean) {
    avatar.react(firstTry ? 'incorrect' : 'reveal', 'sad');
    return avatar.say(firstTry ? LINES.incorrectFirst : LINES.incorrectReveal, { mood: 'sad' });
  },
  complete(l: Lesson, passed: boolean, newBadges: string[]) {
    if (!passed) {
      avatar.react('fail', 'sad');
      return avatar.say(LINES.completeFail(Math.round((l.passMark ?? 0.7) * 100)), { mood: 'sad', hold: 6000 });
    }
    avatar.react('celebrate', 'happy');
    return avatar.say(newBadges.length ? LINES.completeBadge(achievement(newBadges[0]).title) : LINES.completePass, { mood: 'happy' });
  },
  say(text: string, mood: Mood = 'smile') { return avatar.say(text, { mood }); },
};

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------
interface ChatState { busy: boolean; streamingId: string | null; notice: string | null }
let chat: ChatState = { busy: false, streamingId: null, notice: null };
const chatListeners = new Set<() => void>();
const setChat = (p: Partial<ChatState>) => { chat = { ...chat, ...p }; chatListeners.forEach((l) => l()); };
export const useChat = () => useSyncExternalStore((l) => { chatListeners.add(l); return () => chatListeners.delete(l); }, () => chat);
let controller: AbortController | null = null;

export function stopAnswer() { controller?.abort(); }

export async function ask(text: string) {
  const t = text.trim(); if (!t || chat.busy) return;
  store.addMessage({ role: 'user', text: t });
  setChat({ busy: true, notice: null });
  avatar.stopSpeaking();
  avatar.setStatus('thinking');
  const ctx = context;
  const useLive = store.state.prefs.aiMode === 'live' && getAiStatus() === 'available';
  let reply: Reply;
  if (useLive) {
    const id = store.addMessage({ role: 'assistant', text: '', source: 'live' });
    setChat({ streamingId: id });
    controller = new AbortController();
    try {
      let first = true;
      reply = await askLive(store.state.conversation.filter((m) => m.id !== id), store.state, ctx, (partial) => {
        if (first && partial) { first = false; avatar.setStatus('idle'); }
        store.updateMessage(id, { text: partial }, false);
      }, controller.signal);
      store.updateMessage(id, { text: reply.text, actions: reply.actions });
    } catch (e: any) {
      const code: string = e?.code ?? 'upstream_error';
      if (code === 'cancelled') {
        const partial = stripTags(e?.text ?? store.state.conversation.find((m) => m.id === id)?.text ?? '');
        store.updateMessage(id, { text: partial ? `${partial} …` : 'Réponse interrompue.', error: !partial });
        setChat({ busy: false, streamingId: null }); avatar.setStatus('idle'); store.checkBadges(); return;
      }
      // fall back to the prepared answers and say so
      reply = demoReply(t, store.state, ctx);
      const notice = code === 'not_granted' || code === 'sampling_disabled'
        ? 'Les réponses en direct ne sont pas autorisées sur cette page : Léa te donne une réponse préparée.'
        : code === 'rate_limited' ? 'Léa est très sollicitée en ce moment : voici une réponse préparée.'
        : 'Léa n’a pas pu répondre en direct : voici une réponse préparée.';
      store.updateMessage(id, { text: reply.text, actions: reply.actions, source: 'demo' });
      setChat({ notice });
      if (code === 'not_granted' || code === 'sampling_disabled') store.setPrefs({ aiMode: 'demo' });
    }
    setChat({ streamingId: null });
  } else {
    await new Promise((r) => setTimeout(r, 450 + Math.random() * 400));
    reply = demoReply(t, store.state, ctx);
    store.addMessage({ role: 'assistant', text: reply.text, source: 'demo', actions: reply.actions });
  }
  setChat({ busy: false });
  store.checkBadges();
  avatar.setStatus('idle');
  void avatar.say(reply.text, { mood: reply.mood });
}

export const lessonForAction = (id: string) => getLesson(id);
