import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cx } from './ui';

// Hand-built SVG charts: one series each (no legend needed), recessive grid, hover/keyboard tooltip.

function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null); const [w, setW] = useState(600);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export interface Point { label: string; short: string; value: number }

export function AreaChart({ data, height = 220, max = 100, unit = '%', title }: { data: Point[]; height?: number; max?: number; unit?: string; title: string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 40, r: 44, t: 16, b: 28 };
  const iw = w - pad.l - pad.r, ih = height - pad.t - pad.b;
  const x = (i: number) => pad.l + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const ticks = [0, 25, 50, 75, 100].map((t) => (t / 100) * max);
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join('');
  const area = `${line}L${x(data.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;
  const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(iw / 72))));
  const last = data[data.length - 1];
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect(); const px = e.clientX - r.left;
    setHover(Math.max(0, Math.min(data.length - 1, Math.round(((px - pad.l) / iw) * (data.length - 1)))));
  };
  const h = hover !== null ? data[hover] : null;
  return (
    <div className="chart" ref={ref}>
      <svg width={w} height={height} role="img" aria-label={`${title} : de ${data[0]?.value} ${unit} à ${last?.value} ${unit}`} tabIndex={0}
        onPointerMove={onMove} onPointerLeave={() => setHover(null)}
        onKeyDown={(e) => { if (e.key === 'ArrowRight') setHover((v) => Math.min(data.length - 1, (v ?? -1) + 1)); if (e.key === 'ArrowLeft') setHover((v) => Math.max(0, (v ?? data.length) - 1)); if (e.key === 'Escape') setHover(null); }}
        onBlur={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} className="grid" />
            <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="tick">{Math.round(t)}{unit}</text>
          </g>
        ))}
        {data.map((d, i) => (i % every === 0 || i === data.length - 1) && (i === data.length - 1 || data.length - 1 - i >= every * 0.6) ? <text key={i} x={x(i)} y={height - 8} textAnchor="middle" className="tick">{d.short}</text> : null)}
        <path d={area} className="area" />
        <path d={line} className="line" />
        {last && <>
          <circle cx={x(data.length - 1)} cy={y(last.value)} r={5} className="dot" />
          <g transform={`translate(${Math.min(w - 22, x(data.length - 1))},${y(last.value) - 18})`}>
            <rect x={-20} y={-11} width={40} height={20} rx={6} className="end-pill" />
            <text textAnchor="middle" dy="0.32em" className="end-label">{last.value}{unit}</text>
          </g>
        </>}
        {h && hover !== null && <>
          <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} className="crosshair" />
          <circle cx={x(hover)} cy={y(h.value)} r={5} className="dot" />
        </>}
      </svg>
      {h && hover !== null && (
        <div className="tooltip" style={{ left: Math.min(w - 150, Math.max(0, x(hover) - 70)), top: Math.max(0, y(h.value) - 62) }} role="status">
          <span>{h.label}</span><strong>{h.value}{unit}</strong>
        </div>
      )}
    </div>
  );
}

export function BarChart({ data, height = 200, goal, unit = 'min', title }: { data: Point[]; height?: number; goal?: number; unit?: string; title: string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 40, r: 16, t: 14, b: 28 };
  const iw = w - pad.l - pad.r, ih = height - pad.t - pad.b;
  const rawMax = Math.max(goal ?? 0, ...data.map((d) => d.value), 10);
  const step = rawMax > 120 ? 60 : rawMax > 60 ? 30 : rawMax > 30 ? 15 : 10;
  const max = Math.ceil(rawMax / step) * step;
  const ticks = Array.from({ length: max / step + 1 }, (_, i) => i * step);
  const band = iw / data.length; const bw = Math.min(24, band * 0.62);
  const x = (i: number) => pad.l + band * i + (band - bw) / 2;
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(iw / 44))));
  const bar = (i: number, v: number) => {
    const top = y(v), bottom = y(0), r = Math.min(4, (bottom - top) / 2, bw / 2), x0 = x(i), x1 = x0 + bw;
    if (v <= 0) return '';
    return `M${x0},${bottom}V${top + r}Q${x0},${top} ${x0 + r},${top}H${x1 - r}Q${x1},${top} ${x1},${top + r}V${bottom}Z`;
  };
  const h = hover !== null ? data[hover] : null;
  const fmt = (v: number) => unit === 'min' && v >= 60 ? `${Math.floor(v / 60)}h${String(v % 60).padStart(2, '0')}` : `${v} ${unit}`;
  return (
    <div className="chart" ref={ref}>
      <svg width={w} height={height} role="img" aria-label={`${title} : total ${data.reduce((a, d) => a + d.value, 0)} ${unit}`} tabIndex={0}
        onPointerLeave={() => setHover(null)} onBlur={() => setHover(null)}
        onKeyDown={(e) => { if (e.key === 'ArrowRight') setHover((v) => Math.min(data.length - 1, (v ?? -1) + 1)); if (e.key === 'ArrowLeft') setHover((v) => Math.max(0, (v ?? data.length) - 1)); if (e.key === 'Escape') setHover(null); }}>
        {ticks.map((t) => (
          <g key={t}><line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} className="grid" /><text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="tick">{t}</text></g>
        ))}
        {goal ? <g><line x1={pad.l} x2={w - pad.r} y1={y(goal)} y2={y(goal)} className="goal" /><text x={w - pad.r} y={y(goal) - 5} textAnchor="end" className="goal-label">Objectif {goal} min</text></g> : null}
        {data.map((d, i) => (
          <g key={i} onPointerEnter={() => setHover(i)}>
            <rect x={pad.l + band * i} y={pad.t} width={band} height={ih} fill="transparent" />
            <path d={bar(i, d.value)} className={cx('bar-mark', hover === i && 'hot', !!goal && d.value >= goal && 'met')} />
            {(i % every === 0 || i === data.length - 1) && (i === data.length - 1 || data.length - 1 - i >= every * 0.6) && <text x={x(i) + bw / 2} y={height - 8} textAnchor="middle" className="tick">{d.short}</text>}
          </g>
        ))}
      </svg>
      {h && hover !== null && (
        <div className="tooltip" style={{ left: Math.min(w - 150, Math.max(0, x(hover) - 60)), top: Math.max(0, y(h.value) - 62) }} role="status">
          <span>{h.label}</span><strong>{fmt(h.value)}</strong>
        </div>
      )}
    </div>
  );
}

/** Accessible table alternative for any chart */
export function DataTable({ caption, rows, unit }: { caption: string; rows: Point[]; unit: string }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <caption className="sr-only">{caption}</caption>
        <thead><tr><th scope="col">Date</th><th scope="col">Valeur</th></tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}><td>{r.label}</td><td className="num">{r.value} {unit}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

export function useChartToggle() {
  const [table, setTable] = useState(false);
  const button = <button type="button" className="link-inline small" aria-pressed={table} onClick={() => setTable(!table)}>{table ? 'Voir le graphique' : 'Voir les données'}</button>;
  return useMemo(() => ({ table, button }), [table]); // eslint-disable-line react-hooks/exhaustive-deps
}
