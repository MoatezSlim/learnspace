import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, IconName } from './icons';
import { cx, Kbd } from './ui';
import { navigate, useRoute } from '../router';
import { store, useLearner, unreadCount } from '../state/store';
import type { PageId } from '../types';
import { COURSES, courseLessons, getCourse, isPlayable } from '../data/courses';
import { normalizeAnswer, streak, todayMinutes, subscriptionInfo } from '../state/selectors';
import { relative } from '../lib/dates';
import { overlays } from '../state/ui';
import { PhotoView, DEFAULT_PHOTO } from './avatars';
import { courseBadge } from '../data/labels';

export const NAV_LEARN: { page: PageId; label: string; icon: IconName }[] = [
  { page: 'home', label: 'Accueil', icon: 'home' },
  { page: 'courses', label: 'Mes cours', icon: 'courses' },
  { page: 'library', label: 'Bibliothèque', icon: 'library' },
  { page: 'progress', label: 'Progression', icon: 'progress' },
];
export const NAV_SPACE: { page: PageId; label: string; icon: IconName }[] = [
  { page: 'messages', label: 'Léa', icon: 'message' },
  { page: 'badges', label: 'Badges', icon: 'badge' },
  { page: 'subscription', label: 'Abonnement', icon: 'crown' },
  { page: 'settings', label: 'Paramètres', icon: 'settings' },
];

export function LogoMark({ size = 30 }: { size?: number }) {
  return <span className="logo-mark" style={{ width: size, height: size }} aria-hidden="true"><Icon name="mortarboard" size={Math.round(size * 0.66)} /></span>;
}

export const activeNav = (page: PageId): PageId => (page === 'lesson' || page === 'course' ? 'courses' : page);

/** The subscription in the sidebar: status, period elapsed and the payment button when it is due. */
function PlanCard({ onClose }: { onClose?: () => void }) {
  const s = useLearner();
  const info = subscriptionInfo(s);
  const due = info.state !== 'active';
  return (
    <div className={cx('plan', `is-${info.state}`)} data-tip={`Premium ${info.plan.label.toLowerCase()} · ${info.label}`}>
      <button type="button" className="plan-head" onClick={() => { onClose?.(); navigate({ page: 'subscription' }); }} aria-label={`Abonnement Premium ${info.plan.label.toLowerCase()} : ${info.label.toLowerCase()}`}>
        <span className="plan-crown"><Icon name="crown" size={19} />{due && <i className="plan-dot" aria-hidden="true" />}</span>
        <span className="plan-text sb-label"><strong>Premium {info.plan.label.toLowerCase()}</strong><small>{info.label}</small></span>
      </button>
      <div className="plan-more sb-label">
        <span className="plan-bar" aria-hidden="true"><i style={{ width: `${Math.round(info.elapsed * 100)}%` }} /></span>
        {due
          ? <button type="button" className="plan-pay" onClick={() => { onClose?.(); overlays.openPayment(); }}><Icon name="card" size={16} /><span>{info.state === 'expired' ? 'Réactiver l’abonnement' : 'Payer l’abonnement'}</span></button>
          : <button type="button" className="plan-manage" onClick={() => { onClose?.(); navigate({ page: 'subscription' }); }}><span>Gérer l’abonnement</span><Icon name="chevronRight" size={14} /></button>}
      </div>
    </div>
  );
}

/** Full width of the sidebar and its icon rail, in pixels (same values as the CSS). */
const SIDE_FULL = 268, SIDE_RAIL = 88;

/**
 * Sliding the sidebar: click the fold button (or press it with the keyboard) to fold it to its icons or
 * unfold it, or drag the button or the sidebar's edge and let go: it settles on the nearest state, or
 * follows a quick flick. While dragging, the width follows the pointer.
 */
function useSlide(rail: boolean) {
  const drag = useRef<{ x: number; w0: number; moved: boolean; lastX: number; lastT: number; v: number } | null>(null);
  const swallowClick = useRef(false);
  const app = () => document.querySelector<HTMLElement>('.app');
  const toggle = () => store.setPrefs({ sidebar: rail ? 'full' : 'rail' });
  const apply = (w: number) => {
    const a = app(); if (!a) return;
    a.style.setProperty('--sb', `${w.toFixed(1)}px`);
    a.style.setProperty('--sb-p', ((w - SIDE_RAIL) / (SIDE_FULL - SIDE_RAIL)).toFixed(3));
  };
  const release = () => { const a = app(); if (!a) return; a.classList.remove('sb-dragging'); a.style.removeProperty('--sb'); a.style.removeProperty('--sb-p'); };
  const clampW = (w: number) => Math.max(SIDE_RAIL, Math.min(SIDE_FULL, w));

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    drag.current = { x: e.clientX, w0: rail ? SIDE_RAIL : SIDE_FULL, moved: false, lastX: e.clientX, lastT: e.timeStamp, v: 0 };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
  };
  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current; if (!d) return;
    const dx = e.clientX - d.x;
    if (!d.moved) { if (Math.abs(dx) < 4) return; d.moved = true; app()?.classList.add('sb-dragging'); }
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.v = d.v * 0.4 + ((e.clientX - d.lastX) / dt) * 0.6;
    d.lastX = e.clientX; d.lastT = e.timeStamp;
    apply(clampW(d.w0 + dx));
  };
  const finish = (e: React.PointerEvent<HTMLElement>, clickToggles: boolean) => {
    const d = drag.current; drag.current = null;
    if (!d) return;
    if (!d.moved) { if (clickToggles) toggle(); return; }
    swallowClick.current = true; window.setTimeout(() => { swallowClick.current = false; }, 0);
    const p = (clampW(d.w0 + (e.clientX - d.x)) - SIDE_RAIL) / (SIDE_FULL - SIDE_RAIL);
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

function NavList({ items, active, onPick, unread }: { items: typeof NAV_LEARN; active: PageId; onPick: (p: PageId) => void; unread: number }) {
  return (
    <ul className="nav">
      {items.map((n) => (
        <li key={n.page}>
          <button type="button" className={cx('nav-item', active === n.page && 'active')} data-tip={n.label} aria-current={active === n.page ? 'page' : undefined} onClick={() => onPick(n.page)}>
            <Icon name={n.icon} size={20} /><span className="sb-label">{n.label}</span>
            {n.page === 'messages' && unread > 0 && <span className="nav-count" aria-label={`${unread} message${unread > 1 ? 's' : ''} non lu${unread > 1 ? 's' : ''}`}>{unread}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** The floating navy sidebar (desktop), also used in the phone menu sheet (`onClose`). */
export function Sidebar({ onClose }: { onClose?: () => void }) {
  const route = useRoute();
  const s = useLearner();
  const rail = !onClose && s.prefs.sidebar === 'rail';
  const slide = useSlide(rail);
  const active = activeNav(route.page);
  const name = `${s.profile.firstName} ${s.profile.lastName}`.trim();
  const course = getCourse(s.currentCourseId);
  const pick = (page: PageId) => { onClose?.(); navigate({ page }); };
  return (
    <nav className={cx('side', rail && 'is-rail', onClose && 'in-sheet')} id={onClose ? undefined : 'sidebar'} aria-label="Navigation principale">
      <div className="side-glow" aria-hidden="true" />
      <div className="side-brand">
        <button type="button" className="brand" onClick={() => pick('home')} aria-label="LearnSpace, accueil"><LogoMark /><span className="brand-name sb-label">LearnSpace</span></button>
        {onClose
          ? <button type="button" className="side-fold" onClick={onClose} aria-label="Fermer le menu"><Icon name="x" size={18} /></button>
          : <button type="button" className="side-fold" aria-controls="sidebar" aria-expanded={!rail} aria-label={rail ? 'Déplier le menu' : 'Réduire le menu aux icônes'}
              title={rail ? 'Déplier le menu (ou fais-le glisser)' : 'Réduire le menu (ou fais-le glisser)'} {...slide.handle}><Icon name="chevronsLeft" size={16} /></button>}
      </div>
      <button type="button" className="new-btn" data-tip="Nouveau cours (N)" onClick={() => { onClose?.(); overlays.openNewCourse(); }}>
        <span className="new-plus"><Icon name="plus" size={18} /></span><span className="sb-label">Nouveau cours</span>{!onClose && <Kbd>N</Kbd>}
      </button>
      <div className="side-scroll">
        <p className="side-group sb-label">Apprendre</p>
        <NavList items={NAV_LEARN} active={active} onPick={pick} unread={0} />
        <p className="side-group sb-label">Mon espace</p>
        <NavList items={NAV_SPACE} active={active} onPick={pick} unread={unreadCount(s)} />
      </div>
      <PlanCard onClose={onClose} />
      <button type="button" className="me" data-tip={name} onClick={() => pick('settings')} aria-label={`${name} : profil et paramètres`}>
        <PhotoView className="me-photo" photo={s.profile.photo ?? DEFAULT_PHOTO} first={s.profile.firstName} last={s.profile.lastName} />
        <span className="me-meta sb-label"><strong>{name}</strong><small>{course ? courseBadge(course) : ''}</small></span>
        <span className="me-gear sb-label" aria-hidden="true"><Icon name="settings" size={18} /></span>
      </button>
      {!onClose && <span className="side-edge" aria-hidden="true" {...slide.edge} />}
    </nav>
  );
}

// ---------------------------------------------------------------- search
interface SearchHit { id: string; title: string; sub: string; group: 'Cours' | 'Leçons' | 'Notions'; icon: IconName; go: () => void }
function useSearchResults(q: string): SearchHit[] {
  return useMemo(() => {
    const n = normalizeAnswer(q); if (n.length < 2) return [];
    const courses: SearchHit[] = [], lessons: SearchHit[] = [], notions: SearchHit[] = [];
    for (const c of COURSES) {
      if (normalizeAnswer(`${c.title} ${c.description}`).includes(n)) courses.push({ id: c.id, title: c.title, sub: `${c.hours} h · ${courseLessons(c).length} leçons`, group: 'Cours', icon: 'courses', go: () => navigate({ page: 'course', courseId: c.id }) });
      for (const l of courseLessons(c)) {
        if (normalizeAnswer(l.title).includes(n)) lessons.push({ id: l.id, title: l.title, sub: `${c.shortTitle} · module ${c.modules.findIndex((m) => m.id === l.moduleId) + 1}${isPlayable(l) ? '' : ' · bientôt'}`, group: 'Leçons', icon: isPlayable(l) ? 'play' : 'lock', go: () => (isPlayable(l) ? navigate({ page: 'lesson', lessonId: l.id }) : navigate({ page: 'course', courseId: c.id })) });
        for (const v of l.content?.vocab ?? []) if (normalizeAnswer(`${v.term} ${v.fr}`).includes(n)) notions.push({ id: `${l.id}:${v.term}`, title: `${v.term} · ${v.fr}`, sub: `Dans « ${l.title} »`, group: 'Notions', icon: 'sparkle', go: () => navigate({ page: 'lesson', lessonId: l.id }) });
      }
    }
    return [...courses.slice(0, 4), ...lessons.slice(0, 5), ...notions.slice(0, 4)];
  }, [q]);
}

export function SearchBox({ placeholder = 'Rechercher un cours, une leçon, une notion', compact }: { placeholder?: string; compact?: boolean }) {
  const [q, setQ] = useState(''); const [open, setOpen] = useState(false); const [idx, setIdx] = useState(0);
  const results = useSearchResults(q);
  const pick = (i: number) => { const r = results[i]; if (!r) return; r.go(); setQ(''); setOpen(false); (document.activeElement as HTMLElement | null)?.blur(); };
  return (
    <div className={cx('search', compact && 'is-compact')} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }}>
      <Icon name="search" size={18} />
      <input id="global-search" type="search" role="combobox" aria-expanded={open && q.length > 1} aria-controls="search-results" aria-autocomplete="list" aria-label="Rechercher un cours, une leçon ou une notion"
        aria-activedescendant={open && results[idx] ? `sr-${results[idx].id}` : undefined} autoComplete="off"
        value={q} placeholder={placeholder} onChange={(e) => { setQ(e.target.value); setOpen(true); setIdx(0); }} onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(results.length - 1, i + 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
          if (e.key === 'Enter') { e.preventDefault(); if (results.length) pick(idx); else { navigate({ page: 'library' }); setOpen(false); } }
          if (e.key === 'Escape') { setOpen(false); (e.target as HTMLInputElement).blur(); }
        }} />
      {!compact && <span className="search-kbd" aria-hidden="true"><Kbd>Ctrl K</Kbd></span>}
      {open && q.length > 1 && (
        <ul className="search-results" id="search-results" role="listbox" aria-label="Résultats">
          {results.length === 0 && <li className="search-empty" role="option" aria-selected="false">Aucun résultat pour « {q} ».</li>}
          {results.map((r, i) => (
            <li key={r.id} id={`sr-${r.id}`} role="option" aria-selected={i === idx}>
              {(i === 0 || results[i - 1].group !== r.group) && <span className="search-group" aria-hidden="true">{r.group}</span>}
              <button type="button" tabIndex={-1} className={cx(i === idx && 'active')} onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setIdx(i)} onClick={() => pick(i)}>
                <span className="search-ic"><Icon name={r.icon} size={15} /></span><span><strong>{r.title}</strong><small>{r.sub}</small></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- notifications + profile
function usePopover() {
  const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', close); window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', esc); };
  }, [open]);
  return { open, setOpen, ref };
}

export function Notifications() {
  const s = useLearner(); const p = usePopover();
  const unread = s.notifications.filter((n) => !n.read).length;
  return (
    <div className="popover-wrap" ref={p.ref}>
      <button type="button" className="top-btn" aria-label={`Notifications${unread ? ` (${unread} non lues)` : ''}`} aria-expanded={p.open}
        onClick={() => { p.setOpen(!p.open); if (!p.open && unread) window.setTimeout(() => store.markNotificationsRead(), 1200); }}>
        <Icon name="bell" size={20} />{unread > 0 && <i className="top-dot" aria-hidden="true" />}
      </button>
      {p.open && (
        <div className="popover notif-pop" role="dialog" aria-label="Notifications">
          <div className="pop-head"><h3>Notifications</h3>{unread > 0 && <span className="pill pill-coral">{unread} nouvelle{unread > 1 ? 's' : ''}</span>}</div>
          {s.notifications.length === 0 ? <p className="muted">Rien de nouveau pour l’instant.</p> : (
            <ul>{s.notifications.slice(0, 8).map((n) => (
              <li key={n.id} className={cx(!n.read && 'unread')}>
                <span className={cx('notif-icon', `k-${n.kind}`)}><Icon name={n.kind === 'badge' ? 'medal' : n.kind === 'streak' ? 'flame' : n.kind === 'lesson' ? 'check' : n.kind === 'payment' ? 'card' : 'bell'} size={16} /></span>
                <span><strong>{n.title}</strong><small>{n.body}</small><time dateTime={n.at}>{relative(n.at)}</time></span>
              </li>))}
            </ul>)}
        </div>
      )}
    </div>
  );
}

export function ProfileMenu({ big }: { big?: boolean }) {
  const s = useLearner(); const p = usePopover();
  const go = (fn: () => void) => () => { p.setOpen(false); fn(); };
  return (
    <div className="popover-wrap" ref={p.ref}>
      <button type="button" className={cx('avatar-btn', big && 'big')} aria-expanded={p.open} aria-haspopup="menu" aria-label="Menu du profil" onClick={() => p.setOpen(!p.open)}>
        <PhotoView className="avatar-img" photo={s.profile.photo ?? DEFAULT_PHOTO} first={s.profile.firstName} last={s.profile.lastName} />
      </button>
      {p.open && (
        <div className="popover menu" role="menu">
          <div className="menu-who"><strong>{s.profile.firstName} {s.profile.lastName}</strong><small>Objectif : {s.profile.dailyGoalMin} min par jour</small></div>
          <button type="button" role="menuitem" onClick={go(() => navigate({ page: 'settings' }))}><Icon name="user" size={16} />Profil et paramètres</button>
          <button type="button" role="menuitem" onClick={go(() => overlays.openPhoto())}><Icon name="camera" size={16} />Changer ma photo</button>
          <button type="button" role="menuitem" onClick={go(() => navigate({ page: 'progress' }))}><Icon name="progress" size={16} />Ma progression</button>
          <button type="button" role="menuitem" onClick={go(() => navigate({ page: 'subscription' }))}><Icon name="crown" size={16} />Abonnement</button>
        </div>
      )}
    </div>
  );
}

/** Streak and today's goal, always in sight. */
export function StatChips() {
  const s = useLearner();
  const sk = streak(s); const today = todayMinutes(s); const goal = s.profile.dailyGoalMin;
  return (
    <>
      <button type="button" className="stat-chip" onClick={() => navigate({ page: 'progress' })} aria-label={`Série : ${sk.days} jour${sk.days > 1 ? 's' : ''} d’affilée`}>
        <span className={cx('stat-ic', 'is-flame', !sk.todayActive && 'is-off')}><Icon name="flameSolid" size={15} /></span><strong>{sk.days} jour{sk.days > 1 ? 's' : ''}</strong>
      </button>
      <button type="button" className="stat-chip" onClick={() => navigate({ page: 'progress' })} aria-label={`Objectif du jour : ${Math.min(today, 999)} minutes sur ${goal}`}>
        <span className={cx('stat-ic', 'is-goal', today >= goal && 'is-met')}><Icon name="target" size={15} /></span><strong>{Math.min(today, 999)} / {goal} min</strong>
      </button>
    </>
  );
}

export function Topbar() {
  return (
    <header className="topbar">
      <SearchBox />
      <div className="top-actions">
        <StatChips />
        <Notifications />
        <ProfileMenu />
      </div>
    </header>
  );
}
