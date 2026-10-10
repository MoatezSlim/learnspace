// Léa's rig: frames of her character sheet (upscaled ×4, background removed, aligned on one canvas).
// Every front-facing expression is composited on the same head (tools/asset-pipeline/face_composite.py),
// so her hair, neck and outfit stay pixel-identical when only her face changes. Frames where she looks
// at the viewer carry an eye rig: the irises are drawn on top in SVG so they can follow the pointer,
// and procedural eyelids make her blink. Her lips never move.
// A single animation loop drives every visible instance; React only mounts the DOM.
// Motion: the eyes follow quickly (saccades); the head follows the same target through a critically
// damped spring, so it eases in and out and never inherits the eyes' jumps.
import framesJson from '../lea-frames.json';
import type { Mood, Pose } from './controller';

export interface EyeRig {
  top: number[][]; bottom: number[][];
  iris: [number, number, number];
  range: [number, number];
  lid: string; lash: string;
}
export interface Frame { src: string; eyes: EyeRig[] }
export interface LeaFrames {
  canvas: [number, number];
  eyeMid: [number, number];
  iris: { src: string; r: number; size: number };
  frames: Record<string, Frame>;
}
export const LEA = framesJson as unknown as LeaFrames;
export const leaAsset = (p: string) => `assets/lea/${p}`;

/** Sheet frame shown for each mood / pose */
const MOOD_FRAME: Record<Mood, string> = {
  neutral: 'neutral', smile: 'smile', encouraging: 'smile', happy: 'happy', excited: 'excited', delighted: 'delighted',
  laugh: 'laugh', wink: 'wink', wink2: 'wink2', content: 'content', thinking: 'thinking', curious: 'curious',
  surprised: 'surprised', concerned: 'surprised', sad: 'sad', skeptical: 'skeptical', confused: 'skeptical',
};
const POSE_FRAME: Record<Pose, string> = { downLeft: 'downLeft', downRight: 'downRight', shy: 'shy', shyLeft: 'shyLeft', lookUp: 'lookUp' };
/** Frames drawn with their own head (hand on the chin, head tilted or turned, laughing): their hair
 * differs from the shared head, so changing to or from them uses a longer dissolve. */
export const OWN_HEAD = new Set(['thinking', 'curious', 'skeptical', 'laugh']);
/** Dissolve duration (ms) between two frames */
export function fadeMs(from: string | null, to: string): number {
  if (!from) return 0;
  return OWN_HEAD.has(from) || OWN_HEAD.has(to) ? 560 : 300;
}
export function frameFor(mood: Mood, pose: Pose | null): string {
  const f = pose ? POSE_FRAME[pose] : MOOD_FRAME[mood];
  return LEA.frames[f] ? f : LEA.frames[MOOD_FRAME[mood]] ? MOOD_FRAME[mood] : 'neutral';
}

const [W, H] = LEA.canvas;
/** Visible area of the canvas for each framing, in canvas pixels: x, y, width, height.
 * The canvas is the aligned head-and-shoulders frame (eyes at ~39 % of its height). */
const k = W / 418;
export const CROPS = {
  hero: [-88 * k, -34 * k, 594 * k, 653 * k] as const,    // dashboard: head to necklace (cards cover the rest)
  bust: [-46 * k, -8 * k, 510 * k, 690 * k] as const,    // panels: head and shoulders
  guide: [-30 * k, -6 * k, 478 * k, 640 * k] as const,   // course pop-up
  tall: [-40 * k, -8 * k, 498 * k, 790 * k] as const,    // conversation stage
  face: [34 * k, 150 * k, 350 * k, 350 * k] as const,
  full: [0, 0, W, H] as const,                           // coach panel: the whole canvas (the panel crops it)
};
export type Framing = keyof typeof CROPS;

const pt = (p: number[]) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
export function almondPath(e: EyeRig) {
  const pts = [...e.top, ...[...e.bottom].reverse()];
  return `M${pts.map(pt).join('L')}Z`;
}
function lerpCurve(a: number[][], b: number[][], t: number) {
  return a.map((p, i) => [p[0] + (b[i][0] - p[0]) * t, p[1] + (b[i][1] - p[1]) * t]);
}
/** Upper eyelid closing to fraction t (0 open, 1 closed) */
export function lidPath(e: EyeRig, t: number) {
  const edge = lerpCurve(e.top, e.bottom, t);
  const top = e.top.map((p) => [p[0], p[1] - 4]);
  top[0] = [top[0][0] - 2.5, top[0][1] + 2]; top[top.length - 1] = [top[top.length - 1][0] + 2.5, top[top.length - 1][1] + 2];
  return `M${top.map(pt).join('L')}L${[...edge].reverse().map(pt).join('L')}Z`;
}
export function lashPath(e: EyeRig, t: number) {
  const edge = lerpCurve(e.top, e.bottom, t);
  return `M${edge.map(pt).join('L')}`;
}

// ------------------------------------------------------------------ shared live state
/** What the controller asks for; the loop reads it every frame. */
export const live = {
  gaze: null as { x: number; y: number } | null, // override (-1..1) when not following the pointer
  nodUntil: 0,
  hopUntil: 0,
  shakeUntil: 0,
  droop: 0,                                         // 0..1: head lowered (sad)
  tilt: 0,                                          // extra head tilt in degrees
  reduced: false,
  /** no animation at all: still picture (no eye tracking, no blinking) */
  still: false,
};

interface Inst {
  el: HTMLElement;
  stage: HTMLElement;
  head: HTMLElement;
  iris: SVGGraphicsElement[];
  lid: SVGPathElement[];
  lash: SVGPathElement[];
  gx: number; gy: number;                 // eyes (fast)
  hx: number; hy: number; hvx: number; hvy: number;   // head (spring)
  droop: number; dv: number;
  tilt: number; tv: number;
  visible: boolean;
  io?: IntersectionObserver;
  mo?: MutationObserver;
}
const insts = new Set<Inst>();
let pointer: { x: number; y: number; t: number } | null = null;
let raf = 0;
let last = 0;
let blink = { next: 0, start: -1, double: false };
let wander = { x: 0, y: 0, next: 0 };
let listening = false;

function onPointer(e: PointerEvent | MouseEvent) { pointer = { x: e.clientX, y: e.clientY, t: performance.now() }; kick(); }
function onTouch(e: TouchEvent) { const t = e.touches[0]; if (t) { pointer = { x: t.clientX, y: t.clientY, t: performance.now() }; kick(); } }

function ensureListeners() {
  if (listening) return; listening = true;
  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('pointerdown', onPointer, { passive: true });
  window.addEventListener('touchstart', onTouch, { passive: true });
  document.addEventListener('visibilitychange', kick);
}

function query(inst: Inst) {
  const q = <T extends Element>(s: string) => Array.from(inst.el.querySelectorAll<T>(s) as NodeListOf<T>);
  inst.iris = q<SVGGraphicsElement>("[data-iris]");
  inst.lid = q<SVGPathElement>('[data-lid]');
  inst.lash = q<SVGPathElement>('[data-lash]');
}

/** Mount a live instance; returns the cleanup. */
export function registerLea(el: HTMLElement): () => void {
  ensureListeners();
  const inst: Inst = {
    el,
    stage: el.querySelector('.lea-stage') as HTMLElement,
    head: el.querySelector('.lea-head') as HTMLElement,
    iris: [], lid: [], lash: [],
    gx: 0, gy: 0, hx: 0, hy: 0, hvx: 0, hvy: 0, droop: 0, dv: 0, tilt: 0, tv: 0, visible: true,
  };
  query(inst);
  // expression layers come and go: refresh the live nodes when they do
  inst.mo = new MutationObserver(() => { query(inst); kick(); });
  inst.mo.observe(el, { childList: true, subtree: true });
  if ('IntersectionObserver' in window) {
    inst.io = new IntersectionObserver(([e]) => { inst.visible = e.isIntersecting; kick(); }, { rootMargin: '60px' });
    inst.io.observe(el);
  }
  insts.add(inst); kick();
  return () => { inst.io?.disconnect(); inst.mo?.disconnect(); insts.delete(inst); };
}

export function kick() { if (!raf && typeof document !== 'undefined' && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(tick); } }

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rand = (a: number, b: number) => a + Math.random() * (b - a);
/** Critically damped spring step (smooth start and stop, no overshoot). Returns [x, v]. */
function spring(x: number, v: number, target: number, omega: number, dt: number): [number, number] {
  // sub-steps keep it stable on slow frames
  const n = Math.max(1, Math.ceil(dt / 0.016));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    const a = omega * omega * (target - x) - 2 * omega * v;
    v += a * h; x += v * h;
  }
  return [x, v];
}
/** 0..1 progress of a timed gesture, or -1 when it is not running */
function progress(until: number, dur: number, now: number) {
  return until > now ? clamp(1 - (until - now) / dur, 0, 1) : -1;
}
const smooth = (t: number) => t * t * (3 - 2 * t);
/** Durations of the gestures (ms) */
export const GESTURE_MS = { nod: 1000, hop: 760, shake: 1000 };
/** Start a head gesture; one that is already running carries on instead of snapping back to its start. */
export function gesture(kind: keyof typeof GESTURE_MS, delay = 0) {
  const key = (kind + 'Until') as 'nodUntil' | 'hopUntil' | 'shakeUntil';
  const now = performance.now();
  if (live[key] > now) return;
  live[key] = now + delay + GESTURE_MS[kind];
  kick();
}

function blinkValue(now: number) {
  if (blink.start < 0) {
    if (!blink.next) blink.next = now + rand(1800, 4200);
    if (now >= blink.next) { blink.start = now; blink.double = Math.random() < 0.16; }
    else return 0;
  }
  const t = now - blink.start;
  const close = 70, hold = 40, open = 110;
  const one = close + hold + open;
  const phase = (x: number) => (x < close ? x / close : x < close + hold ? 1 : x < one ? 1 - (x - close - hold) / open : -1);
  let v = phase(t);
  if (v < 0 && blink.double) { const t2 = t - one - 90; v = t2 < 0 ? 0 : phase(t2); if (v < 0) v = -1; }
  if (v < 0) { blink.start = -1; blink.next = now + rand(2400, 6200); return 0; }
  return v * v * (3 - 2 * v); // ease
}

function eyeOf(n: Element): EyeRig | undefined {
  const f = LEA.frames[(n as HTMLElement).dataset.f ?? ''];
  return f?.eyes[Number((n as HTMLElement).dataset.e ?? 0)];
}

function tick(now: number) {
  raf = 0;
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (document.hidden) return;
  const visible = [...insts].filter((i) => i.visible);
  if (!visible.length) return;

  const b = live.still ? 0 : blinkValue(now);
  const active = pointer && now - pointer.t < 4000;
  if (!active && now > wander.next) {
    // idle: look at the viewer most of the time, with small glances
    const r = Math.random();
    wander = r < 0.55 ? { x: rand(-0.12, 0.12), y: rand(-0.05, 0.1), next: now + rand(1600, 3600) }
      : { x: rand(-0.75, 0.75), y: rand(-0.35, 0.35), next: now + rand(700, 1500) };
  }
  // gestures: each one starts and ends at rest with zero speed (sine envelopes), so nothing snaps
  const pn = progress(live.nodUntil, GESTURE_MS.nod, now);
  const nod = pn < 0 ? 0 : Math.sin(pn * Math.PI * 2) * Math.sin(pn * Math.PI);          // one soft nod
  const ph = progress(live.hopUntil, GESTURE_MS.hop, now);
  const hop = ph < 0 ? 0 : Math.pow(Math.sin(ph * Math.PI), 2);                         // small lift
  const ps = progress(live.shakeUntil, GESTURE_MS.shake, now);
  const shake = ps < 0 ? 0 : Math.sin(ps * Math.PI * 4) * Math.sin(ps * Math.PI) * (1 - 0.35 * smooth(ps)); // two gentle swings

  for (const inst of visible) {
    let tx = 0, ty = 0;
    if (live.still) { tx = 0; ty = 0; }
    else if (active && pointer) {
      const r = inst.stage.getBoundingClientRect();
      const ex = r.left + (LEA.eyeMid[0] / W) * r.width;
      const ey = r.top + (LEA.eyeMid[1] / H) * r.height;
      const dx = pointer.x - ex, dy = pointer.y - ey;
      tx = clamp(dx / (Math.abs(dx) + 170), -1, 1);
      ty = clamp(dy / (Math.abs(dy) + 150), -1, 1);
    } else if (live.gaze) { tx = live.gaze.x; ty = live.gaze.y; }
    else { tx = wander.x; ty = wander.y; }
    // eyes: fast, saccade-like follow
    const jump = Math.hypot(tx - inst.gx, ty - inst.gy) > 0.3;
    const k = 1 - Math.exp(-dt * (jump ? 26 : 14));
    inst.gx += (tx - inst.gx) * k; inst.gy += (ty - inst.gy) * k;
    // head: follows the same target slowly through a spring (eases in and out, no jumps)
    [inst.hx, inst.hvx] = spring(inst.hx, inst.hvx, tx, 4.2, dt);
    [inst.hy, inst.hvy] = spring(inst.hy, inst.hvy, ty, 4.2, dt);
    [inst.droop, inst.dv] = spring(inst.droop, inst.dv, live.droop, 3.4, dt);
    [inst.tilt, inst.tv] = spring(inst.tilt, inst.tv, live.tilt, 3.4, dt);

    for (const n of inst.iris) {
      const e = eyeOf(n); if (!e) continue;
      n.setAttribute('transform', `translate(${(inst.gx * e.range[0]).toFixed(2)} ${(inst.gy * e.range[1]).toFixed(2)})`);
    }
    if (!live.reduced) {
      const rot = inst.hx * 1.1 + inst.tilt + nod * 0.5 + shake * 1.7 - inst.droop * 2.0;
      const x = inst.hx * 0.6 + shake * 0.35;
      const y = inst.hy * 0.35 + nod * 0.45 - hop * 1.8 + inst.droop * 1.3;
      inst.head.style.transform = `translate3d(${x.toFixed(3)}%, ${y.toFixed(3)}%, 0) rotate(${rot.toFixed(3)}deg)`;
    } else if (inst.head.style.transform) inst.head.style.transform = '';

    for (const n of inst.lid) {
      const e = eyeOf(n); if (!e) continue;
      if (b > 0.02) { n.setAttribute('d', lidPath(e, b)); n.style.display = ''; }
      else if (n.style.display !== 'none') n.style.display = 'none';
    }
    for (const n of inst.lash) {
      const e = eyeOf(n); if (!e) continue;
      if (b > 0.02) { n.setAttribute('d', lashPath(e, b)); n.style.display = ''; }
      else if (n.style.display !== 'none') n.style.display = 'none';
    }
  }
  raf = requestAnimationFrame(tick);
}

/** Preload the frames so expression changes are instant. */
export function preloadLea() {
  const urls = [...new Set(Object.values(LEA.frames).map((f) => f.src)), LEA.iris.src, 'face.webp', 'face_light.webp'];
  const run = () => urls.forEach((u) => { const i = new Image(); i.decoding = 'async'; i.src = leaAsset(u); });
  if ('requestIdleCallback' in window) (window as any).requestIdleCallback(run, { timeout: 1500 }); else setTimeout(run, 300);
}
