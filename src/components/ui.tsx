import React, { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Icon, IconName, Flag } from './icons';
import type { Course } from '../types';

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

// ---------------------------------------------------------------- buttons
type Variant = 'blue' | 'white' | 'ghost' | 'line' | 'navy' | 'soft' | 'danger' | 'primary' | 'secondary' | 'light';
const VARIANT: Record<Variant, string> = { blue: 'blue', primary: 'blue', white: 'white', light: 'white', ghost: 'ghost', line: 'line', secondary: 'line', navy: 'navy', soft: 'soft', danger: 'danger' };
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant; size?: 'sm' | 'md' | 'lg'; icon?: IconName; iconRight?: IconName;
  /** trailing round arrow (or another icon), as in the hero buttons */
  go?: boolean | IconName; block?: boolean;
};
export function Button({ variant = 'blue', size = 'md', icon, iconRight, go, block, className, children, ...rest }: BtnProps) {
  return (
    <button type="button" {...rest} className={cx('btn', `btn-${VARIANT[variant]}`, `btn-${size}`, go && 'has-go', block && 'btn-block', className)}>
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children !== undefined && children !== null && <span className="btn-label">{children}</span>}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 15 : 17} />}
      {go && <span className="go" aria-hidden="true"><Icon name={go === true ? 'arrowRight' : go} size={size === 'sm' ? 14 : 16} /></span>}
    </button>
  );
}

export function IconButton({ icon, label, className, badge, dot, size = 20, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; badge?: number; dot?: boolean; size?: number }) {
  return (
    <button type="button" aria-label={label} title={label} {...rest} className={cx('icon-btn', className)}>
      <Icon name={icon} size={size} />
      {!!badge && <span className="icon-btn-badge" aria-hidden="true">{badge > 9 ? '9+' : badge}</span>}
      {dot && <span className="icon-btn-dot" aria-hidden="true" />}
    </button>
  );
}

export function LinkButton({ children, onClick, className, icon = 'arrowRight', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: IconName | null }) {
  return <button type="button" className={cx('link', className)} onClick={onClick} {...rest}>{children}{icon && <Icon name={icon} size={14} />}</button>;
}

export const Kbd = ({ children }: { children: React.ReactNode }) => <kbd className="kbd">{children}</kbd>;

// ---------------------------------------------------------------- progress
export function ProgressBar({ value, label, tone = 'blue', size = 'md', className }: { value: number; label?: string; tone?: 'blue' | 'light' | 'green' | 'mint' | 'flame' | 'gold' | 'soft'; size?: 'xs' | 'sm' | 'md'; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cx('bar', `bar-${tone === 'green' ? 'mint' : tone}`, `bar-${size}`, className)} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} aria-label={label}>
      <span style={{ width: `${v}%` }} />
    </div>
  );
}

/** Bars split in segments (one per module / lesson / level). */
export function Segments({ values, label, className, tone = 'blue' }: { values: number[]; label?: string; className?: string; tone?: 'blue' | 'mint' }) {
  return (
    <div className={cx('segs', `segs-${tone}`, className)} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {values.map((v, i) => <span key={i} className={cx(v >= 1 && 'full')}><i style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%` }} /></span>)}
    </div>
  );
}

export function Ring({ value, size = 64, stroke = 7, label, sub, track = 'var(--ring-track)', color = 'var(--blue)', children, className }: { value: number; size?: number; stroke?: number; label?: string; sub?: string; track?: string; color?: string; children?: React.ReactNode; className?: string }) {
  const r = (size - stroke) / 2; const c = 2 * Math.PI * r; const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cx('ring', className)} style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(v)} %`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {v > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} className="ring-arc" />}
      </svg>
      <div className="ring-center" aria-hidden="true">{children ?? <><strong>{Math.round(v)} %</strong>{sub && <small>{sub}</small>}</>}</div>
    </div>
  );
}

// ---------------------------------------------------------------- small pieces
export function Pill({ tone = 'neutral', icon, children, className }: { tone?: 'neutral' | 'green' | 'mint' | 'blue' | 'amber' | 'gold' | 'red' | 'coral' | 'violet' | 'flame' | 'navy'; icon?: IconName; children: React.ReactNode; className?: string }) {
  const t = tone === 'green' ? 'mint' : tone === 'amber' ? 'gold' : tone === 'red' ? 'coral' : tone;
  return <span className={cx('pill', `pill-${t}`, className)}>{icon && <Icon name={icon} size={13} />}{children}</span>;
}

export function Seg<T extends string | number>({ options, value, onChange, label, className, size = 'md' }: { options: { id: T; label: React.ReactNode }[]; value: T; onChange: (v: T) => void; label: string; className?: string; size?: 'sm' | 'md' }) {
  return (
    <div className={cx('seg', `seg-${size}`, className)} role="group" aria-label={label}>
      {options.map((o) => <button key={String(o.id)} type="button" className={cx(value === o.id && 'on')} aria-pressed={value === o.id} onClick={() => onChange(o.id)}>{o.label}</button>)}
    </div>
  );
}

export function Toggle({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id?: string }) {
  return (
    <button type="button" id={id} role="switch" aria-checked={checked} aria-label={label} className={cx('toggle', checked && 'on')} onClick={() => onChange(!checked)}>
      <i aria-hidden="true" />
    </button>
  );
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

/** A section title with an optional count and a link or control on the right. */
export function SectionHead({ title, count, children, as = 'h2', id }: { title: React.ReactNode; count?: React.ReactNode; children?: React.ReactNode; as?: 'h2' | 'h3'; id?: string }) {
  const H = as;
  return (
    <div className="sec-head">
      <H id={id}>{title}{count !== undefined && <span className="sec-count">{count}</span>}</H>
      {children && <div className="sec-side">{children}</div>}
    </div>
  );
}

/** Text with **bold** parts (used for Léa's lines and messages). */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return <>{parts.map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <React.Fragment key={i}>{p}</React.Fragment>))}</>;
}

// ---------------------------------------------------------------- dialog
/** In-page dialog (the viewer blocks window.confirm). */
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
      const list = focusables(); if (!list.length) return;
      const i = list.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); list[list.length - 1].focus(); }
      else if (!e.shiftKey && (i === list.length - 1 || i === -1)) { e.preventDefault(); list[0].focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); if (prev && document.contains(prev)) prev.focus(); };
  }, [open]);
  if (!open) return null;
  // rendered at the app's root: the page column is a size container, which would otherwise become the
  // dialog's frame instead of the window
  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close.current(); }}>
      <div className={cx('dialog', `dialog-${size}`, className)} role="dialog" aria-modal="true" aria-labelledby="dialog-title" ref={ref}>
        <div className="dialog-head">
          <div><h2 id="dialog-title">{title}</h2>{subtitle && <p className="muted dialog-sub">{subtitle}</p>}</div>
          <button type="button" className="dialog-x" aria-label="Fermer" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div className="dialog-body">{children}</div>
        {actions && <div className="dialog-actions">{actions}</div>}
      </div>
    </div>,
    document.querySelector('.app') ?? document.body,
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
      {list.map((t) => <div key={t.id} className={cx('toast', `toast-${t.tone}`)}><span className="toast-ic"><Icon name={t.tone === 'badge' ? 'medal' : t.tone === 'success' ? 'check' : 'info'} size={16} /></span>{t.text}</div>)}
    </div>
  );
}

// ---------------------------------------------------------------- course covers
/** Colours, greeting and symbol of each course cover. */
export const COVER: Record<string, { c1: string; c2: string; word?: string; glyph?: IconName }> = {
  'en-b1': { c1: '#5B8DEF', c2: '#1F4FCB', word: 'Hello' },
  'es-a2': { c1: '#FFA352', c2: '#E2622B', word: '¡Hola!' },
  'fr-b1': { c1: '#5B93FF', c2: '#2554D6', word: 'Bonjour' },
  'de-a1': { c1: '#F7C948', c2: '#D99410', word: 'Hallo' },
  'it-b1': { c1: '#33B887', c2: '#13785A', word: 'Ciao' },
  'ru-c1': { c1: '#F27B70', c2: '#B83A44', word: 'Привет' },
  'biz-pitch': { c1: '#7AA0FF', c2: '#3456E0', glyph: 'chat' },
  'biz-nego': { c1: '#3CBE8F', c2: '#16805E', glyph: 'briefcase' },
  'info-python': { c1: '#2C4270', c2: '#0B1A33', glyph: 'monitor' },
  'info-sql': { c1: '#5B93FF', c2: '#1F4FCB', glyph: 'progress' },
  'perso-focus': { c1: '#FFB65E', c2: '#EA7A22', glyph: 'clock' },
  'sci-climat': { c1: '#39C6A3', c2: '#14806B', glyph: 'flask' },
  'art-tableau': { c1: '#9488F7', c2: '#5B4BD6', glyph: 'palette' },
  'art-cinema': { c1: '#324472', c2: '#0E1A36', glyph: 'video' },
};
export const coverOf = (c: Course) => COVER[c.id] ?? { c1: '#5B8DEF', c2: '#1F4FCB', glyph: 'book' as IconName };

/**
 * Course cover: the photo for the main path, otherwise a gradient with a dotted texture, the course's
 * symbol (or a greeting in the language taught) and its flag.
 */
export function CourseCover({ course, className, flag = true, word, photo = true, children, flagSize = 34 }: {
  course: Course; className?: string; flag?: boolean; word?: string | false; photo?: boolean; children?: React.ReactNode; flagSize?: number;
}) {
  const [failed, setFailed] = useState(false);
  const v = coverOf(course);
  const isPhoto = photo && course.cover.kind === 'photo' && !failed;
  const greeting = word === false ? null : word ?? (isPhoto ? null : v.word);
  return (
    <div className={cx('cv', isPhoto && 'cv-photo', v.glyph && !isPhoto && 'cv-glyph', className)} style={{ ['--c1' as string]: v.c1, ['--c2' as string]: v.c2 }}>
      {isPhoto && course.cover.kind === 'photo'
        ? <img src={course.cover.src} alt="" loading="lazy" style={{ objectPosition: course.cover.position }} onError={() => setFailed(true)} />
        : <>
          <i className="cv-dots" aria-hidden="true" />
          {v.glyph && <span className="cv-mark" aria-hidden="true"><Icon name={v.glyph} size={120} /></span>}
          {v.glyph && <span className="cv-tile" aria-hidden="true"><Icon name={v.glyph} size={22} /></span>}
        </>}
      {greeting && <span className="cv-word" aria-hidden="true" lang={course.flag === 'gb' ? 'en' : course.flag === 'ru' ? 'ru' : undefined}>{greeting}</span>}
      {flag && course.flag && <span className="cv-flag"><Flag code={course.flag} size={flagSize} /></span>}
      {children}
    </div>
  );
}

/** Level tag shown on covers: three bars filled up to the level. */
export function LevelTag({ course, className }: { course: Course; className?: string }) {
  const n = course.level === 'debutant' ? 1 : course.level === 'intermediaire' ? 2 : 3;
  const label = course.level === 'debutant' ? 'Débutant' : course.level === 'intermediaire' ? 'Intermédiaire' : 'Avancé';
  return (
    <span className={cx('lvl', className)}>
      <span className="lvl-bars" aria-hidden="true">{[1, 2, 3].map((i) => <i key={i} className={cx(i <= n && 'on')} />)}</span>
      {label}{course.cefr ? ` ${course.cefr}` : ''}
    </span>
  );
}

// ---------------------------------------------------------------- medals
export type MedalTone = 'blue' | 'gold' | 'flame' | 'mint' | 'coral' | 'violet' | 'grey';
const MEDAL_TONES: Record<MedalTone, [string, string, string]> = {
  blue: ['#6E97FF', '#2F6BFF', '#1F4FCB'], gold: ['#FFD46B', '#F2A93B', '#D9871A'], flame: ['#FFB067', '#FF7A2F', '#E2551A'],
  mint: ['#46D49D', '#16A472', '#0E7F57'], coral: ['#FF8C82', '#E9564F', '#C63B35'], violet: ['#A99CFF', '#6E63F2', '#5446D6'], grey: ['#E4E9F1', '#C7D0DE', '#AEB9CA'],
};
/** A medal (ribbon + disc + symbol), coloured for earned badges and grey when locked. */
export function Medal({ icon, tone = 'blue', size = 64, locked }: { icon: IconName; tone?: MedalTone; size?: number; locked?: boolean }) {
  const [a, b, c] = MEDAL_TONES[locked ? 'grey' : tone];
  const id = `md${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const ribbon = locked ? '#C9D2E0' : '#2F55D4';
  return (
    <span className={cx('medal', locked && 'is-locked')} style={{ width: size, height: size * 1.18 }} aria-hidden="true">
      <svg viewBox="0 0 100 118" width={size} height={size * 1.18}>
        <defs>
          <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={a} /><stop offset=".55" stopColor={b} /><stop offset="1" stopColor={c} /></linearGradient>
          <linearGradient id={`${id}r`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={ribbon} /><stop offset="1" stopColor={locked ? '#B5C0D2' : '#1C3FB8'} /></linearGradient>
        </defs>
        <path d="M24 2h18l12 30H36Z" fill={`url(#${id}r)`} />
        <path d="M76 2H58L46 32h18Z" fill={`url(#${id}r)`} opacity=".92" />
        <circle cx="50" cy="70" r="40" fill={`url(#${id}g)`} />
        <circle cx="50" cy="70" r="31" fill="none" stroke="#fff" strokeOpacity={locked ? '.6' : '.55'} strokeWidth="3" />
        <ellipse cx="38" cy="50" rx="15" ry="8" fill="#fff" opacity=".22" transform="rotate(-28 38 50)" />
      </svg>
      <span className="medal-ic" style={{ top: `${(70 / 118) * 100}%` }}><Icon name={icon} size={Math.round(size * 0.36)} /></span>
    </span>
  );
}

export function useMediaQuery(q: string) {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q).matches : false);
  const [m, setM] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia(q); const on = () => setM(mq.matches);
    on();
    mq.addEventListener ? mq.addEventListener('change', on) : mq.addListener(on);
    return () => { mq.removeEventListener ? mq.removeEventListener('change', on) : mq.removeListener(on); };
  }, [q]);
  return m;
}

/** Downloads a text file made in the browser (exports, receipts, programmes). */
export function downloadText(name: string, text: string, type = 'text/plain;charset=utf-8') {
  try {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch { return false; }
}
