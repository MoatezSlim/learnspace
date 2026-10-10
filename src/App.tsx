import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { useRoute, beforeNavigate, getRoute } from './router';
import { store, useLearner } from './state/store';
import { avatar } from './assistant/controller';
import { detectLiveAi } from './assistant/brain';
import { setAssistantPage } from './assistant/assistant';
import { preloadLea, live } from './assistant/leaRig';
import { AssistantDrawer, AssistantLauncher } from './assistant/AssistantPanels';
import { CourseGuide } from './assistant/CourseGuide';
import { guide, useGuide } from './assistant/guideState';
import { Sidebar, Topbar, MobileHeader } from './components/Shell';
import { Toasts, useMediaQuery, cx } from './components/ui';
import { Dashboard } from './pages/Dashboard';
import { LessonPage } from './pages/lesson/LessonPage';
import { Library } from './pages/Library';
import { MyCourses, CourseDetail } from './pages/Courses';
import { ProgressPage } from './pages/Progress';
import { BadgesPage, MessagesPage, SettingsPage } from './pages/Other';
import { SubscriptionPage } from './pages/Subscription';
import { NewCourseDialog, PaymentDialog, PhotoDialog } from './components/Overlays';
import type { PageId } from './types';

const TITLES: Record<PageId, string> = { home: 'Accueil', courses: 'Mes cours', course: 'Cours', library: 'Bibliothèque', progress: 'Progression', badges: 'Badges', messages: 'Léa', settings: 'Profil', lesson: 'Leçon', subscription: 'Abonnement' };
const useSync = () => useSyncExternalStore(store.subscribe, () => store.sync);
avatar.page = getRoute().page;
beforeNavigate((next) => { avatar.setPage(next.page); guide.close(); });

export function App() {
  const route = useRoute();
  const s = useLearner();
  const sync = useSync();
  const mobile = useMediaQuery('(max-width: 999px)');
  const systemReduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const reduced = s.prefs.motion === 'reduced' || (s.prefs.motion === 'system' && systemReduced);
  const [hydrated, setHydrated] = useState(false);
  const g = useGuide();

  useEffect(() => {
    avatar.start(); preloadLea();
    const t = window.setTimeout(() => setHydrated(true), 450); // the catalogue is local; do not wait on cloud sync
    void store.hydrate().finally(() => { window.clearTimeout(t); setHydrated(true); });
    void detectLiveAi();
  }, []);
  useEffect(() => { setAssistantPage(route.page); document.title = route.page === 'home' ? 'LearnSpace' : `${TITLES[route.page]} · LearnSpace`; }, [route.page]);
  useEffect(() => {
    live.reduced = reduced;
    if (avatar.reduced !== reduced) { avatar.reduced = reduced; avatar.setStatus('idle'); }
  }, [reduced]);

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
  const showLauncher = !['home', 'lesson', 'messages'].includes(route.page) && !g.courseId;

  return (
    <div className={cx('app', reduced && 'reduce-motion', mobile ? 'is-mobile' : 'is-desktop', !mobile && s.prefs.sidebar === 'rail' && 'sb-rail', route.page === 'lesson' && 'in-lesson', route.page === 'home' && 'is-home', showLauncher && 'has-launcher')}>
      <a className="skip" href="#content" onClick={(e) => { e.preventDefault(); document.getElementById('content')?.focus(); }}>Aller au contenu</a>
      {!mobile && <Sidebar />}
      <div className="main">
        {!mobile && route.page !== 'lesson' && <Topbar />}
        {mobile && <MobileHeader lesson={route.page === 'lesson'} />}
        <main id="content" tabIndex={-1}>{page}</main>
      </div>
      {showLauncher && <AssistantLauncher />}
      <CourseGuide mobile={mobile} />
      <AssistantDrawer />
      <NewCourseDialog />
      <PaymentDialog />
      <PhotoDialog />
      <Toasts />
    </div>
  );
}
