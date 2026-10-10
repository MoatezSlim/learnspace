import React, { useId, useState } from 'react';
import { cx } from './ui';
import { Icon } from './icons';

// Hand-built charts for the redesign. Each has a text alternative (aria-label or a hidden table).

// ---------------------------------------------------------------- week bars
export interface DayBar { short: string; long: string; minutes: number | null; today?: boolean }

/** Minutes per day with the daily goal as a dashed line. Future days are empty slots. */
export function WeekBars({ days, goal, caption, height = 190 }: { days: DayBar[]; goal: number; caption: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const top = Math.max(goal * 2, ...days.map((d) => d.minutes ?? 0));
  const max = Math.ceil(top / 10) * 10 + 4;
  const pct = (v: number) => `${(v / max) * 100}%`;
  return (
    <div className="wb" style={{ height }}>
      <div className="wb-plot" onMouseLeave={() => setHover(null)}>
        <span className="wb-goal" style={{ bottom: pct(goal) }}><em>Objectif {goal} min</em></span>
        {days.map((d, i) => (
          <button key={i} type="button" className={cx('wb-col', d.today && 'is-today', d.minutes === null && 'is-future', hover === i && 'is-hover', (d.minutes ?? 0) >= goal && 'met')}
            onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
            aria-label={`${d.long} : ${d.minutes === null ? 'à venir' : `${d.minutes} min${d.minutes >= goal ? ', objectif atteint' : ''}`}`}>
            <span className="wb-track">
              {d.minutes !== null && <span className="wb-bar" style={{ height: d.minutes ? `max(6px, ${pct(d.minutes)})` : '4px' }}>{(d.today || hover === i) && d.minutes > 0 && <b>{d.minutes}</b>}</span>}
            </span>
            <span className="wb-day">{d.short}</span>
          </button>
        ))}
      </div>
      <table className="sr-only"><caption>{caption}</caption><tbody>{days.map((d, i) => <tr key={i}><th scope="row">{d.long}</th><td>{d.minutes === null ? 'à venir' : `${d.minutes} min`}</td></tr>)}</tbody></table>
    </div>
  );
}

// ---------------------------------------------------------------- sparkline
export function Spark({ values, color = 'var(--blue)', width = 110, height = 40, label }: { values: number[]; color?: string; width?: number; height?: number; label?: string }) {
  const id = `sp${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [3 + (i / (values.length - 1)) * (width - 6), 4 + (1 - (v - min) / span) * (height - 10)] as const);
  const d = smoothPath(pts);
  const last = pts[pts.length - 1];
  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".22" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={`${d}L${last[0].toFixed(1)} ${height}L${pts[0][0].toFixed(1)} ${height}Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3.4" fill="#fff" stroke={color} strokeWidth="2" />
    </svg>
  );
}

/** Catmull-Rom spline through points, as cubic Bézier segments. */
export function smoothPath(pts: readonly (readonly [number, number])[]) {
  if (!pts.length) return '';
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

// ---------------------------------------------------------------- regularity map
const HEAT = ['#EEF2F8', '#C9D9FF', '#8FB0FF', '#4F86FF', '#1F55E0'];
export const heatLevel = (m: number) => (m <= 0 ? 0 : m < 10 ? 1 : m < 20 ? 2 : m < 30 ? 3 : 4);
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const WD = ['Lun', '', 'Mer', '', 'Ven', '', 'Dim'];

export function Heatmap({ cols, today }: { cols: { date: Date; minutes: number; future: boolean }[][]; today: Date }) {
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const tkey = today.toDateString();
  const fmt = (d: Date) => `${['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'][d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return (
    <div className="hm" onMouseLeave={() => setTip(null)}>
      <div className="hm-months" aria-hidden="true">
        <span />
        {cols.map((c, i) => { const first = c.find((d) => d.date.getDate() <= 7 && d.date.getDay() === 1) ?? (i === 0 ? c[0] : null); return <span key={i}>{first && (i === 0 || first.date.getDate() <= 7) ? MONTHS[first.date.getMonth()] : ''}</span>; })}
      </div>
      <div className="hm-body">
        <div className="hm-wd" aria-hidden="true">{WD.map((w, i) => <span key={i}>{w}</span>)}</div>
        <div className="hm-grid" role="img" aria-label={`Minutes d’apprentissage par jour sur ${cols.length} semaines`}>
          {cols.map((c, i) => (
            <div key={i} className="hm-col">
              {c.map((d, k) => (
                <i key={k} className={cx(`lv${heatLevel(d.minutes)}`, d.future && 'future', d.date.toDateString() === tkey && 'today')}
                  onMouseEnter={(e) => { if (d.future) return; const r = (e.currentTarget.parentElement!.parentElement!.parentElement!.parentElement as HTMLElement).getBoundingClientRect(); const b = e.currentTarget.getBoundingClientRect(); setTip({ x: b.left - r.left + b.width / 2, y: b.top - r.top, text: `${fmt(d.date)} · ${d.minutes ? `${d.minutes} min` : 'repos'}` }); }} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="hm-legend" aria-hidden="true">Moins {HEAT.map((c) => <i key={c} style={{ background: c }} />)} Plus</div>
      {tip && <span className="hm-tip" style={{ left: tip.x, top: tip.y }} role="status">{tip.text}</span>}
    </div>
  );
}

// ---------------------------------------------------------------- radar
export function Radar({ items, max = 5, size = 300 }: { items: { label: string; sub: string; value: number }[]; max?: number; size?: number }) {
  const n = items.length; const cx0 = size / 2, cy0 = size / 2 + 6; const R = size * 0.3;
  const at = (i: number, r: number) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [cx0 + Math.cos(a) * r, cy0 + Math.sin(a) * r] as const; };
  const poly = (r: (i: number) => number) => items.map((_, i) => at(i, r(i)).map((v) => v.toFixed(1)).join(',')).join(' ');
  if (n < 3) return null;
  return (
    <svg className="radar" viewBox={`0 0 ${size} ${size + 12}`} role="img" aria-label={items.map((x) => `${x.label} : ${x.sub}`).join(', ')}>
      {[1, 2, 3, 4, 5].filter((l) => l <= max).map((l) => <polygon key={l} points={poly(() => (R * l) / max)} className={cx('radar-ring', l === max && 'outer')} />)}
      {items.map((_, i) => { const [x, y] = at(i, R); return <line key={i} x1={cx0} y1={cy0} x2={x} y2={y} className="radar-axis" />; })}
      <polygon points={poly((i) => Math.max(0.35, items[i].value) * (R / max))} className="radar-shape" />
      {items.map((it, i) => { const [x, y] = at(i, Math.max(0.35, it.value) * (R / max)); return <circle key={i} cx={x} cy={y} r="4.5" className="radar-dot" />; })}
      {items.map((it, i) => {
        const [x, y] = at(i, R + 26); const anchor = Math.abs(x - cx0) < 8 ? 'middle' : x > cx0 ? 'start' : 'end';
        const dy = y < cy0 - R * 0.5 ? -8 : y > cy0 + R * 0.5 ? 10 : 0;
        return (
          <text key={i} x={x + (anchor === 'start' ? -6 : anchor === 'end' ? 6 : 0)} y={y + dy} textAnchor={anchor} className="radar-label">
            <tspan x={x + (anchor === 'start' ? -6 : anchor === 'end' ? 6 : 0)} className="radar-name">{it.label}</tspan>
            <tspan x={x + (anchor === 'start' ? -6 : anchor === 'end' ? 6 : 0)} dy="15" className="radar-sub">{it.sub}</tspan>
          </text>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------- learning path
export interface PathNode { label: string; state: 'done' | 'current' | 'todo'; pct?: number }

/** The course as a winding path: finished modules, the current one with its progress, the goal flag. */
export function PathTrack({ nodes, dark, beads = 0, beadsDone = 0 }: { nodes: PathNode[]; dark?: boolean; beads?: number; beadsDone?: number }) {
  const id = `pt${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const W = 620, H = 128, pad = 34;
  const n = nodes.length;
  const pts = nodes.map((_, i) => [pad + (i * (W - pad * 2)) / Math.max(1, n - 1), 50 + Math.sin(i * 1.15 + 0.4) * 16] as const);
  const cur = Math.max(0, nodes.findIndex((x) => x.state === 'current'));
  const doneUpTo = nodes.every((x) => x.state === 'done') ? n - 1 : cur;
  const full = smoothPath(pts);
  const donePath = smoothPath(pts.slice(0, doneUpTo + 1));
  // beads: lessons of the current module, between the current node and the next
  const beadPts = cur < n - 1 && beads > 0 ? Array.from({ length: beads }, (_, k) => {
    const t = (k + 1) / (beads + 1); const a = pts[cur], b = pts[cur + 1];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + Math.sin(t * Math.PI) * (cur % 2 ? -6 : 6)] as const;
  }) : [];
  return (
    <svg className={cx('path-track', dark && 'is-dark')} viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={nodes.map((x, i) => `Module ${i + 1}, ${x.label} : ${x.state === 'done' ? 'terminé' : x.state === 'current' ? `en cours (${x.pct ?? 0} %)` : 'à venir'}`).join(' ; ')}>
      <defs>
        <radialGradient id={`${id}glow`}><stop offset="0" stopColor="#6E97FF" stopOpacity=".7" /><stop offset="1" stopColor="#6E97FF" stopOpacity="0" /></radialGradient>
        <linearGradient id={`${id}done`} x1="0" x2="1"><stop offset="0" stopColor="#46D49D" /><stop offset="1" stopColor="#16A472" /></linearGradient>
      </defs>
      <path d={full} className="pt-rest" />
      {doneUpTo > 0 && <path d={donePath} className="pt-done" stroke={`url(#${id}done)`} />}
      {beadPts.map(([x, y], k) => <circle key={k} cx={x} cy={y} r="3.6" className={cx('pt-bead', k < beadsDone && 'on')} />)}
      {pts.map(([x, y], i) => {
        const node = nodes[i]; const last = i === n - 1;
        if (node.state === 'done') return (
          <g key={i} transform={`translate(${x} ${y})`}><circle r="13" className="pt-node-done" /><path d="m-5 .5 3.4 3.4L5.6-4" className="pt-check" /></g>
        );
        if (node.state === 'current') {
          const r = 15, c = 2 * Math.PI * r, p = Math.max(0.04, (node.pct ?? 0) / 100);
          return (
            <g key={i} transform={`translate(${x} ${y})`}>
              <circle r="30" fill={`url(#${id}glow)`} />
              <circle r={r} className="pt-ring-track" />
              <circle r={r} className="pt-ring" strokeDasharray={c} strokeDashoffset={c * (1 - p)} transform="rotate(-90)" />
              <circle r="9" className="pt-node-cur" />
            </g>
          );
        }
        return (
          <g key={i} transform={`translate(${x} ${y})`}>
            <circle r={last ? 14 : 11} className="pt-node-todo" />
            {last && <path d="M-4 6V-6.5M-4-6h8.5l-2 3 2 3H-4" className="pt-flag" />}
          </g>
        );
      })}
      {pts.map(([x, y], i) => <text key={`t${i}`} x={x} y={y + 36} textAnchor="middle" className={cx('pt-label', nodes[i].state === 'current' && 'is-current')}>{nodes[i].label}</text>)}
    </svg>
  );
}

/** Small horizontal comparison bar (per course, per skill). */
export function HBar({ value, max, tone = 'blue', label }: { value: number; max: number; tone?: 'blue' | 'soft' | 'mint' | 'flame'; label?: string }) {
  return <span className={cx('hbar', `hbar-${tone}`)} role={label ? 'img' : undefined} aria-label={label}><i style={{ width: `${max ? Math.min(100, (value / max) * 100) : 0}%` }} /></span>;
}

export const Check = ({ on }: { on: boolean }) => <span className={cx('tick', on && 'on')} aria-hidden="true">{on && <Icon name="check" size={13} />}</span>;
