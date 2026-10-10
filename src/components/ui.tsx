import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Icon, IconName, Flag } from './icons';
import type { Course } from '../types';

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'light' | 'danger'; size?: 'sm' | 'md' | 'lg'; icon?: IconName; iconRight?: IconName; block?: boolean };
export function Button({ variant = 'primary', size = 'md', icon, iconRight, block, className, children, ...rest }: BtnProps) {
  return (
    <button type="button" {...rest} className={cx('btn', `btn-${variant}`, `btn-${size}`, block && 'btn-block', className)}>
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 16 : 18} />}
    </button>
  );
}

export function IconButton({ icon, label, className, badge, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; badge?: number }) {
  return (
    <button type="button" aria-label={label} title={label} {...rest} className={cx('icon-btn', className)}>
      <Icon name={icon} size={20} />
      {!!badge && <span className="icon-btn-badge" aria-hidden="true">{badge > 9 ? '9+' : badge}</span>}
    </button>
  );
}

export function LinkButton({ children, onClick, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={cx('link', className)} onClick={onClick} {...rest}>{children}<Icon name="arrowRight" size={14} /></button>;
}

export function ProgressBar({ value, label, tone = 'blue', size = 'md', className }: { value: number; label?: string; tone?: 'blue' | 'light' | 'green'; size?: 'sm' | 'md'; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cx('bar', `bar-${tone}`, `bar-${size}`, className)} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} aria-label={label}>
      <span style={{ width: `${v}%` }} />
    </div>
  );
}

export function Ring({ value, size = 64, stroke = 7, label, sub, track = 'var(--ring-track)', color = 'var(--blue)', children }: { value: number; size?: number; stroke?: number; label?: string; sub?: string; track?: string; color?: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2; const c = 2 * Math.PI * r; const v = Math.max(0, Math.min(100, value));
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(v)} %`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} className="ring-arc" />
      </svg>
      <div className="ring-center">{children ?? <><strong>{Math.round(v)}%</strong>{sub && <small>{sub}</small>}</>}</div>
    </div>
  );
}

export function Pill({ tone = 'neutral', icon, children }: { tone?: 'neutral' | 'green' | 'blue' | 'amber' | 'red' | 'violet'; icon?: IconName; children: React.ReactNode }) {
  return <span className={cx('pill', `pill-${tone}`)}>{icon && <Icon name={icon} size={14} />}{children}</span>;
}

export function Skeleton({ h = 16, w = '100%', r = 8 }: { h?: number; w?: number | string; r?: number }) {
  return <span className="skeleton" style={{ height: h, width: w, borderRadius: r }} aria-hidden="true" />;
}

export function Empty({ icon = 'search', title, children, action }: { icon?: IconName; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="empty" role="status">
      <span className="empty-icon"><Icon name={icon} size={26} /></span>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

/** In-page confirmation dialog (the viewer blocks window.confirm). */
export function Dialog({ open, title, children, onClose, actions, size = 'md', className, subtitle }: {
  open: boolean; title: string; children: React.ReactNode; onClose: () => void; actions?: React.ReactNode; size?: 'md' | 'lg'; className?: string; subtitle?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), select, textarea, [tabindex]:not([tabindex="-1"])') ?? []).filter((n) => n.offsetParent !== null);
    (ref.current?.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0])?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); close.current(); return; }
      if (e.key !== 'Tab') return;
      // keep the keyboard focus inside the dialog
      const list = focusables(); if (!list.length) return;
      const i = list.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); list[list.length - 1].focus(); }
      else if (!e.shiftKey && (i === list.length - 1 || i === -1)) { e.preventDefault(); list[0].focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); if (prev && document.contains(prev)) prev.focus(); };
  }, [open]);
  if (!open) return null;
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close.current(); }}>
      <div className={cx('dialog', `dialog-${size}`, className)} role="dialog" aria-modal="true" aria-labelledby="dialog-title" ref={ref}>
        <div className="dialog-head">
          <div><h2 id="dialog-title">{title}</h2>{subtitle && <p className="muted dialog-sub">{subtitle}</p>}</div>
          {size === 'lg' && <button type="button" className="dialog-x" aria-label="Fermer" onClick={onClose}><Icon name="x" size={18} /></button>}
        </div>
        <div className="dialog-body">{children}</div>
        {actions && <div className="dialog-actions">{actions}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- toasts
type Toast = { id: number; text: string; tone: 'info' | 'success' | 'badge' };
let toasts: Toast[] = []; const tl = new Set<() => void>(); let tid = 0;
export function toast(text: string, tone: Toast['tone'] = 'info') {
  const t = { id: ++tid, text, tone }; toasts = [...toasts, t]; tl.forEach((l) => l());
  window.setTimeout(() => { toasts = toasts.filter((x) => x.id !== t.id); tl.forEach((l) => l()); }, 4200);
}
export function Toasts() {
  const list = useSyncExternalStore((l) => { tl.add(l); return () => tl.delete(l); }, () => toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => <div key={t.id} className={cx('toast', `toast-${t.tone}`)}><Icon name={t.tone === 'badge' ? 'medal' : t.tone === 'success' ? 'check' : 'info'} size={18} />{t.text}</div>)}
    </div>
  );
}

// ---------------------------------------------------------------- course cover
const MOTIF_ICON: Record<string, IconName> = { pitch: 'chat', negotiation: 'briefcase', code: 'monitor', data: 'progress', focus: 'clock', climate: 'flask', painting: 'palette', cinema: 'video', 'skyline-ru': 'globe' };

export function CourseCover({ course, className, showFlag = true }: { course: Course; className?: string; showFlag?: boolean }) {
  const [failed, setFailed] = useState(false);
  const cover = course.cover;
  return (
    <div className={cx('cover', className)}>
      {cover.kind === 'photo' && !failed
        ? <img src={cover.src} alt="" loading="lazy" style={{ objectPosition: cover.position }} onError={() => setFailed(true)} />
        : <ArtCover motif={cover.kind === 'art' ? cover.motif : 'skyline-ru'} tone={cover.kind === 'art' ? cover.tone : '#3978E5'} />}
      {showFlag && course.flag && <span className="cover-flag"><Flag code={course.flag} size={30} /></span>}
    </div>
  );
}

const SKIES: Record<string, [string, string]> = {
  'skyline-fr': ['#F5D3C2', '#EEF2FA'], 'skyline-es': ['#F9D49E', '#F8F1E7'], 'skyline-de': ['#CFDDF3', '#F1F5FB'],
  'skyline-it': ['#F7C9A8', '#F9F0E6'], 'skyline-ru': ['#F2CFC7', '#EDF1F8'],
};

/** Flat landmark illustrations drawn from simple shapes (used for language course covers). */
function Landmark({ city, tone }: { city: string; tone: string }) {
  const [top, bottom] = SKIES[city] ?? ['#DCE6F4', '#F3F6FB'];
  const id = `sky-${city}`;
  const spire = (cx: number, t: number, w: number) => `M${cx - w / 2} 82L${cx - w / 2} ${t + 18}Q${cx - w / 2} ${t + 4} ${cx} ${t}Q${cx + w / 2} ${t + 4} ${cx + w / 2} ${t + 18}L${cx + w / 2} 82Z`;
  const far = [[4, 64, 14, 18], [20, 70, 10, 12], [118, 66, 12, 16], [132, 60, 10, 22], [144, 70, 14, 12]];
  let body: React.ReactNode = null;
  if (city === 'skyline-fr') body = <g>
    <path d="M80 8L81.3 20L83 38L86 52L90.5 66L97 82H90Q80 67 70 82H63L69.5 66L74 52L77 38L78.7 20Z" />
    <rect x="72.5" y="50.5" width="15" height="2.6" rx=".6" /><rect x="75.4" y="36.6" width="9.2" height="2" rx=".5" /><rect x="67.5" y="64.2" width="25" height="2.8" rx=".6" /><rect x="79.6" y="2.5" width=".8" height="6" />
  </g>;
  if (city === 'skyline-es') body = <g>
    <path d={spire(80, 4, 7)} opacity=".55" />
    <rect x="46" y="56" width="68" height="26" />
    {[[64, 22, 8], [74, 13, 8.5], [86, 13, 8.5], [96, 22, 8], [50, 40, 6], [110, 40, 6]].map(([cx, t, w], i) => <g key={i}><path d={spire(cx, t, w)} /><circle cx={cx} cy={t - 1.6} r="1.7" /></g>)}
    {[52, 60, 100, 108].map((x) => <rect key={x} x={x} y="62" width="3" height="8" rx="1.5" fill={tone} opacity=".75" />)}
    <path d="M74 82V68Q80 60 86 68V82Z" fill={tone} opacity=".6" />
  </g>;
  if (city === 'skyline-de') body = <g>
    <rect x="28" y="62" width="16" height="20" /><rect x="116" y="62" width="16" height="20" />
    <rect x="42" y="77" width="76" height="5" />
    {[46, 57, 68, 88, 99, 110].map((x) => <rect key={x} x={x - 2} y="54" width="4.4" height="24" />)}
    <rect x="40" y="47" width="80" height="8" rx="1" /><rect x="52" y="39" width="56" height="9" rx="1" />
    <path d="M70 39q3-8 9-6q1-6 2 0q6-2 9 6z" /><rect x="79.2" y="24" width="1.6" height="10" /><circle cx="80" cy="23" r="2" />
  </g>;
  if (city === 'skyline-it') {
    const arches: React.ReactNode[] = [];
    [[72, 30, 128], [61, 30, 120], [51, 34, 100]].forEach(([y, x0, x1], row) => { for (let x = x0; x <= x1; x += 8) arches.push(<rect key={`${row}-${x}`} x={x} y={y} width="5" height="7.5" rx="2.5" fill={top} opacity=".6" />); });
    body = <g><path d="M26 82V48Q66 35 104 39V45Q122 45 134 52V82Z" />{arches}<rect x="22" y="80" width="116" height="2" /></g>;
  }
  if (city === 'skyline-ru') body = <g>
    <rect x="46" y="52" width="12" height="30" /><path d="M52 36c6 6 8 9 6 14-2 3-10 3-12 0-2-5 0-8 6-14Z" /><rect x="51.2" y="30" width="1.6" height="7" />
    <rect x="64" y="44" width="16" height="38" /><path d="M72 22c8 8 10 12 8 18-3 4-13 4-16 0-2-6 0-10 8-18Z" /><rect x="71" y="14" width="2" height="9" />
    <rect x="86" y="56" width="11" height="26" /><path d="M91.5 42c5 5 7 8 5 12-2 3-8 3-10 0-2-4 0-7 5-12Z" /><rect x="90.8" y="37" width="1.4" height="6" />
    <rect x="104" y="62" width="30" height="20" /><rect x="114" y="40" width="10" height="24" /><path d="M119 28l5 12h-10Z" />
    <path d="M72 24c6 7 8 10 6 15-2 2-10 2-12 0-2-5 0-8 6-15Z" fill={tone} opacity=".85" /><path d="M52 38c4 5 6 7 4 11-2 2-6 2-8 0-2-4 0-6 4-11Z" fill={tone} opacity=".85" />
  </g>;
  return (
    <svg className="art" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={top} /><stop offset="1" stopColor={bottom} /></linearGradient></defs>
      <rect width="160" height="100" fill={`url(#${id})`} />
      <circle cx="128" cy="26" r="9" fill="#fff" opacity=".55" />
      <g fill="#14243B" opacity=".16">{far.map(([x, y, w, h], i) => <rect key={i} x={x} y={y} width={w} height={h} />)}</g>
      <g fill="#14243B">{body}<rect x="0" y="82" width="160" height="18" /></g>
      <rect x="0" y="82" width="160" height="1.2" fill={tone} opacity=".5" />
    </svg>
  );
}

function ArtCover({ motif, tone }: { motif: string; tone: string }) {
  if (motif.startsWith('skyline-')) return <Landmark city={motif} tone={tone} />;
  return (
    <div className="art art-tile" style={{ ['--tone' as string]: tone }}>
      <span className="art-grid" aria-hidden="true" />
      <span className="art-icon"><Icon name={MOTIF_ICON[motif] ?? 'book'} size={34} /></span>
    </div>
  );
}

export function useMediaQuery(q: string) {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q).matches : false);
  const [m, setM] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia(q); const on = () => setM(mq.matches);
    mq.addEventListener ? mq.addEventListener('change', on) : mq.addListener(on);
    return () => { mq.removeEventListener ? mq.removeEventListener('change', on) : mq.removeListener(on); };
  }, [q]);
  return m;
}
