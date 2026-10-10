import React, { useEffect, useRef, useState } from 'react';
import { useLearner, store } from '../state/store';
import { subscriptionInfo } from '../state/selectors';
import { useAiStatus } from '../assistant/AssistantPanels';
import { registerRail } from '../assistant/LeaDock';
import { avatar } from '../assistant/controller';
import { sttSupported } from '../assistant/speech';
import { Icon, IconName } from '../components/icons';
import { Button, Dialog, cx, toast, Toggle, Seg, downloadText } from '../components/ui';
import { PhotoView, DEFAULT_PHOTO, INITIAL_COLORS } from '../components/avatars';
import { overlays } from '../state/ui';
import { navigate } from '../router';
import { relative, longDate } from '../lib/dates';
import { PLAN_NAME, euros } from '../data/plans';
import type { CoachStyle, LearnerState, Prefs, Route } from '../types';

const SECTIONS: { id: string; label: string; icon: IconName }[] = [
  { id: 'st-profile', label: 'Profil', icon: 'user' },
  { id: 'st-goal', label: 'Objectif et rythme', icon: 'target' },
  { id: 'st-lea', label: 'Léa', icon: 'sparkle' },
  { id: 'st-notif', label: 'Notifications', icon: 'bell' },
  { id: 'st-sub', label: 'Abonnement', icon: 'crown' },
  { id: 'st-data', label: 'Données', icon: 'shield' },
];
const GOALS: { m: number; word: string }[] = [{ m: 5, word: 'en douceur' }, { m: 10, word: 'régulier' }, { m: 15, word: 'motivé' }, { m: 20, word: 'intensif' }, { m: 30, word: 'ambitieux' }];
export const STYLES: { id: CoachStyle; title: string; text: string; icon: IconName; tone: string }[] = [
  { id: 'encourage', title: 'Encourageante', text: 'Des explications claires, des félicitations et un conseil pour la suite.', icon: 'smile', tone: 'blue' },
  { id: 'strict', title: 'Exigeante', text: 'Moins de compliments, plus de corrections et d’exercices ciblés.', icon: 'target', tone: 'gold' },
  { id: 'discreet', title: 'Discrète', text: 'Elle intervient seulement quand tu lui poses une question.', icon: 'volumeOff', tone: 'mint' },
];

export function SettingsPage({ syncStatus }: { syncStatus: { status: string; savedAt: string | null } }) {
  const s = useLearner(); const ai = useAiStatus();
  const [confirm, setConfirm] = useState(false);
  const [active, setActive] = useState(SECTIONS[0].id);
  const coach = s.prefs.coach ?? 'encourage';
  const dock = s.prefs.dock ?? 'panel';
  const notify = s.prefs.notify ?? { daily: true, weekly: true, newCourses: false };
  const setPrefs = (p: Partial<Prefs>) => store.setPrefs(p);
  // the section in view is highlighted in the menu
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => { const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]; if (top) setActive(top.target.id); }, { rootMargin: '-20% 0px -60% 0px' });
    SECTIONS.forEach((x) => { const el = document.getElementById(x.id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);
  const go = (id: string) => { setActive(id); document.getElementById(id)?.scrollIntoView({ behavior: s.prefs.motion === 'reduced' || s.prefs.motion === 'none' ? 'auto' : 'smooth', block: 'start' }); };
  const syncText = syncStatus.status === 'cloud' ? 'Tes progrès sont enregistrés dans ton espace privé et synchronisés entre tes appareils.'
    : syncStatus.status === 'local' ? 'Tes progrès sont enregistrés dans ce navigateur.'
    : syncStatus.status === 'loading' ? 'Connexion au stockage…' : 'Le stockage n’est pas disponible ici : tes progrès seront perdus en quittant la page.';
  const sub = subscriptionInfo(s);
  const exportData = () => { if (downloadText(`learnspace-${s.profile.firstName.toLowerCase() || 'progres'}.json`, JSON.stringify(s, null, 2), 'application/json')) toast('Export téléchargé', 'success'); };
  return (
    <div className="page settings-page">
      <header className="page-head">
        <div><h1>Paramètres</h1><p className="lead">Ton profil, ton objectif et la façon dont Léa t’accompagne.</p></div>
        <span className="saved-pill" role="status"><Icon name="check" size={15} />{syncStatus.savedAt ? `Enregistré automatiquement ${relative(syncStatus.savedAt)}` : 'Enregistré automatiquement'}</span>
      </header>
      <div className="st-layout">
        <nav className="card st-nav" aria-label="Sections des paramètres">
          {SECTIONS.map((x) => <button key={x.id} type="button" className={cx(active === x.id && 'on')} aria-current={active === x.id ? 'true' : undefined} onClick={() => go(x.id)}><Icon name={x.icon} size={18} />{x.label}</button>)}
        </nav>
        <div className="st-sections">
          <Profile s={s} />
          <section id="st-goal" className="card st-card" aria-labelledby="goal-title">
            <h2 id="goal-title">Objectif quotidien</h2>
            <p className="muted">Léa construit ton plan du jour à partir de cet objectif. Tu peux le changer quand tu veux.</p>
            <div className="goal-opts" role="radiogroup" aria-labelledby="goal-title">
              {GOALS.map((g) => (
                <button key={g.m} type="button" role="radio" aria-checked={s.profile.dailyGoalMin === g.m} className={cx('goal-opt', s.profile.dailyGoalMin === g.m && 'on')}
                  onClick={() => { store.setProfile({ dailyGoalMin: g.m }); avatar.react('point'); }}>
                  <strong className="num">{g.m}</strong><small>min, {g.word}</small>
                </button>
              ))}
            </div>
          </section>
          <section id="st-lea" className="card st-card" aria-labelledby="lea-title">
            <h2 id="lea-title">Léa, ta coach</h2>
            <p className="muted">Choisis comment elle te parle et où elle apparaît à l’écran.</p>
            <div className="style-opts" role="radiogroup" aria-label="Style de Léa">
              {STYLES.map((x) => (
                <button key={x.id} type="button" role="radio" aria-checked={coach === x.id} className={cx('style-opt', coach === x.id && 'on')} onClick={() => { setPrefs({ coach: x.id }); avatar.express(x.id === 'strict' ? 'skeptical' : x.id === 'discreet' ? 'content' : 'happy', 1400, 'smile'); }}>
                  <span className={cx('style-ic', `is-${x.tone}`)}><Icon name={x.icon} size={18} /></span>
                  <span className="radio-dot" aria-hidden="true" />
                  <strong>{x.title}</strong><small>{x.text}</small>
                </button>
              ))}
            </div>
            <div className="dock-opts" role="radiogroup" aria-label="Place de Léa à l’écran">
              {(['panel', 'bubble'] as const).map((d) => (
                <button key={d} type="button" role="radio" aria-checked={dock === d} className={cx('dock-opt', dock === d && 'on')} onClick={() => setPrefs({ dock: d })}>
                  <span className={cx('dock-art', `is-${d}`)} aria-hidden="true"><i className="da-side" /><i className="da-l1" /><i className="da-l2" /><i className="da-l3" /><i className="da-lea" /></span>
                  <strong>{dock === d && <Icon name="check" size={15} />}{d === 'panel' ? 'Panneau à droite' : 'Bulle flottante'}</strong>
                  <small>{d === 'panel' ? 'Léa reste visible à côté de chaque page (grands écrans).' : 'Plus de place pour le contenu, Léa s’ouvre au clic.'}</small>
                </button>
              ))}
            </div>
            <div className="st-row">
              <div><strong>Animations de Léa</strong><small>Mouvements de tête, clignements et expressions</small></div>
              <Seg size="sm" label="Animations" value={s.prefs.motion} onChange={(motion) => setPrefs({ motion })} options={[{ id: 'system', label: 'Auto' }, { id: 'full', label: 'Complètes' }, { id: 'reduced', label: 'Réduites' }, { id: 'none', label: 'Aucune' }]} />
            </div>
            <div className="st-row">
              <div><strong>Traduire en français</strong><small>Les répliques des leçons et les exemples de Léa</small></div>
              <Toggle checked={s.prefs.translate !== false} onChange={(v) => setPrefs({ translate: v })} label="Traduire en français" />
            </div>
            <div className="st-row">
              <div><strong>Réponses en direct</strong><small>{ai === 'available' ? 'Léa rédige chaque réponse à partir de tes cours et de ta progression.' : ai === 'checking' ? 'Vérification de la disponibilité…' : 'Indisponible ici : Léa utilise ses réponses préparées, calculées à partir de tes cours.'}</small></div>
              <Toggle checked={s.prefs.aiMode === 'live' && ai === 'available'} onChange={(v) => setPrefs({ aiMode: v ? 'live' : 'demo' })} label="Réponses en direct" />
            </div>
          </section>
          <section id="st-notif" className="card st-card" aria-labelledby="notif-title">
            <h2 id="notif-title">Notifications</h2>
            <p className="muted">Elles s’affichent dans la cloche, en haut de chaque page.</p>
            <div className="st-row"><div><strong>Rappel quotidien</strong><small>Tous les jours à 12 h 15, si ton objectif n’est pas atteint</small></div><Toggle checked={notify.daily} onChange={(v) => setPrefs({ notify: { ...notify, daily: v } })} label="Rappel quotidien" /></div>
            <div className="st-row"><div><strong>Bilan de la semaine</strong><small>Le dimanche soir, avec tes progrès de la semaine</small></div><Toggle checked={notify.weekly} onChange={(v) => setPrefs({ notify: { ...notify, weekly: v } })} label="Bilan de la semaine" /></div>
            <div className="st-row"><div><strong>Nouveaux cours dans tes domaines</strong><small>Une fois par mois au maximum</small></div><Toggle checked={notify.newCourses} onChange={(v) => setPrefs({ notify: { ...notify, newCourses: v } })} label="Nouveaux cours" /></div>
          </section>
          <section id="st-sub" className="card st-card" aria-labelledby="sub-title">
            <h2 id="sub-title">Abonnement</h2>
            <div className="st-sub">
              <span className="plan-crown"><Icon name="crown" size={19} /></span>
              <div><strong>{PLAN_NAME} · {sub.plan.label.toLowerCase()}</strong><small>{sub.label} · {euros(sub.plan.price)} / {sub.plan.per} · jusqu’au {longDate(sub.until)}</small></div>
              <Button variant="line" size="sm" onClick={() => navigate({ page: 'subscription' })}>Gérer</Button>
            </div>
          </section>
          <section id="st-data" className="card st-card" aria-labelledby="data-title">
            <h2 id="data-title">Données</h2>
            <p className="muted">{syncText}{syncStatus.savedAt ? ` Dernier enregistrement ${relative(syncStatus.savedAt)}.` : ''}</p>
            <p className="muted small">Les cours, l’historique de départ et les réponses préparées de Léa sont des données de démonstration. Tout ce que tu fais ensuite est réellement enregistré. Saisie vocale : {sttSupported ? 'disponible si le micro est autorisé' : 'non disponible dans ce navigateur'}.</p>
            <div className="st-actions">
              <Button variant="line" icon="upload" onClick={exportData}>Exporter mes progrès</Button>
              <Button variant="danger" icon="replay" onClick={() => setConfirm(true)}>Réinitialiser les données de démonstration</Button>
            </div>
          </section>
        </div>
      </div>
      <Dialog open={confirm} title="Réinitialiser la démonstration ?" onClose={() => setConfirm(false)}
        actions={<><Button variant="line" onClick={() => setConfirm(false)}>Annuler</Button><Button variant="danger" onClick={() => { store.resetDemo(); setConfirm(false); toast('Démonstration réinitialisée', 'success'); navigate({ page: 'home' }); }}>Réinitialiser</Button></>}>
        <p>Ta progression, tes réponses, tes badges et la conversation reviendront à l’état de départ. Tes réglages de Léa et d’affichage sont conservés.</p>
      </Dialog>
    </div>
  );
}

function Profile({ s }: { s: LearnerState }) {
  const [first, setFirst] = useState(s.profile.firstName);
  const [last, setLast] = useState(s.profile.lastName);
  const [goal, setGoal] = useState(s.profile.goal ?? '');
  const [err, setErr] = useState<string | null>(null);
  const saved = useRef({ first: s.profile.firstName, last: s.profile.lastName, goal: s.profile.goal ?? '' });
  useEffect(() => { setFirst(s.profile.firstName); setLast(s.profile.lastName); setGoal(s.profile.goal ?? ''); saved.current = { first: s.profile.firstName, last: s.profile.lastName, goal: s.profile.goal ?? '' }; }, [s.profile.firstName, s.profile.lastName, s.profile.goal]);
  const save = () => {
    if (!first.trim()) { setErr('Indique ton prénom.'); return; }
    setErr(null);
    const next = { first: first.trim().slice(0, 30), last: last.trim().slice(0, 40), goal: goal.trim().slice(0, 80) };
    if (next.first === saved.current.first && next.last === saved.current.last && next.goal === saved.current.goal) return;
    store.setProfile({ firstName: next.first, lastName: next.last, goal: next.goal });
    toast('Profil enregistré', 'success');
  };
  const photo = s.profile.photo ?? DEFAULT_PHOTO;
  return (
    <section id="st-profile" className="card st-card" aria-labelledby="pf-title">
      <h2 id="pf-title">Profil</h2>
      <p className="muted">Ces informations apparaissent dans ton espace et sur tes certificats.</p>
      <div className="pf">
        <div className="pf-photo">
          <PhotoView className="pf-img" photo={photo} first={s.profile.firstName} last={s.profile.lastName} />
          <button type="button" className="pf-cam" aria-label="Changer ma photo" onClick={() => overlays.openPhoto()}><Icon name="camera" size={16} /></button>
        </div>
        <form className="pf-fields" onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
          <div className="pf-row">
            <div className="field"><label htmlFor="pf-first">Prénom</label><input id="pf-first" value={first} onChange={(e) => setFirst(e.target.value)} onBlur={save} aria-invalid={!!err} aria-describedby={err ? 'pf-err' : undefined} autoComplete="given-name" /></div>
            <div className="field"><label htmlFor="pf-last">Nom</label><input id="pf-last" value={last} onChange={(e) => setLast(e.target.value)} onBlur={save} autoComplete="family-name" /></div>
          </div>
          {err && <p className="field-error" id="pf-err" role="alert">{err}</p>}
          <div className="field"><label htmlFor="pf-goal">Ce que tu veux réussir</label><input id="pf-goal" value={goal} placeholder="Par exemple : être à l’aise à l’oral au travail" onChange={(e) => setGoal(e.target.value)} onBlur={save} /></div>
          <div className="pf-photo-opts" role="group" aria-label="Photo de profil">
            <button type="button" className={cx(photo.kind === 'avatar' && 'on')} onClick={() => overlays.openPhoto()}><Icon name="user" size={16} />Avatar</button>
            <button type="button" className={cx(photo.kind === 'initials' && 'on')} onClick={() => { store.setProfile({ photo: { kind: 'initials', color: photo.kind === 'initials' ? (photo.color + 1) % INITIAL_COLORS.length : 0 } }); toast('Photo de profil mise à jour', 'success'); }}><span className="ini" aria-hidden="true">{`${s.profile.firstName[0] ?? ''}${s.profile.lastName[0] ?? ''}`.toUpperCase()}</span>Initiales</button>
            <button type="button" className={cx(photo.kind === 'image' && 'on')} onClick={() => overlays.openPhoto()}><Icon name="upload" size={16} />Importer une photo</button>
          </div>
          <button type="submit" className="sr-only">Enregistrer le profil</button>
        </form>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- Léa's panel on the settings page
const EXAMPLES: Record<CoachStyle, string[]> = {
  encourage: ['Bien joué ! « Journey » désigne le trajet. Essaie maintenant de l’utiliser dans une phrase sur ton week-end.', 'Bravo pour ta série de 5 jours ! Une petite leçon ce soir et tu bats ton record de la semaine.', 'Presque ! Réécoute la fin du dialogue : la réponse est dans la dernière phrase de Tom.'],
  strict: ['Correct. Attention : « travel » est surtout un verbe. Refais l’exercice 3 sans regarder la transcription.', '2 sur 3. Vise 3 sur 3 : revois le point clé sur « I’ll » avant de continuer.', 'Non. Relis l’indice, puis réponds en une phrase complète.'],
  discreet: ['Bonne réponse.', 'Voici la correction : « tonight ».', 'Ta prochaine leçon : « London landmarks », 8 minutes.'],
};
function SettingsRail(_: { route: Route }) {
  const s = useLearner();
  const [k, setK] = useState(0);
  const coach = s.prefs.coach ?? 'encourage';
  const order: CoachStyle[] = [coach, ...(['encourage', 'strict', 'discreet'] as CoachStyle[]).filter((x) => x !== coach)].slice(0, 2);
  return (
    <>
      <section className="rail-sec" aria-labelledby="ex-title">
        <div className="rail-sec-head"><h3 id="ex-title">Aperçu de mes réponses</h3></div>
        <div className="examples">
          {order.map((st) => (
            <figure key={st} className={cx('example', st === coach && 'is-current')}>
              <figcaption>{STYLES.find((x) => x.id === st)!.title}{st === coach && <span> · ton choix</span>}</figcaption>
              <blockquote>{EXAMPLES[st][k % EXAMPLES[st].length]}</blockquote>
            </figure>
          ))}
        </div>
      </section>
      <button type="button" className="chip chip-ask" onClick={() => setK(k + 1)}><Icon name="replay" size={15} />Voir un autre exemple</button>
    </>
  );
}
registerRail('settings', SettingsRail);
