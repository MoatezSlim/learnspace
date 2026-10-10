// Assistant controller: one shared state for every place Léa appears.
// Léa does not speak aloud and her lips do not move: her lines appear in a speech bubble, typed
// out as if she were talking, while her face (frames of the character sheet) reacts — happy when
// the learner does well, sad when they do not.
import { useSyncExternalStore } from 'react';
import { live, kick, gesture } from './leaRig';

export type Mood =
  | 'neutral' | 'smile' | 'happy' | 'excited' | 'delighted' | 'laugh' | 'wink' | 'content'
  | 'thinking' | 'curious' | 'surprised' | 'sad' | 'skeptical'
  // older names still used by some call sites
  | 'encouraging' | 'concerned' | 'confused';
export type Pose = 'downLeft' | 'downRight' | 'shy' | 'shyLeft' | 'lookUp';
export type Status = 'idle' | 'listening' | 'thinking' | 'speaking';
export type Reaction = 'hello' | 'correct' | 'incorrect' | 'reveal' | 'celebrate' | 'fail' | 'explain' | 'point';
export type Fx = 'sparkle' | 'confetti' | 'rain';

export interface AvatarView {
  status: Status;
  mood: Mood;
  pose: Pose | null;
  bubble: { id: string; text: string; at: number } | null;
  fx: { id: number; kind: Fx } | null;
}

/** Characters per second of the typed speech bubble. */
export const TYPE_CPS = 42;
export const typingMs = (text: string) => Math.min(6000, Math.max(700, (text.length / TYPE_CPS) * 1000));

type Step = { mood?: Mood; pose?: Pose | null; ms: number };

class AvatarController {
  view: AvatarView = { status: 'idle', mood: 'neutral', pose: null, bubble: null, fx: null };
  private listeners = new Set<() => void>();
  private token = 0;
  private timers: number[] = [];
  private seq = 0;
  private restTimer: number | undefined;
  private idleTimer: number | undefined;
  private fxTimer: number | undefined;
  private fxId = 0;
  private lastSpoken: { text: string; mood: Mood } | null = null;
  reduced = false;
  interacted = false;
  page = 'home';

  subscribe = (l: () => void) => { this.listeners.add(l); return () => this.listeners.delete(l); };
  get = () => this.view;
  private set(p: Partial<AvatarView>) {
    this.view = { ...this.view, ...p };
    live.droop = this.view.mood === 'sad' ? 1 : 0; // a sad face lowers her head a little
    this.listeners.forEach((l) => l()); kick();
  }

  start() { this.scheduleIdle(); }

  setPage(page: string) {
    if (page === this.page) return;
    this.page = page;
    this.clearTimeline();
    window.clearTimeout(this.restTimer);
    this.token++;
    this.set({ bubble: null, status: 'idle', mood: 'neutral', pose: null });
  }
  setFocus(_on: boolean) { /* reading mode: the idle loop already keeps her calm */ }

  setStatus(status: Status) {
    live.gaze = null;
    live.tilt = status === 'listening' ? 1.5 : 0;
    const mood: Mood = status === 'thinking' ? 'thinking' : status === 'listening' ? 'curious' : this.view.mood === 'thinking' || this.view.mood === 'curious' ? 'smile' : this.view.mood;
    this.set({ status, mood, pose: null });
  }

  /** Show an expression for a while, then come back to her resting face. */
  express(mood: Mood, ms = 2600, rest: Mood = 'neutral') {
    this.play([{ mood, ms }], rest);
  }

  /** Non-verbal reaction: expressions from the sheet, small head moves and effects. */
  react(kind: Reaction, mood?: Mood) {
    switch (kind) {
      case 'hello':
        gesture('nod');
        this.play([{ mood: 'wink', ms: 900 }], mood ?? 'smile');
        break;
      case 'correct':
        gesture('hop');
        this.burst('sparkle');
        this.play([{ mood: 'excited', ms: 1700 }], mood ?? 'happy');
        break;
      case 'celebrate':
        gesture('hop'); gesture('nod', 500);
        this.burst('confetti', 2600);
        this.play([{ mood: 'laugh', ms: 1700 }, { mood: 'excited', ms: 1300 }], mood ?? 'happy');
        break;
      case 'incorrect':
        gesture('shake');
        this.play([{ mood: 'surprised', ms: 520 }], mood ?? 'sad');
        break;
      case 'reveal':
        gesture('shake');
        this.play([{ mood: 'sad', ms: 1300 }], mood ?? 'sad');
        break;
      case 'fail':
        this.burst('rain', 2400);
        this.play([{ mood: 'sad', ms: 1600 }], mood ?? 'sad');
        break;
      case 'explain':
      case 'point':
        gesture('nod');
        this.play([{ mood: 'happy', ms: 1000 }], mood ?? 'happy');
        break;
    }
  }

  /** Back-compat for older call sites. */
  perform(_steps: unknown[], restMood: Mood = 'smile') { this.react('hello', restMood); }

  /** A line in the speech bubble, typed out as if she were talking. */
  say(text: string, opts: SayOptions = {}): Promise<void> {
    const token = ++this.token;
    const mood = opts.mood ?? 'smile';
    this.lastSpoken = { text, mood };
    window.clearTimeout(this.restTimer);
    const busy = this.timers.length > 0; // a reaction is playing: let it finish, then rest on `mood`
    if (busy) this.restMood = mood; else this.set({ mood, pose: null });
    this.set({ bubble: { id: opts.id ?? String(token), text, at: performance.now() }, status: 'speaking' });
    const ms = this.reduced ? 0 : typingMs(text);
    return new Promise<void>((resolve) => {
      window.setTimeout(() => {
        if (token === this.token) {
          this.set({ status: 'idle' });
          this.restTimer = window.setTimeout(() => { if (token === this.token && !this.timers.length) this.set({ mood: 'neutral', pose: null }); }, opts.hold ?? 4200);
        }
        resolve();
      }, ms);
    });
  }

  private restMood: Mood = 'neutral';
  private play(steps: Step[], rest: Mood) {
    this.clearTimeline();
    const id = ++this.seq;
    this.restMood = rest;
    let t = 0;
    steps.forEach((s, i) => {
      const run = () => { if (id === this.seq) this.set({ mood: s.mood ?? this.view.mood, pose: s.pose ?? null }); };
      if (i === 0) run(); else this.timers.push(window.setTimeout(run, t));
      t += s.ms;
    });
    this.timers.push(window.setTimeout(() => {
      if (id !== this.seq) return;
      this.timers = [];
      this.set({ mood: this.restMood, pose: null });
      window.clearTimeout(this.restTimer);
      this.restTimer = window.setTimeout(() => { if (id === this.seq && this.view.status !== 'speaking' && !this.timers.length) this.set({ mood: 'neutral' }); }, 5200);
    }, t));
  }
  private clearTimeline() { this.timers.forEach((x) => window.clearTimeout(x)); this.timers = []; }

  private burst(kind: Fx, ms = 1600) {
    if (this.reduced) return;
    window.clearTimeout(this.fxTimer);
    this.set({ fx: { id: ++this.fxId, kind } });
    this.fxTimer = window.setTimeout(() => this.set({ fx: null }), ms);
  }

  /** While nothing happens she alternates between her calm face and a light smile. */
  private scheduleIdle() {
    window.clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => {
      const v = this.view;
      if (v.status === 'idle' && !this.timers.length && !v.pose && (v.mood === 'neutral' || v.mood === 'smile')) {
        this.set({ mood: v.mood === 'neutral' ? 'smile' : 'neutral' });
      }
      this.scheduleIdle();
    }, 7000 + Math.random() * 7000);
  }

  stopSpeaking() {
    this.token++;
    if (this.view.status === 'speaking') this.set({ status: 'idle' });
  }
  replay() { if (this.lastSpoken) void this.say(this.lastSpoken.text, { mood: this.lastSpoken.mood }); }
  get hasReplay() { return !!this.lastSpoken; }
  hideBubble() { this.set({ bubble: null }); }
}

export interface SayOptions { mood?: Mood; speak?: boolean; id?: string; hold?: number; gestures?: boolean }

export const avatar = new AvatarController();
export const useAvatar = () => useSyncExternalStore(avatar.subscribe, avatar.get);
