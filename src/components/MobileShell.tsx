// Phone layout: an app bar at the top, a tab bar at the bottom with Léa in the middle, and the full
// navy menu in a sheet (opened from the profile picture).
import React, { useEffect, useState } from 'react';
import { Icon, IconName } from './icons';
import { cx } from './ui';
import { navigate, beforeNavigate } from '../router';
import { useLearner, unreadCount } from '../state/store';
import { streak } from '../state/selectors';
import type { PageId, Route } from '../types';
import { LogoMark, Sidebar, activeNav, Notifications } from './Shell';
import { PhotoView, DEFAULT_PHOTO } from './avatars';
import { leaAsset } from '../assistant/leaRig';
import { useAvatar } from '../assistant/controller';

const TITLES: Partial<Record<PageId, string>> = { courses: 'Mes cours', course: 'Cours', library: 'Bibliothèque', progress: 'Progression', badges: 'Badges', settings: 'Paramètres', subscription: 'Abonnement', messages: 'Léa' };

export function MobileAppBar({ route }: { route: Route }) {
  const s = useLearner();
  const [open, setOpen] = useState(false);
  const sk = streak(s);
  useEffect(() => beforeNavigate(() => setOpen(false)), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open]);
  const title = route.page === 'home' ? `Bonjour, ${s.profile.firstName}` : TITLES[route.page] ?? 'LearnSpace';
  return (
    <>
      <header className="m-bar">
        <button type="button" className="m-brand" onClick={() => navigate({ page: 'home' })} aria-label="LearnSpace, accueil"><LogoMark size={34} /></button>
        <h1 className="m-title">{title}</h1>
        <div className="m-actions">
          <button type="button" className="m-streak" onClick={() => navigate({ page: 'progress' })} aria-label={`Série : ${sk.days} jours`}><Icon name="flameSolid" size={15} /><b className="num">{sk.days}</b></button>
          <Notifications />
          <button type="button" className="m-me" aria-label="Ouvrir le menu" aria-expanded={open} onClick={() => setOpen(true)}>
            <PhotoView className="avatar-img" photo={s.profile.photo ?? DEFAULT_PHOTO} first={s.profile.firstName} last={s.profile.lastName} />
          </button>
        </div>
      </header>
      {open && (
        <div className="m-sheet" role="dialog" aria-modal="true" aria-label="Menu" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <Sidebar onClose={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}

const TABS: { page: PageId; label: string; icon: IconName }[] = [
  { page: 'home', label: 'Accueil', icon: 'home' },
  { page: 'courses', label: 'Cours', icon: 'courses' },
  { page: 'messages', label: 'Léa', icon: 'message' },
  { page: 'progress', label: 'Progrès', icon: 'progress' },
  { page: 'badges', label: 'Badges', icon: 'badge' },
];

export function MobileTabBar({ route }: { route: Route }) {
  const s = useLearner(); const v = useAvatar();
  const active = activeNav(route.page) === 'courses' || route.page === 'library' ? 'courses' : activeNav(route.page);
  const unread = unreadCount(s);
  return (
    <nav className="m-tabs" aria-label="Navigation">
      {TABS.map((t) => t.page === 'messages' ? (
        <button key={t.page} type="button" className={cx('m-tab', 'm-tab-lea', active === t.page && 'active', v.status === 'thinking' && 'is-thinking')} aria-current={active === t.page ? 'page' : undefined}
          aria-label={`Léa${unread ? ` (${unread} message${unread > 1 ? 's' : ''})` : ''}`} onClick={() => navigate({ page: 'messages' })}>
          <span className="m-lea-btn"><img src={leaAsset('face_light.webp')} alt="" draggable={false} /><i className="m-online" aria-hidden="true" />{unread > 0 && <b className="m-unread" aria-hidden="true">{unread}</b>}</span>
          <span className="m-tab-label">{t.label}</span>
        </button>
      ) : (
        <button key={t.page} type="button" className={cx('m-tab', active === t.page && 'active')} aria-current={active === t.page ? 'page' : undefined} onClick={() => navigate({ page: t.page })}>
          <Icon name={t.icon} size={22} /><span className="m-tab-label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
