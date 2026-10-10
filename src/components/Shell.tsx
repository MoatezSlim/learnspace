import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, IconName } from './icons';
import { IconButton, cx } from './ui';
import { navigate, useRoute, beforeNavigate } from '../router';
import { store, useLearner } from '../state/store';
import type { PageId } from '../types';
import { COURSES, courseLessons, isPlayable, LEVEL_LABEL } from '../data/courses';
import { normalizeAnswer } from '../state/selectors';
import { relative } from '../lib/dates';
import { subscriptionInfo } from '../state/selectors';
import { PLAN_NAME } from '../data/plans';
import { overlays } from '../state/ui';
import { PhotoView, DEFAULT_PHOTO } from './avatars';

export const NAV: { page: PageId; label: string; icon: IconName }[] = [
  { page: 'home', label: 'Accueil', icon: 'home' },
  { page: 'courses', label: 'Mes cours', icon: 'courses' },
  { page: 'library', label: 'Bibliothèque', icon: 'library' },
  { page: 'progress', label: 'Progression', icon: 'progress' },
  { page: 'badges', label: 'Badges', icon: 'badge' },
  { page: 'messages', label: 'Messages', icon: 'message' },
  { page: 'settings', label: 'Paramètres', icon: 'settings' },
];

export function Logo({ light = true }: { light?: boolean }) {
  return (
    <span className={cx('logo', light && 'logo-light')}>
      <svg className="logo-mark" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M16 5 2.5 11.6 16 18.2l11-5.4v6.7h2.6v-7.9Z" fill="currentColor" />
        <path d="M8.2 15.6v5.1c0 2 3.5 4.1 7.8 4.1s7.8-2.1 7.8-4.1v-5.1L16 19.4Z" fill="currentColor" opacity=".78" />
      </svg>
      <span className="logo-text">LearnSpace</span>
    </span>
  );
}

export function UserChip({ compact }: { compact?: boolean }) {
  const s = useLearner();
  return (
    <span className={cx('user-chip', compact && 'compact')}>
      <PhotoView className="user-photo" photo={s.profile.photo ?? DEFAULT_PHOTO} first={s.profile.firstName} last={s.profile.lastName} />
      {!compact && <span className="user-meta sb-label"><strong>{s.profile.firstName} {s.profile.lastName}</strong><small>{LEVEL_LABEL[COURSES.find((c) => c.id === s.currentCourseId)?.level ?? 'intermediaire']}</small></span>}
    </span>
  );
}

/** The subscription in the sidebar: status, period elapsed and the payment button when it is due. */
function PlanCard({ onClose }: { onClose?: () => void }) {
  const s = useLearner();
  const info = subscriptionInfo(s);
  const due = info.state !== 'active';
  return (
    <div className={cx('sb-plan-wrap', `is-${info.state}`)} data-tip={`Abonnement · ${info.label}`}>
      <div className="sb-plan">
        <button type="button" className="sb-plan-head" onClick={() => navigate({ page: 'subscription' })} aria-label={`Abonnement ${PLAN_NAME}, ${info.plan.label.toLowerCase()} : ${info.label.toLowerCase()}`}>
          <span className="sb-plan-icon"><Icon name="crown" size={20} />{due && <i className="sb-dot" aria-hidden="true" />}</span>
          <span className="sb-label sb-plan-text"><strong>Premium · {info.plan.label}</strong><small>{info.label}</small></span>
        </button>
        <div className="sb-plan-more">
          <span className="sb-plan-bar" aria-hidden="true"><i style={{ width: `${Math.round(info.elapsed * 100)}%` }} /></span>
          {due
            ? <button type="button" className="sb-plan-pay" onClick={() => { onClose?.(); overlays.openPayment(); }}><Icon name="card" size={16} /><span>{info.state === 'expired' ? 'Réactiver mon abonnement' : 'Payer l’abonnement'}</span></button>
            : <button type="button" className="sb-plan-manage" onClick={() => navigate({ page: 'subscription' })}><span>Gérer l’abonnement</span><Icon name="chevronRight" size={14} /></button>}
        </div>
      </div>
    </div>
  );
}

/** Width of the desktop sidebar, full and as an icon rail, in pixels (same units as the CSS). */
function sidebarWidths() {
  const u = Math.max(1.16, Math.min(2.05, window.innerWidth / 861));
  return { full: 150 * u, rail: 52 * u };
}

/**
 * Sliding the sidebar: click the round handle (or press it with the keyboard) to fold it to its icons
 * or unfold it, or drag the handle or the sidebar's edge and let go: it settles on the nearest state,
 * or follows a quick flick. While dragging, the width follows the pointer.
 */
function useSlide(rail: boolean) {
  const drag = useRef<{ x: number; w0: number; full: number; rail: number; moved: boolean; lastX: number; lastT: number; v: number } | null>(null);
  const swallowClick = useRef(false);
  const app = () => document.querySelector<HTMLElement>('.app');
  const toggle = () => store.setPrefs({ sidebar: rail ? 'full' : 'rail' });
  const apply = (w: number, d: { full: number; rail: number }) => {
    const a = app(); if (!a) return;
    a.style.setProperty('--sb-w', `${w.toFixed(1)}px`);
    a.style.setProperty('--sb-p', ((w - d.rail) / (d.full - d.rail)).toFixed(3));
  };
  const release = () => { const a = app(); if (!a) return; a.classList.remove('sb-dragging'); a.style.removeProperty('--sb-w'); a.style.removeProperty('--sb-p'); };

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    const { full, rail: r } = sidebarWidths();
    drag.current = { x: e.clientX, w0: rail ? r : full, full, rail: r, moved: false, lastX: e.clientX, lastT: e.timeStamp, v: 0 };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
  };
  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current; if (!d) return;
    const dx = e.clientX - d.x;
    if (!d.moved) {
      if (Math.abs(dx) < 4) return;
      d.moved = true; app()?.classList.add('sb-dragging');
    }
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.v = d.v * 0.4 + ((e.clientX - d.lastX) / dt) * 0.6;
    d.lastX = e.clientX; d.lastT = e.timeStamp;
    apply(Math.max(d.rail, Math.min(d.full, d.w0 + dx)), d);
  };
  const finish = (e: React.PointerEvent<HTMLElement>, clickToggles: boolean) => {
    const d = drag.current; drag.current = null;
    if (!d) return;
    if (!d.moved) { if (clickToggles) toggle(); return; }
    swallowClick.current = true; window.setTimeout(() => { swallowClick.current = false; }, 0);
    const w = Math.max(d.rail, Math.min(d.full, d.w0 + (e.clientX - d.x)));
    const p = (w - d.rail) / (d.full - d.rail);
    const toRail = Math.abs(d.v) > 0.45 ? d.v < 0 : p < 0.5;
    release();
    store.setPrefs({ sidebar: toRail ? 'rail' : 'full' });
  };
  const cancel = () => { if (drag.current?.moved) release(); drag.current = null; };
  return {
    handle: {
      onPointerDown, onPointerMove, onPointerCancel: cancel,
      onPointerUp: (e: React.PointerEvent<HTMLElement>) => finish(e, false),
      onClick: () => { if (swallowClick.current) { swallowClick.current = false; return; } toggle(); },
    },
    edge: { onPointerDown, onPointerMove, onPointerCancel: cancel, onPointerUp: (e: React.PointerEvent<HTMLElement>) => finish(e, true) },
  };
}

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const route = useRoute();
  const s = useLearner();
  const rail = !onClose && s.prefs.sidebar === 'rail';
  const slide = useSlide(rail);
  const active = route.page === 'lesson' ? 'courses' : route.page === 'course' ? 'courses' : route.page;
  const name = `${s.profile.firstName} ${s.profile.lastName}`;
  return (
    <nav className={cx('sidebar', rail && 'is-rail', onClose && 'in-drawer')} id="sidebar" aria-label="Navigation principale">
      <button type="button" className="sidebar-logo" onClick={() => navigate({ page: 'home' })} aria-label="LearnSpace, accueil"><Logo /></button>
      {onClose && <button type="button" className="sidebar-close" onClick={onClose} aria-label="Fermer le menu"><Icon name="x" size={18} /></button>}
      <button type="button" className="sb-new" data-tip="Nouveau cours" onClick={() => { onClose?.(); overlays.openNewCourse(); }}>
        <span className="sb-new-icon"><Icon name="plus" size={18} /></span><span className="sb-label">Nouveau cours</span>
      </button>
      <ul>
        {NAV.map((n) => (
          <li key={n.page}>
            <button type="button" className={cx('nav-item', active === n.page && 'active')} data-tip={n.label} aria-current={active === n.page ? 'page' : undefined} onClick={() => navigate({ page: n.page })}>
              <Icon name={n.icon} size={20} /><span className="sb-label">{n.label}</span>
            </button>
          </li>
        ))}
      </ul>
      <PlanCard onClose={onClose} />
      <button type="button" className="sidebar-user" data-tip={name} onClick={() => navigate({ page: 'settings' })} aria-label={`${name} : profil et paramètres`}>
        <UserChip /><Icon name="chevronDown" size={16} />
      </button>
      {!onClose && (
        <>
          <span className="sb-edge" aria-hidden="true" {...slide.edge} />
          <button type="button" className="sb-toggle" aria-controls="sidebar" aria-expanded={!rail}
            aria-label={rail ? 'Déplier le menu' : 'Réduire le menu aux icônes'} title={rail ? 'Déplier le menu (ou faites-le glisser)' : 'Réduire le menu (ou faites-le glisser)'} {...slide.handle}>
            <Icon name="chevronsLeft" size={16} />
          </button>
        </>
      )}
    </nav>
  );
}

// ---------------------------------------------------------------- search
function useSearchResults(q: string) {
  return useMemo(() => {
    const n = normalizeAnswer(q); if (n.length < 2) return [];
    const out: { id: string; title: string; sub: string; go: () => void }[] = [];
    for (const c of COURSES) {
      if (normalizeAnswer(`${c.title} ${c.description}`).includes(n)) out.push({ id: c.id, title: c.title, sub: 'Cours', go: () => navigate({ page: 'course', courseId: c.id }) });
      for (const l of courseLessons(c)) if (isPlayable(l) && normalizeAnswer(l.title).includes(n)) out.push({ id: l.id, title: l.title, sub: `Leçon · ${c.shortTitle}`, go: () => navigate({ page: 'lesson', lessonId: l.id }) });
    }
    return out.slice(0, 7);
  }, [q]);
}

export function SearchBox({ placeholder = 'Rechercher un cours, une leçon…' }: { placeholder?: string }) {
  const [q, setQ] = useState(''); const [open, setOpen] = useState(false); const [idx, setIdx] = useState(0);
  const results = useSearchResults(q);
  const pick = (i: number) => { const r = results[i]; if (!r) return; r.go(); setQ(''); setOpen(false); };
  return (
    <div className="search" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }}>
      <Icon name="search" size={18} />
      <input type="search" role="combobox" aria-expanded={open && q.length > 1} aria-controls="search-results" aria-autocomplete="list" aria-label="Rechercher un cours ou une leçon"
        aria-activedescendant={open && results[idx] ? `sr-${results[idx].id}` : undefined}
        value={q} placeholder={placeholder} onChange={(e) => { setQ(e.target.value); setOpen(true); setIdx(0); }} onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(results.length - 1, i + 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
          if (e.key === 'Enter') { e.preventDefault(); if (results.length) pick(idx); else { navigate({ page: 'library' }); } }
          if (e.key === 'Escape') setOpen(false);
        }} />
      {open && q.length > 1 && (
        <ul className="search-results" id="search-results" role="listbox">
          {results.length === 0 && <li className="search-empty" role="option" aria-selected="false">Aucun résultat pour « {q} ».</li>}
          {results.map((r, i) => (
            <li key={r.id} id={`sr-${r.id}`} role="option" aria-selected={i === idx}>
              <button type="button" tabIndex={-1} className={cx(i === idx && 'active')} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(i)}>
                <strong>{r.title}</strong><small>{r.sub}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- notifications + profile
export function Notifications({ light }: { light?: boolean }) {
  const s = useLearner(); const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement>(null);
  const unread = s.notifications.filter((n) => !n.read).length;
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', close); window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div className="popover-wrap" ref={ref}>
      <IconButton icon="bell" label={`Notifications${unread ? ` (${unread} non lues)` : ''}`} badge={light ? unread : undefined} className={cx(light && 'on-dark', !light && unread > 0 && 'has-unread')} aria-expanded={open}
        onClick={() => { setOpen(!open); if (!open && unread) window.setTimeout(() => store.markNotificationsRead(), 1200); }} />
      {open && (
        <div className="popover notif-pop" role="dialog" aria-label="Notifications">
          <h3>Notifications</h3>
          {s.notifications.length === 0 ? <p className="muted">Rien de nouveau pour l’instant.</p> : (
            <ul>{s.notifications.slice(0, 8).map((n) => (
              <li key={n.id} className={cx(!n.read && 'unread')}>
                <span className={cx('notif-icon', `k-${n.kind}`)}><Icon name={n.kind === 'badge' ? 'medal' : n.kind === 'streak' ? 'flame' : n.kind === 'lesson' ? 'check' : n.kind === 'payment' ? 'card' : 'info'} size={16} /></span>
                <span><strong>{n.title}</strong><small>{n.body}</small><time dateTime={n.at}>{relative(n.at)}</time></span>
              </li>))}
            </ul>)}
        </div>
      )}
    </div>
  );
}

export function ProfileMenu() {
  const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('mousedown', close); return () => window.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div className="popover-wrap" ref={ref}>
      <button type="button" className="profile-btn" aria-expanded={open} aria-haspopup="menu" aria-label="Menu du profil" onClick={() => setOpen(!open)}>
        <UserChip compact /><Icon name="chevronDown" size={16} />
      </button>
      {open && (
        <div className="popover menu" role="menu">
          <button type="button" role="menuitem" onClick={() => { setOpen(false); navigate({ page: 'settings' }); }}><Icon name="user" size={16} />Profil et paramètres</button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); overlays.openPhoto(); }}><Icon name="camera" size={16} />Changer ma photo</button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); navigate({ page: 'progress' }); }}><Icon name="progress" size={16} />Ma progression</button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); navigate({ page: 'badges' }); }}><Icon name="badge" size={16} />Mes badges</button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); navigate({ page: 'subscription' }); }}><Icon name="crown" size={16} />Abonnement</button>
        </div>
      )}
    </div>
  );
}

export function Topbar() {
  return (
    <header className="topbar">
      <SearchBox />
      <div className="topbar-actions"><Notifications /><ProfileMenu /></div>
    </header>
  );
}

/** Phone header: the same pieces as the web top bar, with the navy sidebar in a drawer. */
export function MobileHeader({ lesson }: { lesson?: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => beforeNavigate(() => setOpen(false)), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open]);
  return (
    <>
      <header className={cx('m-head', lesson && 'is-lesson')}>
        <div className="m-head-row">
          <button type="button" className="m-menu" aria-label="Ouvrir le menu" aria-expanded={open} onClick={() => setOpen(true)}><Icon name="menu" size={22} /></button>
          <button type="button" className="m-logo" onClick={() => navigate({ page: 'home' })} aria-label="LearnSpace, accueil"><Logo light={false} /></button>
          <div className="m-head-actions"><Notifications /><ProfileMenu /></div>
        </div>
        {!lesson && <SearchBox />}
      </header>
      {open && (
        <div className="m-drawer" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <Sidebar onClose={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}
