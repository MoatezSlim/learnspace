import React, { useEffect, useId, useRef, useState } from 'react';
import { LEA, CROPS, Framing, leaAsset, almondPath, registerLea, frameFor, fadeMs, live as rig } from './leaRig';
import { useAvatar } from './controller';
import type { Mood, Pose, Status } from './controller';
import { cx } from '../components/ui';

export const STATUS_LABEL: Record<Status, string> = { idle: 'disponible', listening: 't’écoute', thinking: 'réfléchit', speaking: 'te répond' };

const [W, H] = LEA.canvas;

/** One frame of the sheet, with its live eyes when she looks at the viewer. A new frame dissolves in
 * on top of the previous one (which stays fully visible underneath, so nothing flickers). */
function Layer({ name, uid, fade, eyes }: { name: string; uid: string; fade: number; eyes: boolean }) {
  const f = LEA.frames[name];
  const ir = LEA.iris;
  return (
    <div className={cx('lea-layer', fade > 0 && 'is-entering')} data-name={name} style={fade > 0 ? { animationDuration: `${fade}ms` } : undefined}>
      <img className="lea-base" src={leaAsset(f.src)} alt="" draggable={false} decoding="async" />
      {eyes && f.eyes.length > 0 && (
        <svg className="lea-fx" viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">
          <defs>
            {f.eyes.map((e, i) => <clipPath id={`${uid}${name}c${i}`} key={i}><path d={almondPath(e)} /></clipPath>)}
            <linearGradient id={`${uid}${name}sh`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1c1628" stopOpacity="0.5" />
              <stop offset="0.42" stopColor="#1c1628" stopOpacity="0" />
            </linearGradient>
          </defs>
          {f.eyes.map((e, i) => {
            const s = e.iris[2] / ir.r; const size = ir.size * s;
            return (
              <g key={i}>
                <g clipPath={`url(#${uid}${name}c${i})`}>
                  <g data-iris="" data-f={name} data-e={i}>
                    <image href={leaAsset(ir.src)} x={e.iris[0] - size / 2} y={e.iris[1] - size / 2} width={size} height={size} />
                    <circle cx={e.iris[0] + e.iris[2] * 0.36} cy={e.iris[1] - e.iris[2] * 0.42} r={e.iris[2] * 0.17} fill="#fff" opacity="0.92" />
                  </g>
                  <path d={almondPath(e)} fill={`url(#${uid}${name}sh)`} />
                </g>
                <path data-lid="" data-f={name} data-e={i} fill={e.lid} style={{ display: 'none' }} />
                <path data-lash="" data-f={name} data-e={i} fill="none" stroke={e.lash} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'none' }} />
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

function Effects({ kind }: { kind: string }) {
  const n = kind === 'confetti' ? 18 : kind === 'rain' ? 7 : 9;
  return (
    <div className={cx('lea-effects', `fx-${kind}`)} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => <i key={i} style={{ ['--i' as any]: i, ['--n' as any]: n }} />)}
    </div>
  );
}

/**
 * Léa, drawn from her character sheet. `live` instances follow the pointer with their eyes, blink,
 * breathe and change expression with the assistant's mood; static ones (tiny avatars) use a
 * pre-rendered face. Her lips never move.
 */
export function Lea({ framing = 'bust', live = true, className, label = 'Léa, ton assistante', decorative, mood: forcedMood, pose: forcedPose }: {
  framing?: Framing; live?: boolean; className?: string; label?: string; decorative?: boolean; mood?: Mood; pose?: Pose | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const v = useAvatar();
  const name = frameFor(forcedMood ?? v.mood, forcedPose !== undefined ? forcedPose : v.pose);
  // stack of frames: the top one dissolves in; the ones under it are dropped once it is fully visible.
  // A change during a dissolve simply stacks another layer, so an interrupted dissolve never snaps.
  const seq = useRef(0);
  const [stack, setStack] = useState<{ name: string; id: number; fade: number }[]>(() => [{ name, id: 0, fade: 0 }]);
  useEffect(() => (live && ref.current ? registerLea(ref.current) : undefined), [live]);
  useEffect(() => {
    setStack((st) => {
      const top = st[st.length - 1];
      if (top.name === name) return st;
      const fade = rig.reduced ? 0 : fadeMs(top.name, name);
      return [...st, { name, id: ++seq.current, fade }].slice(-4);
    });
  }, [name]);
  useEffect(() => {
    if (stack.length < 2) return;
    const top = stack[stack.length - 1];
    const t = window.setTimeout(() => setStack((st) => (st[st.length - 1].id === top.id ? [top] : st)), top.fade + 60);
    return () => window.clearTimeout(t);
  }, [stack]);
  const cur = stack[stack.length - 1].name;
  const [x, y, w, h] = CROPS[framing];
  const a11y = decorative ? { 'aria-hidden': true as const } : { role: 'img', 'aria-label': label };

  if (!live && framing === 'face') {
    return (
      <div className={cx('lea', 'lea-face', 'lea-static', className)} {...a11y}>
        <img src={leaAsset('face.webp')} alt="" draggable={false} decoding="async" />
      </div>
    );
  }
  return (
    <div ref={ref} className={cx('lea', `lea-${framing}`, className)} style={{ aspectRatio: `${w} / ${h}` }} data-frame={cur} {...a11y}>
      <div className="lea-stage" style={{ width: `${(W / w) * 100}%`, left: `${(-x / w) * 100}%`, top: `${(-y / h) * 100}%`, aspectRatio: `${W} / ${H}` }}>
        <div className="lea-breathe">
          <div className="lea-head">
            {stack.map((l) => <Layer key={l.id} name={l.name} uid={`${uid}l${l.id}`} fade={l.fade} eyes={live} />)}
          </div>
        </div>
      </div>
      {live && v.fx && <Effects key={v.fx.id} kind={v.fx.kind} />}
    </div>
  );
}

/** Small round photo used for profile chips (matches the reference design). */
export function LeaPhoto({ className, light = true }: { className?: string; light?: boolean }) {
  return <img className={cx('lea-photo', className)} src={leaAsset(light ? 'face_light.webp' : 'face.webp')} alt="" draggable={false} decoding="async" />;
}
