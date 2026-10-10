// Dialogs opened from the shell: adding a new course, paying the subscription, changing the profile picture.
import React, { useEffect, useRef, useState } from 'react';
import { Icon } from './icons';
import { Button, Dialog, CourseCover, Empty, toast, cx } from './ui';
import { useOverlays, overlays } from '../state/ui';
import { store, useLearner } from '../state/store';
import { navigate } from '../router';
import { COURSES, CATEGORIES, LEVEL_SHORT, courseLessons } from '../data/courses';
import { normalizeAnswer, subscriptionInfo } from '../state/selectors';
import { PLANS, PLAN_NAME, DEMO_METHOD, euros } from '../data/plans';
import { addMonths, longDate, spanLabel } from '../lib/dates';
import { avatar } from '../assistant/controller';
import type { CategoryId, Course, Invoice, PlanId, ProfilePhoto } from '../types';
import { AVATARS, INITIAL_COLORS, DEFAULT_PHOTO, PhotoView, AvatarSvg, InitialsSvg, initialsOf, resizePhoto } from './avatars';

// ---------------------------------------------------------------- new course
export function NewCourseDialog() {
  const o = useOverlays();
  const s = useLearner();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<CategoryId | 'all'>('all');
  useEffect(() => { if (o.newCourse) { setQ(''); setCat('all'); } }, [o.newCourse]);

  const available = COURSES.filter((c) => !s.enrollments[c.id]);
  const n = normalizeAnswer(q);
  const list = available
    .filter((c) => (cat === 'all' || c.category === cat) && (!n || normalizeAnswer(`${c.title} ${c.description}`).includes(n)))
    .sort((a, b) => b.popularity - a.popularity);
  const cats = CATEGORIES.filter((c) => available.some((x) => x.category === c.id));
  const add = (c: Course) => {
    store.enroll(c.id);
    overlays.closeNewCourse();
    toast(`« ${c.title} » ajouté à Mes cours`, 'success');
    navigate({ page: 'course', courseId: c.id }); // Léa presents it on its page
  };

  return (
    <Dialog open={o.newCourse} size="lg" className="nc" title="Ajouter un cours" onClose={overlays.closeNewCourse}
      subtitle="Choisis un nouveau cours : il rejoint « Mes cours » et Léa te le présente.">
      {available.length === 0 ? (
        <Empty icon="check" title="Tu suis déjà tous les cours du catalogue">Retrouve-les dans « Mes cours ».</Empty>
      ) : (
        <>
          <div className="nc-tools">
            <label className="nc-search">
              <Icon name="search" size={16} />
              <input data-autofocus type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un cours" aria-label="Rechercher un cours à ajouter" />
            </label>
            <div className="nc-cats" role="group" aria-label="Catégories">
              <button type="button" className={cx('nc-cat', cat === 'all' && 'is-on')} aria-pressed={cat === 'all'} onClick={() => setCat('all')}>Tous <span>{available.length}</span></button>
              {cats.map((c) => (
                <button key={c.id} type="button" className={cx('nc-cat', cat === c.id && 'is-on')} aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
                  {c.label} <span>{available.filter((x) => x.category === c.id).length}</span>
                </button>
              ))}
            </div>
          </div>
          {list.length === 0
            ? <Empty title={`Aucun cours pour « ${q} »`}>Essaie un autre mot ou une autre catégorie.</Empty>
            : (
              <ul className="nc-list">
                {list.map((c) => (
                  <li key={c.id} className="nc-item">
                    <CourseCover course={c} className="nc-cover" />
                    <div className="nc-info">
                      <strong>{c.title}</strong>
                      <span className="nc-meta">{LEVEL_SHORT[c.level]} · {courseLessons(c).length} leçons · {c.hours} h</span>
                      <p>{c.description}</p>
                    </div>
                    <Button size="sm" icon="plus" onClick={() => add(c)} aria-label={`Ajouter ${c.title}`}>Ajouter</Button>
                  </li>
                ))}
              </ul>
            )}
        </>
      )}
      <div className="nc-foot">
        <button type="button" className="link-inline" onClick={() => { overlays.closeNewCourse(); navigate({ page: 'library' }); }}>Voir toute la bibliothèque<Icon name="arrowRight" size={14} /></button>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- payment (demo)
type Step = 'confirm' | 'paying' | 'done';

export function PaymentDialog() {
  const o = useOverlays();
  const s = useLearner();
  const [plan, setPlan] = useState<PlanId>('monthly');
  const [step, setStep] = useState<Step>('confirm');
  const [inv, setInv] = useState<Invoice | null>(null);
  useEffect(() => { if (o.payment) { setPlan(o.payment.plan ?? s.subscription.plan); setStep('confirm'); setInv(null); } }, [o.payment]); // eslint-disable-line react-hooks/exhaustive-deps

  const now = new Date();
  const info = subscriptionInfo(s, now);
  const p = PLANS[plan];
  const from = info.until > now ? info.until : now;
  const to = addMonths(from, p.months);
  const close = () => { if (step !== 'paying') overlays.closePayment(); };

  const pay = () => {
    setStep('paying');
    window.setTimeout(() => {
      const i = store.paySubscription(plan);
      setInv(i); setStep('done');
      toast('Paiement confirmé', 'success');
      avatar.react('correct', 'happy');
      void avatar.say(`Merci ${s.profile.firstName} ! Ton abonnement est prolongé jusqu’au ${longDate(new Date(i.to))}. On continue ensemble ? 💙`, { mood: 'happy' });
    }, avatar.reduced ? 250 : 1100);
  };

  const title = step === 'done' ? 'Paiement confirmé' : step === 'paying' ? 'Paiement en cours…' : 'Payer l’abonnement';
  return (
    <Dialog open={!!o.payment} title={title} onClose={close} className="pay"
      subtitle={step === 'confirm' ? `${PLAN_NAME} · ${info.label.toLowerCase()}` : undefined}
      actions={step === 'confirm' ? (
        <><Button variant="secondary" onClick={close}>Annuler</Button><Button icon="lock" onClick={pay}>Payer {euros(p.price)}</Button></>
      ) : step === 'done' ? (
        <><Button variant="secondary" onClick={() => { overlays.closePayment(); navigate({ page: 'subscription' }); }}>Voir mes factures</Button><Button onClick={() => overlays.closePayment()}>Fermer</Button></>
      ) : undefined}>
      {step === 'confirm' && (
        <div className="pay-body">
          <fieldset className="pay-plans">
            <legend className="sr-only">Offre</legend>
            {Object.values(PLANS).map((pl) => (
              <label key={pl.id} className={cx('pay-plan', plan === pl.id && 'is-on')}>
                <input type="radio" name="pay-plan" value={pl.id} checked={plan === pl.id} onChange={() => setPlan(pl.id)} />
                <span className="pay-plan-name">{pl.label}{pl.note && <em className="pill pill-green">{pl.note}</em>}</span>
                <span className="pay-plan-price"><strong>{euros(pl.price)}</strong> / {pl.per}</span>
                <small>{pl.id === 'yearly' ? `soit ${euros(pl.perMonth)} par mois` : 'sans engagement'}</small>
              </label>
            ))}
          </fieldset>
          <dl className="pay-summary">
            <div><dt>Période</dt><dd>du {spanLabel(from, to, now, ' au ')}</dd></div>
            <div><dt>Moyen de paiement</dt><dd><Icon name="card" size={16} />{DEMO_METHOD}</dd></div>
            <div className="pay-total"><dt>Total</dt><dd>{euros(p.price)}</dd></div>
          </dl>
          <p className="notice pay-demo"><Icon name="info" size={16} />Démonstration : aucun paiement réel n’est effectué et aucune donnée bancaire n’est demandée.</p>
        </div>
      )}
      {step === 'paying' && (
        <div className="pay-wait" role="status"><span className="spinner" aria-hidden="true" />Validation du paiement…</div>
      )}
      {step === 'done' && inv && (
        <div className="pay-done" role="status">
          <span className="pay-check"><Icon name="check" size={26} /></span>
          <p><strong>Merci {s.profile.firstName} !</strong> Ton abonnement {PLAN_NAME} est actif jusqu’au <strong>{longDate(new Date(inv.to))}</strong>.</p>
          <p className="muted small">Facture {inv.id} · {euros(inv.amount)} · {PLANS[inv.plan].label}</p>
        </div>
      )}
    </Dialog>
  );
}

// ---------------------------------------------------------------- profile picture
const samePhoto = (a: ProfilePhoto, b: ProfilePhoto) =>
  a.kind === b.kind && (a.kind === 'avatar' ? a.id === (b as { id: string }).id : a.kind === 'initials' ? a.color === (b as { color: number }).color : a.src === (b as { src: string }).src);

export function PhotoDialog() {
  const o = useOverlays();
  const s = useLearner();
  const current = s.profile.photo ?? DEFAULT_PHOTO;
  const [pick, setPick] = useState<ProfilePhoto>(current);
  const [upload, setUpload] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!o.photo) return;
    setPick(current); setUpload(current.kind === 'image' ? current.src : null); setErr(null); setBusy(false);
  }, [o.photo]); // eslint-disable-line react-hooks/exhaustive-deps

  const { firstName: first, lastName: last } = s.profile;
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setErr(null); setBusy(true);
    try {
      const src = await resizePhoto(f);
      setUpload(src); setPick({ kind: 'image', src });
    } catch (e) {
      setErr((e as Error).message === 'type' ? 'Choisis une image (JPG, PNG, WebP…).' : (e as Error).message === 'size' ? 'Cette image est trop lourde (15 Mo maximum).' : 'Cette image n’a pas pu être lue. Essaie une autre photo.');
    } finally { setBusy(false); if (file.current) file.current.value = ''; }
  };
  const save = () => {
    store.setProfile({ photo: pick });
    overlays.closePhoto();
    toast('Photo de profil mise à jour', 'success');
  };
  const changed = !samePhoto(pick, current);

  return (
    <Dialog open={o.photo} title="Ma photo de profil" className="photo-dlg" onClose={overlays.closePhoto}
      subtitle="Elle apparaît dans le menu et en haut de chaque page."
      actions={<><Button variant="secondary" onClick={overlays.closePhoto}>Annuler</Button><Button onClick={save} disabled={!changed || busy}>Enregistrer</Button></>}>
      <div className="photo-body">
        <div className="photo-top">
          <PhotoView className="photo-preview" photo={pick} first={first} last={last} />
          <div className="photo-actions">
            <strong>{first} {last}</strong>
            <input ref={file} type="file" accept="image/*" className="sr-only" id="photo-file" tabIndex={-1} onChange={(e) => void onFile(e.target.files?.[0])} />
            <Button variant="secondary" size="sm" icon="upload" onClick={() => file.current?.click()} disabled={busy}>{busy ? 'Préparation…' : 'Importer une photo'}</Button>
            <small className="muted">Recadrée au centre et réduite à 256 px. Elle reste dans ton espace privé, avec ta progression.</small>
          </div>
        </div>
        {err && <p className="field-error" role="alert">{err}</p>}
        <fieldset className="photo-grid">
          <legend>Ou choisis un avatar</legend>
          {upload && (
            <label className={cx('photo-tile', pick.kind === 'image' && 'is-on')} title="Ma photo">
              <input type="radio" name="photo" checked={pick.kind === 'image'} onChange={() => setPick({ kind: 'image', src: upload })} />
              <img src={upload} alt="" /><span className="sr-only">Ma photo</span>
            </label>
          )}
          {AVATARS.map((a) => (
            <label key={a.id} className={cx('photo-tile', pick.kind === 'avatar' && pick.id === a.id && 'is-on')} title={a.label}>
              <input type="radio" name="photo" checked={pick.kind === 'avatar' && pick.id === a.id} onChange={() => setPick({ kind: 'avatar', id: a.id })} />
              <AvatarSvg id={a.id} /><span className="sr-only">Avatar : {a.label}</span>
            </label>
          ))}
          {INITIAL_COLORS.map((_, i) => (
            <label key={`i${i}`} className={cx('photo-tile', pick.kind === 'initials' && pick.color === i && 'is-on')} title="Initiales">
              <input type="radio" name="photo" checked={pick.kind === 'initials' && pick.color === i} onChange={() => setPick({ kind: 'initials', color: i })} />
              <InitialsSvg text={initialsOf(first, last)} color={i} /><span className="sr-only">Initiales {initialsOf(first, last)}, couleur {i + 1}</span>
            </label>
          ))}
        </fieldset>
      </div>
    </Dialog>
  );
}
