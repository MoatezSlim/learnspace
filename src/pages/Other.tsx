import React, { useEffect, useState } from 'react';
import { useLearner, store } from '../state/store';
import { ACHIEVEMENTS } from '../state/achievements';
import { Icon } from '../components/icons';
import { Button, Dialog, ProgressBar, cx, toast } from '../components/ui';
import { ChatPanel, Bubble, useAiStatus, StatusDot } from '../assistant/AssistantPanels';
import { Lea, STATUS_LABEL } from '../assistant/Lea';
import { useAvatar } from '../assistant/controller';
import { sttSupported } from '../assistant/speech';
import { relative } from '../lib/dates';
import { navigate } from '../router';
import { PhotoView, DEFAULT_PHOTO } from '../components/avatars';
import { overlays } from '../state/ui';

export function BadgesPage() {
  const s = useLearner();
  const earned = ACHIEVEMENTS.filter((a) => s.achievements[a.id]).length;
  return (
    <div className="page">
      <header className="page-head"><h1>Badges</h1><p className="muted">{earned} badges obtenus sur {ACHIEVEMENTS.length}. Ils récompensent la régularité et la réussite, jamais un simple clic.</p></header>
      <div className="badge-grid">
        {ACHIEVEMENTS.map((a) => {
          const at = s.achievements[a.id]; const p = a.progress(s); const pct = Math.min(100, (p.cur / p.target) * 100);
          return (
            <article key={a.id} className={cx('card badge-card', at ? 'earned' : 'locked')}>
              <span className="badge-medal" aria-hidden="true"><Icon name={a.icon} size={26} /></span>
              <h2>{a.title}</h2>
              <p className="muted small">{a.description}</p>
              {at ? <span className="pill pill-green"><Icon name="check" size={13} />Obtenu {relative(at)}</span> : (
                <div className="badge-progress"><ProgressBar value={pct} size="sm" label={`${a.title} : ${Math.min(p.cur, p.target)} sur ${p.target}`} /><small>{Math.min(p.cur, p.target)} / {p.target}</small></div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function MessagesPage({ mobile }: { mobile: boolean }) {
  const v = useAvatar();
  if (mobile) return <div className="page page-chat"><ChatPanel variant="page" /></div>;
  return (
    <div className="page messages">
      <ChatPanel variant="page" />
      <aside className="card assistant-stage-card" aria-label="Léa">
        <div className="big-stage"><Lea framing="tall" /></div>
        <div className="stage-meta">
          <div className="row-between"><strong>Léa</strong><StatusDot /></div>
          <Bubble fallback="Pose-moi une question : je te réponds par écrit, ici et dans la conversation." tail="top" />
          <p className="muted small">État : {STATUS_LABEL[v.status]}. Léa est tirée de sa planche de personnage : ses yeux suivent ta souris, elle cligne des yeux et change d’expression (contente quand tu réussis, triste quand tu te trompes). C’est un avatar 2D animé, sans voix, pas un modèle 3D.</p>
        </div>
      </aside>
    </div>
  );
}

export function SettingsPage({ syncStatus }: { syncStatus: { status: string; savedAt: string | null } }) {
  const s = useLearner(); const ai = useAiStatus();
  const [confirm, setConfirm] = useState(false);
  const [first, setFirst] = useState(s.profile.firstName); const [last, setLast] = useState(s.profile.lastName);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setFirst(s.profile.firstName); setLast(s.profile.lastName); }, [s.profile.firstName, s.profile.lastName]);

  const saveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!first.trim()) { setErr('Indique ton prénom.'); return; }
    setErr(null); store.setProfile({ firstName: first.trim().slice(0, 30), lastName: last.trim().slice(0, 40) }); toast('Profil enregistré', 'success');
  };
  const syncText = syncStatus.status === 'cloud' ? 'Ta progression est enregistrée dans ton espace privé de cette page et synchronisée entre tes appareils.'
    : syncStatus.status === 'local' ? 'Ta progression est enregistrée dans ce navigateur uniquement.'
    : syncStatus.status === 'loading' ? 'Connexion au stockage…' : 'Le stockage n’est pas disponible ici : ta progression sera perdue en quittant la page.';

  return (
    <div className="page settings">
      <header className="page-head"><h1>Paramètres</h1><p className="muted">Profil, objectif quotidien et comportement de ton assistante.</p></header>
      <div className="settings-grid">
        <form className="card" onSubmit={saveProfile} noValidate>
          <h2>Profil</h2>
          <div className="pf-photo">
            <PhotoView className="pf-photo-img" photo={s.profile.photo ?? DEFAULT_PHOTO} first={s.profile.firstName} last={s.profile.lastName} />
            <div><strong>Photo de profil</strong><small className="muted">Un avatar, tes initiales ou ta propre photo.</small></div>
            <Button variant="secondary" size="sm" icon="camera" onClick={() => overlays.openPhoto()}>Changer</Button>
          </div>
          <div className="field"><label htmlFor="pf-first">Prénom</label><input id="pf-first" value={first} onChange={(e) => setFirst(e.target.value)} aria-invalid={!!err} aria-describedby={err ? 'pf-err' : undefined} autoComplete="given-name" /></div>
          {err && <p className="field-error" id="pf-err" role="alert">{err}</p>}
          <div className="field"><label htmlFor="pf-last">Nom</label><input id="pf-last" value={last} onChange={(e) => setLast(e.target.value)} autoComplete="family-name" /></div>
          <div className="field"><label htmlFor="pf-goal">Objectif quotidien</label>
            <select id="pf-goal" value={s.profile.dailyGoalMin} onChange={(e) => store.setProfile({ dailyGoalMin: Number(e.target.value) })}>
              {[10, 15, 20, 30, 45].map((m) => <option key={m} value={m}>{m} minutes par jour</option>)}
            </select>
          </div>
          <Button type="submit">Enregistrer le profil</Button>
        </form>

        <section className="card">
          <h2>Assistante</h2>
          <fieldset className="radios">
            <legend>Source des réponses</legend>
            <label className="radio"><input type="radio" name="ai" checked={s.prefs.aiMode === 'live' && ai === 'available'} disabled={ai !== 'available'} onChange={() => store.setPrefs({ aiMode: 'live' })} />
              <span><strong>Réponses en direct</strong><small>{ai === 'available' ? 'Léa rédige chaque réponse à partir de tes cours et de ta progression. La première question demande ton autorisation.' : ai === 'checking' ? 'Vérification de la disponibilité…' : 'Indisponible dans cette vue.'}</small></span></label>
            <label className="radio"><input type="radio" name="ai" checked={s.prefs.aiMode === 'demo' || ai !== 'available'} onChange={() => store.setPrefs({ aiMode: 'demo' })} />
              <span><strong>Réponses préparées</strong><small>Calculées à partir des données des cours et de ta progression. Fonctionne partout, sans connexion.</small></span></label>
          </fieldset>
          <fieldset className="radios">
            <legend>Animations</legend>
            {(['system', 'full', 'reduced'] as const).map((m) => (
              <label key={m} className="radio"><input type="radio" name="motion" checked={s.prefs.motion === m} onChange={() => store.setPrefs({ motion: m })} />
                <span><strong>{m === 'system' ? 'Selon mon système' : m === 'full' ? 'Animations complètes' : 'Animations réduites'}</strong><small>{m === 'reduced' ? 'Pas de respiration ni de mouvements de tête ; textes affichés d’un coup, sans effet de frappe.' : m === 'system' ? 'Respecte le réglage « réduire les animations » de ton appareil.' : 'Respiration, clignements, regards, expressions et petits effets.'}</small></span></label>
            ))}
          </fieldset>
          <p className="muted small">Saisie vocale dans la conversation : {sttSupported ? 'disponible si le micro est autorisé.' : 'non disponible dans ce navigateur.'}</p>
        </section>

        <section className="card">
          <h2>Données</h2>
          <p className="notice"><Icon name={syncStatus.status === 'cloud' ? 'cloud' : 'info'} size={15} />{syncText}{syncStatus.savedAt ? ` Dernier enregistrement ${relative(syncStatus.savedAt)}.` : ''}</p>
          <p className="muted small">Les cours, l’historique de départ (24 leçons d’anglais, séries, badges) et les réponses préparées de Léa sont des données de démonstration. Tout ce que tu fais ensuite est réellement enregistré.</p>
          <div className="row-gap">
            <Button variant="danger" icon="replay" onClick={() => setConfirm(true)}>Réinitialiser la démonstration</Button>
            <Button variant="ghost" onClick={() => navigate({ page: 'badges' })}>Voir mes badges</Button>
          </div>
        </section>
      </div>
      <Dialog open={confirm} title="Réinitialiser la démonstration ?" onClose={() => setConfirm(false)}
        actions={<><Button variant="secondary" onClick={() => setConfirm(false)}>Annuler</Button><Button variant="danger" onClick={() => { store.resetDemo(); setConfirm(false); toast('Démonstration réinitialisée', 'success'); navigate({ page: 'home' }); }}>Réinitialiser</Button></>}>
        <p>Ta progression, tes réponses, tes badges et la conversation reviendront à l’état de départ. Tes réglages d’assistante et d’animation sont conservés.</p>
      </Dialog>
    </div>
  );
}
