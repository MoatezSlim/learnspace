import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { useRoute, beforeNavigate, getRoute } from './router';
import { store, useLearner } from './state/store';
import { avatar } from './assistant/controller';
import { detectLiveAi } from './assistant/brain';
import { setAssistantPage } from './assistant/assistant';
import { preloadLea, live } from './assistant/leaRig';
import { CourseGuide } from './assistant/CourseGuide';
import { guide } from './assistant/guideState';
import { LeaDock, DockMode } from './assistant/LeaDock';
import { Sidebar, Topbar } from './components/Shell';
import { MobileAppBar, MobileTabBar } from './components/MobileShell';
import { Toasts, useMediaQuery, cx } from './components/ui';
import { Dashboard } from './pages/Dashboard';
import { LessonPage } from './pages/lesson/LessonPage';
import { Library } from './pages/Library';
import { MyCourses } from './pages/Courses';
import { CourseDetail } from './pages/CourseDetail';
import { ProgressPage } from './pages/Progress';
import { BadgesPage } from './pages/Badges';
import { MessagesPage } from './pages/Messages';
import { SettingsPage } from './pages/Settings';
import { SubscriptionPage } from './pages/Subscription';
import { NewCourseDialog, PaymentDialog, PhotoDialog } from './components/Overlays';
import { overlays } from './state/ui';
import { autoNotes } from './state/notes';
import type { PageId } from './types';

const TITLES: Record<PageId, string> = { home: 'Accueil', courses: 'Mes cours', course: 'Cours', library: 'Bibliothèque', progress: 'Progression', badges: 'Badges', messages: 'Léa', settings: 'Paramètres', lesson: 'Leçon', subscription: 'Abonnement' };
const useSync = () => useSyncExternalStore(store.subscribe, () => store.sync);
avatar.page = getRoute().page;
beforeNavigate((next) => { avatar.setPage(next.page); guide.close(); });

export function App() {
  const route = useRoute();
  const s = useLearner();
  const sync = useSync();
  const mobile = useMediaQuery('(max-width: 999px)');
  const wide = useMediaQuery('(min-width: 1440px)');
  const systemReduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const still = s.prefs.motion === 'none';
  const reduced = still || s.prefs.motion === 'reduced' || (s.prefs.motion === 'system' && systemReduced);
  const [hydrated, setHydrated] = useState(false);
  const dock: DockMode | null = mobile ? null : wide && (s.prefs.dock ?? 'panel') === 'panel' ? 'panel' : 'bubble';

  useEffect(() => {
    avatar.start(); preloadLea();
    const t = window.setTimeout(() => setHydrated(true), 450); // the catalogue is local; do not wait on cloud sync
    void store.hydrate().finally(() => { window.clearTimeout(t); setHydrated(true); });
    void detectLiveAi();
    // reminders the learner asked for, the daily reminder and the weekly summary (in-app notifications)
    const notes = () => store.deliverNotes(new Date(), autoNotes(store));
    const n0 = window.setTimeout(notes, 1500);
    const n1 = window.setInterval(notes, 60000);
    return () => { window.clearTimeout(n0); window.clearInterval(n1); };
  }, []);
  useEffect(() => {
    setAssistantPage(route.page, route.courseId);
    document.title = route.page === 'home' ? 'LearnSpace' : `${TITLES[route.page]} · LearnSpace`;
    if (route.page === 'messages') store.markChatSeen();
  }, [route.page, route.courseId]);
  useEffect(() => {
    live.reduced = reduced; live.still = still;
    if (avatar.reduced !== reduced) { avatar.reduced = reduced; avatar.setStatus('idle'); }
  }, [reduced, still]);
  // keyboard shortcuts: N (new course), Ctrl/⌘ K (search)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        const box = document.getElementById('global-search') as HTMLInputElement | null;
        if (box) { e.preventDefault(); box.focus(); box.select(); }
        return;
      }
      if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'n' && !document.querySelector('.dialog-backdrop')) { e.preventDefault(); overlays.openNewCourse(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  let page: React.ReactNode;
  switch (route.page) {
    case 'lesson': page = <LessonPage lessonId={route.lessonId ?? ''} mobile={mobile} />; break;
    case 'library': page = <Library hydrated={hydrated} />; break;
    case 'courses': page = <MyCourses />; break;
    case 'course': page = <CourseDetail courseId={route.courseId} />; break;
    case 'progress': page = <ProgressPage />; break;
    case 'badges': page = <BadgesPage />; break;
    case 'messages': page = <MessagesPage mobile={mobile} />; break;
    case 'settings': page = <SettingsPage syncStatus={sync} />; break;
    case 'subscription': page = <SubscriptionPage />; break;
    default: page = <Dashboard mobile={mobile} />;
  }
  const bare = route.page === 'lesson' || route.page === 'messages'; // pages with their own header

  return (
    <div className={cx('app', reduced && 'reduce-motion', still && 'motion-none', mobile ? 'is-mobile' : 'is-desktop', !mobile && s.prefs.sidebar === 'rail' && 'sb-rail',
      dock === 'panel' && 'has-rail', dock === 'bubble' && 'has-fab', `page-${route.page}`, bare && 'is-bare')}>
      <a className="skip" href="#content" onClick={(e) => { e.preventDefault(); document.getElementById('content')?.focus(); }}>Aller au contenu</a>
      {!mobile && <Sidebar />}
      <div className="main">
        {!mobile && !bare && <Topbar />}
        {mobile && !bare && <MobileAppBar route={route} />}
        <main id="content" className="content" tabIndex={-1}>{page}</main>
      </div>
      {dock && <LeaDock mode={dock} />}
      {mobile && route.page !== 'lesson' && route.page !== 'messages' && <MobileTabBar route={route} />}
      <CourseGuide mode={dock ?? 'mobile'} />
      <NewCourseDialog />
      <PaymentDialog />
      <PhotoDialog />
      <Toasts />
    </div>
  );
}
