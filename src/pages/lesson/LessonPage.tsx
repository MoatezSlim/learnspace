import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Lesson, Question, Completion, LearnerState, Route } from '../../types';
import { getLesson, getCourse, courseLessons, isPlayable, KIND_LABEL, SKILL_LABEL, PRACTICE_LESSONS } from '../../data/courses';
import { store, useLearner, LessonResult } from '../../state/store';
import { correctAnswerText, skillLevels, lessonPosition } from '../../state/selectors';
import { achievement } from '../../state/achievements';
import { navigate, useRoute } from '../../router';
import { react, setLessonContext } from '../../assistant/assistant';
import { avatar, useAvatar } from '../../assistant/controller';
import { Lea } from '../../assistant/Lea';
import { AskChips, registerRail } from '../../assistant/LeaDock';
import { Typed } from '../../assistant/AssistantPanels';
import { Button, Empty, ProgressBar, Ring, cx, toast, Medal, useMediaQuery } from '../../components/ui';
import { Icon, IconName } from '../../components/icons';
import { Check } from '../../components/charts';
import { useDialogue, AudioPlayer, Transcript, VideoPlayer, ReadingCard, DialogueApi } from './players';
import { BADGE_TONE } from '../Dashboard';

type StepKind = { kind: 'media'; label: string } | { kind: 'question'; q: Question; n: number; label: string } | { kind: 'result'; label: string };

export function stepsFor(l: Lesson): StepKind[] {
  const media = l.content?.video ? 'Regarder la vidéo' : l.content?.dialogue ? (l.content.dialogue.length > 3 ? 'Écouter le dialogue' : 'Écouter l’annonce') : l.kind === 'practice' ? 'Lire le rappel' : 'Lire le texte';
  return [{ kind: 'media', label: media }, ...(l.questions ?? []).map((q, i) => ({ kind: 'question' as const, q, n: i + 1, label: `Question ${i + 1}` })), { kind: 'result', label: 'Résultat' }];
}

const isDone = (answers: { value: string; correct: boolean }[] | undefined, revealed: boolean | undefined) =>
  !!answers?.length && (answers[answers.length - 1].correct || !!revealed || answers.length >= 2);

const TYPE_LABEL: Record<Question['type'], string> = { mcq: 'Choix multiple', tf: 'Vrai ou faux', short: 'Réponse courte' };
const MEDIA_ICON = (l: Lesson): IconName => (l.content?.video ? 'video' : l.content?.dialogue ? 'headphones' : 'text');

export function LessonPage({ lessonId, mobile }: { lessonId: string; mobile: boolean }) {
  const lesson = getLesson(lessonId);
  if (!lesson) return <div className="page"><Empty icon="alert" title="Leçon introuvable" action={<Button onClick={() => navigate({ page: 'home' })}>Retour à l’accueil</Button>} /></div>;
  if (!isPlayable(lesson)) return <NotPlayable lesson={lesson} />;
  return <LessonPlayer key={lesson.id} lesson={lesson} mobile={mobile} />;
}

function NotPlayable({ lesson }: { lesson: Lesson }) {
  const c = getCourse(lesson.courseId)!;
  return (
    <div className="page">
      <Empty icon="lock" title={`« ${lesson.title} » arrive bientôt`} action={<div className="row-gap"><Button variant="line" onClick={() => navigate({ page: 'course', courseId: c.id })}>Voir le cours</Button><Button onClick={() => navigate({ page: 'library' })}>Explorer la bibliothèque</Button></div>}>
        Le contenu de cette leçon n’est pas encore disponible dans cette démonstration. Les leçons jouables sont signalées dans chaque cours.
      </Empty>
    </div>
  );
}

/** Elapsed active time in the lesson, as « 04:12 ». */
function useTimer(lessonId: string, running: boolean) {
  const [, tick] = useState(0);
  useEffect(() => { if (!running) return; const id = window.setInterval(() => tick((x) => x + 1), 1000); return () => window.clearInterval(id); }, [running]);
  const start = useRef(performance.now()); const base = useRef(store.state.attempts[lessonId]?.activeMs ?? 0);
  const ms = base.current + (running ? performance.now() - start.current : 0);
  const sec = Math.floor(ms / 1000);
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}

function LessonPlayer({ lesson, mobile }: { lesson: Lesson; mobile: boolean }) {
  const s = useLearner();
  const steps = useMemo(() => stepsFor(lesson), [lesson]);
  const attempt = s.attempts[lesson.id];
  const [result, setResult] = useState<LessonResult | null>(null);
  const review: Completion | null = !attempt && !result ? s.completions[lesson.id] ?? null : null;
  const step = result ? steps.length - 1 : attempt?.step ?? 0;
  const cur = steps[step];
  const { course, module, count } = lessonPosition(lesson);
  const isPractice = PRACTICE_LESSONS.some((p) => p.id === lesson.id);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [transcript, setTranscript] = useState(true);
  const [translation, setTranslation] = useState(s.prefs.translate !== false);
  const timer = useTimer(lesson.id, !!attempt && !result);
  const back = () => navigate(isPractice ? { page: 'home' } : { page: 'course', courseId: course.id });

  // start (or resume) the attempt
  useEffect(() => {
    const completed = store.state.completions[lesson.id];
    if (store.state.attempts[lesson.id] || !completed) { store.startLesson(lesson.id); void react.lessonStart(lesson); }
    return () => { store.logPartialTime(lesson.id); setLessonContext(undefined); };
  }, [lesson]);
  const restart = () => { setResult(null); store.restartLesson(lesson.id); store.startLesson(lesson.id); void react.lessonStart(lesson); window.scrollTo({ top: 0 }); };

  // learning time: counted while the page is visible
  useEffect(() => {
    const id = window.setInterval(() => { if (!document.hidden && !result) store.addActiveTime(lesson.id, 5000); }, 5000);
    return () => window.clearInterval(id);
  }, [lesson.id, result]);

  // keep the assistant aware of the question on screen
  useEffect(() => {
    if (cur?.kind === 'question') {
      const ans = attempt?.answers[cur.q.id];
      setLessonContext({ lessonId: lesson.id, questionId: cur.q.id, answered: isDone(ans, attempt?.revealed[cur.q.id]), correct: ans?.[ans.length - 1]?.correct });
    } else setLessonContext({ lessonId: lesson.id });
  }, [cur, attempt, lesson.id]);

  useEffect(() => { if (step > 0) headingRef.current?.focus({ preventScroll: true }); }, [step]);

  const go = (i: number) => { if (!attempt) return; store.setStep(lesson.id, Math.max(0, Math.min(steps.length - 1, i))); if (mobile) window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const finish = () => {
    const r = store.completeLesson(lesson.id);
    if (!r) return;
    setResult(r);
    void react.complete(lesson, r.completion.passed, r.newBadges, { score: r.completion.score, total: r.completion.total });
    r.newBadges.forEach((b) => toast(`Badge obtenu : ${achievement(b).title}`, 'badge'));
  };
  const next = () => {
    if (cur.kind === 'media') { store.markMediaDone(lesson.id); go(step + 1); return; }
    if (cur.kind === 'question') { if (step + 1 === steps.length - 1) finish(); else go(step + 1); }
  };

  const dialogue = lesson.content?.dialogue;
  const api = useDialogue(dialogue ?? [], lesson.content?.lang, () => store.markMediaDone(lesson.id));
  const curAnswers = cur?.kind === 'question' ? attempt?.answers[cur.q.id] : undefined;
  const qNum = cur?.kind === 'question' ? cur.n : 0;
  const nq = lesson.questions!.length;
  const answered = lesson.questions!.filter((q) => isDone(attempt?.answers[q.id], attempt?.revealed[q.id])).length;
  const corrections = lesson.questions!.filter((q) => (attempt?.answers[q.id] ?? []).some((a) => !a.correct)).length;
  const phase = result || review ? 4 : cur.kind === 'media' ? 0 : curAnswers?.length ? 2 : 1;

  const question = cur.kind === 'question' && attempt
    ? <QuestionBlock key={cur.q.id} lesson={lesson} q={cur.q} n={cur.n} total={nq} answers={attempt.answers[cur.q.id]} revealed={!!attempt.revealed[cur.q.id]} onNext={next} last={step + 1 === steps.length - 1}
        onReplay={dialogue ? () => api.playFrom(0) : undefined} onPrev={() => go(step - 1)} mobile={mobile} translate={translation} />
    : null;

  // ---------------------------------------------------------------- phone
  if (mobile) {
    return (
      <div className="page lesson-m">
        <header className="lm-top">
          <button type="button" className="lm-x" onClick={back} aria-label="Quitter la leçon"><Icon name="x" size={20} /></button>
          <ProgressBar value={(step / (steps.length - 1)) * 100} tone="mint" label="Progression dans la leçon" />
          <span className="lm-count num" aria-label={`Étape ${step + 1} sur ${steps.length}`}>{step + 1} / {steps.length}</span>
        </header>
        {review ? <ReviewBlock lesson={lesson} review={review} onRestart={restart} onCourse={back} /> : <>
          {dialogue && cur.kind !== 'result' && <AudioPlayer api={api} lines={dialogue} compact={cur.kind === 'question'} transcript={transcript} onTranscript={() => setTranscript(!transcript)} translation={translation} onTranslation={() => setTranslation(!translation)} />}
          {cur.kind === 'media' && <>
            <div className="lm-head"><span className="eyebrow">{course.shortTitle} · {isPractice ? 'Révision' : `Module ${module?.index}`}</span><h1 ref={headingRef} tabIndex={-1}>{lesson.title}</h1><p className="muted" lang={lesson.content?.lang?.slice(0, 2)}>{lesson.content?.instructions}</p></div>
            {dialogue && transcript && <section className="card"><Transcript api={api} lines={dialogue} lang={lesson.content?.lang} translation={translation} /></section>}
            {!dialogue && <LessonMedia lesson={lesson} />}
            <KeyPoints lesson={lesson} />
            <div className="lm-sticky"><Button block go onClick={next}>{attempt?.mediaDone ? 'Commencer les questions' : 'Passer aux questions'}</Button></div>
          </>}
          {cur.kind === 'question' && <>
            {!dialogue && <LessonMedia lesson={lesson} compact />}
            {question}
          </>}
          {cur.kind === 'result' && result && <ResultBlock lesson={lesson} result={result} onRestart={restart} />}
        </>}
      </div>
    );
  }

  // ---------------------------------------------------------------- desktop
  return (
    <div className="page lesson">
      <header className="ls-head">
        <button type="button" className="ls-back" onClick={back} aria-label={isPractice ? 'Retour à l’accueil' : `Retour au cours ${course.shortTitle}`}><Icon name="arrowLeft" size={18} /></button>
        <nav className="crumbs" aria-label="Fil d’Ariane">
          <ol>
            <li><button type="button" onClick={() => navigate({ page: 'course', courseId: course.id })}>{course.shortTitle}</button></li>
            {isPractice ? <li><span>Révision</span></li> : <li><button type="button" onClick={() => navigate({ page: 'course', courseId: course.id })}>Module {module?.index}</button></li>}
            {!isPractice && <li aria-current="page"><span>Leçon {lesson.index} sur {count}</span></li>}
          </ol>
        </nav>
        <div className="ls-head-side">
          {attempt && !result && <span className="ls-timer" aria-label={`Temps passé : ${timer}`}><Icon name="clock" size={16} /><span className="num">{timer}</span></span>}
          <Button variant="line" size="sm" onClick={back}>Quitter la leçon</Button>
        </div>
      </header>
      <div className="ls-title">
        <h1 ref={headingRef} tabIndex={-1}>{lesson.title}</h1>
        <p className="lead"><span lang={lesson.content?.lang?.slice(0, 2)}>{lesson.content?.heading}</span> · {KIND_LABEL[lesson.kind]} · {lesson.minutes} min · {nq} questions</p>
      </div>
      <ol className="phases" aria-label="Étapes de la leçon">
        {[
          { icon: MEDIA_ICON(lesson), title: lesson.content?.video ? 'Regarder' : lesson.content?.dialogue ? 'Écouter' : 'Lire', sub: dialogue ? `${dialogue.length} réplique${dialogue.length > 1 ? 's' : ''}` : lesson.content?.video ? 'Vidéo sous-titrée' : 'Texte et rappel' },
          { icon: 'pencil' as IconName, title: 'Répondre', sub: phase >= 1 && phase < 4 ? `Question ${Math.max(1, qNum)} sur ${nq}` : `${nq} questions` },
          { icon: 'checkCircle' as IconName, title: 'Corriger', sub: corrections ? `${corrections} correction${corrections > 1 ? 's' : ''} vue${corrections > 1 ? 's' : ''}` : 'Indices et explications' },
          { icon: 'flag' as IconName, title: 'Terminer', sub: result ? `${result.completion.score} / ${result.completion.total} du premier coup` : review ? `${review.score} / ${review.total} du premier coup` : 'Résultat et badges' },
        ].map((p, i) => {
          const state = phase === 4 ? 'done'
            : i === 0 ? (phase >= 1 ? 'done' : 'current')
            : i === 1 ? (answered === nq ? 'done' : phase === 1 ? 'current' : phase === 2 ? 'active' : 'todo')
            : i === 2 ? (phase === 2 ? 'current' : 'todo')
            : 'todo';
          return (
            <li key={p.title} className={cx('phase', `is-${state}`)} aria-current={state === 'current' ? 'step' : undefined}>
              <span className="ph-ic"><Icon name={state === 'done' ? 'check' : p.icon} size={18} /></span>
              <span className="ph-body"><strong>{p.title}</strong><small>{p.sub}</small></span>
            </li>
          );
        })}
      </ol>
      {review ? (
        <div className="grid ls-grid"><div className="c12"><ReviewBlock lesson={lesson} review={review} onRestart={restart} onCourse={back} /></div></div>
      ) : (
        <div className="grid ls-grid">
          <div className="c7 ls-col">
            {dialogue ? (
              <>
                <AudioPlayer api={api} lines={dialogue} transcript={transcript} onTranscript={() => setTranscript(!transcript)} translation={translation} onTranslation={() => setTranslation(!translation)} />
                {transcript && <section className="card ls-transcript" aria-labelledby="tr-title"><div className="card-head"><h2 id="tr-title">Transcription</h2>{dialogue.some((d) => d.fr) && <span className="pill pill-blue"><Icon name="translate" size={13} />{translation ? 'Traduction affichée' : 'Traduction masquée'}</span>}</div><Transcript api={api} lines={dialogue} lang={lesson.content?.lang} translation={translation} /></section>}
              </>
            ) : <LessonMedia lesson={lesson} />}
            <VocabCard lesson={lesson} />
          </div>
          <div className="c5 ls-col">
            {cur.kind === 'media' && <IntroCard lesson={lesson} mediaDone={!!attempt?.mediaDone} onNext={next} api={dialogue ? api : null} />}
            {question}
            {cur.kind === 'result' && result && <ResultBlock lesson={lesson} result={result} onRestart={restart} />}
            <KeyPoints lesson={lesson} />
          </div>
        </div>
      )}
    </div>
  );
}

function LessonMedia({ lesson, compact }: { lesson: Lesson; compact?: boolean }) {
  const c = lesson.content!;
  if (c.video) return <section className={cx('card ls-video', compact && 'is-compact')}><VideoPlayer video={c.video} lang={c.lang} onEnded={() => store.markMediaDone(lesson.id)} /></section>;
  if (c.reading) return <ReadingCard reading={c.reading} lang={c.lang} />;
  if (c.image) return <figure className="ls-image"><img src={c.image} alt={c.imageAlt ?? ''} /></figure>;
  return null;
}

function IntroCard({ lesson, mediaDone, onNext, api }: { lesson: Lesson; mediaDone: boolean; onNext: () => void; api: DialogueApi | null }) {
  const qs = lesson.questions!;
  return (
    <section className="card q-card q-intro" aria-labelledby="intro-title">
      <span className="q-count">Avant de commencer</span>
      <h2 id="intro-title" className="q-prompt">{qs.length} questions t’attendent</h2>
      <p className="muted" lang={lesson.content?.lang?.slice(0, 2)}>{lesson.content?.instructions}</p>
      <ul className="intro-list">
        {qs.map((q, i) => <li key={q.id}><span className="intro-n num">{i + 1}</span><span>{TYPE_LABEL[q.type]}</span></li>)}
      </ul>
      <div className="q-actions">
        {api ? <button type="button" className="link" onClick={api.toggle}><Icon name={api.state === 'playing' ? 'pause' : 'headphones'} size={16} />{api.state === 'playing' ? 'Pause' : mediaDone ? 'Réécouter' : 'Écouter d’abord'}</button> : <span />}
        <Button go onClick={onNext}>{mediaDone ? 'Commencer les questions' : 'Passer aux questions'}</Button>
      </div>
    </section>
  );
}

function KeyPoints({ lesson }: { lesson: Lesson }) {
  const kp = lesson.content?.keyPoints ?? [];
  if (!kp.length) return null;
  return (
    <section className="card keypoints-card" aria-labelledby="kp-title">
      <div className="card-head"><h2 id="kp-title">Points clés</h2><span className="pill pill-violet"><Icon name="bulb" size={13} />{kp.length} à retenir</span></div>
      <ol className="keypoints">{kp.map((k, i) => <li key={k}><span className="kp-n num">{i + 1}</span><span>{k}</span></li>)}</ol>
    </section>
  );
}

function VocabCard({ lesson }: { lesson: Lesson }) {
  const v = lesson.content?.vocab ?? [];
  if (!v.length) return null;
  return (
    <section className="card vocab-card" aria-labelledby="vocab-title">
      <div className="card-head"><h2 id="vocab-title">Vocabulaire de la leçon</h2><span className="muted small">{v.length} mots et expressions</span></div>
      <ul className="vocab">
        {v.map((w) => (
          <li key={w.term}>
            <strong lang="en">{w.term}</strong>
            <span>{w.fr}</span>
            {w.ex && <em lang="en">{w.ex}</em>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function QuestionBlock({ lesson, q, n, total, answers, revealed, onNext, last, onReplay, onPrev, mobile, translate }: {
  lesson: Lesson; q: Question; n: number; total: number; answers?: { value: string; correct: boolean }[]; revealed: boolean; onNext: () => void; last: boolean;
  onReplay?: () => void; onPrev: () => void; mobile: boolean; translate: boolean;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const done = isDone(answers, revealed);
  const lastAns = answers?.[answers.length - 1];
  const retry = !!lastAns && !lastAns.correct && !done;
  const feedbackRef = useRef<HTMLDivElement>(null);
  const lang = lesson.content?.lang?.slice(0, 2);
  const v = useAvatar();
  const s = useLearner();
  const wide = useMediaQuery('(min-width: 1440px)');
  // Léa answers inside the feedback when she is not shown in the side panel (phone, floating bubble)
  const inlineLea = mobile || !(wide && (s.prefs.dock ?? 'panel') === 'panel');

  useEffect(() => { if (lastAns) feedbackRef.current?.focus({ preventScroll: !mobile }); }, [answers?.length, revealed]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    if (!value.trim()) { setError(q.type === 'short' ? 'Écris une réponse avant de valider.' : 'Choisis une réponse avant de valider.'); return; }
    setError(null); avatar.interacted = true;
    const r = store.answer(lesson.id, q.id, value);
    if (r.correct) void react.correct(q.id, lesson); else void react.incorrect(r.attempt === 1);
    setValue('');
  };

  const triedWrong = new Set((answers ?? []).filter((a) => !a.correct).map((a) => a.value));
  const optionState = (id: string) => {
    if (!done) return triedWrong.has(id) ? 'wrong' : value === id ? 'selected' : '';
    const correctId = q.type === 'mcq' ? q.answer : q.type === 'tf' ? String(q.answer) : '';
    if (id === correctId) return 'correct';
    if (id === lastAns?.value) return 'wrong';
    return 'muted';
  };
  const options = q.type === 'mcq' ? q.choices : q.type === 'tf' ? [{ id: 'true', text: 'Vrai' }, { id: 'false', text: 'Faux' }] : [];
  const promptLang = /[a-z]/i.test(q.prompt) && !/[éèàçù«»]/.test(q.prompt) ? lang : undefined;
  const okTitle = lastAns?.correct ? (answers!.length === 1 ? 'Bonne réponse !' : 'Bonne réponse, au deuxième essai.') : done ? `La bonne réponse : ${correctAnswerText(q)}` : 'Pas tout à fait.';
  const feedback = lastAns && (
    <div ref={feedbackRef} tabIndex={-1} className={cx('feedback', lastAns.correct ? 'ok' : done ? 'reveal' : 'ko')} role="status">
      {inlineLea && <span className="fb-lea"><Lea framing="face" decorative /></span>}
      <div className="fb-body">
        <div className="feedback-head"><Icon name={lastAns.correct ? 'checkCircle' : done ? 'info' : 'x'} size={19} /><strong>{mobile && lastAns.correct && answers!.length === 1 ? 'Bravo, c’est exact !' : okTitle}</strong></div>
        {retry ? (
          <>
            <p><span className="feedback-label">Indice :</span> {q.hint}</p>
            <p className="fb-more"><span className="muted">Choisis une autre réponse puis valide, ou</span> <button type="button" className="link" onClick={() => { store.reveal(lesson.id, q.id); void react.incorrect(false); }}>affiche la correction</button></p>
          </>
        ) : <p><span className="feedback-label">Explication :</span> {q.explanation}</p>}
        {inlineLea && v.bubble && <p className="fb-lea-line"><Typed text={v.bubble.text} at={v.bubble.at} /></p>}
      </div>
    </div>
  );
  const nextBtn = <Button go onClick={onNext} block={mobile}>{last ? 'Voir le résultat' : 'Question suivante'}</Button>;
  const validate = <Button onClick={submit} aria-disabled={!value.trim()} block={mobile} iconRight="check">{retry ? 'Valider à nouveau' : 'Valider'}</Button>;

  return (
    <section className={cx('card q-card', done && 'is-done')} aria-labelledby={`q-${q.id}`}>
      <div className="q-top"><span className="q-count">Question {n} sur {total}</span><span className="q-type">{TYPE_LABEL[q.type]}</span></div>
      <h2 id={`q-${q.id}`} className="q-prompt"><span lang={promptLang}>{q.prompt}</span><span className="sr-only"> (question {n} sur {total})</span></h2>
      {translate && q.fr && <p className="q-fr"><Icon name="translate" size={14} />{q.fr}</p>}
      {q.type !== 'short' ? (
        <div className="options" role="radiogroup" aria-labelledby={`q-${q.id}`}>
          {options.map((o, i) => {
            const st = optionState(o.id);
            return (
              <button key={o.id} type="button" role="radio" aria-checked={done ? o.id === lastAns?.value : value === o.id} disabled={done || triedWrong.has(o.id)}
                className={cx('option', st && `is-${st}`)} onClick={() => { setValue(o.id); setError(null); }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); const nx = options[(i + 1) % options.length]; setValue(nx.id); (e.currentTarget.nextElementSibling as HTMLElement | null)?.focus(); }
                  if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); const pv = options[(i - 1 + options.length) % options.length]; setValue(pv.id); (e.currentTarget.previousElementSibling as HTMLElement | null)?.focus(); }
                }}>
                <span className="opt-key" aria-hidden="true">{st === 'correct' ? <Icon name="check" size={14} /> : st === 'wrong' ? <Icon name="x" size={14} /> : q.type === 'tf' ? (i === 0 ? 'V' : 'F') : String.fromCharCode(65 + i)}</span>
                <span lang={q.type === 'mcq' ? lang : undefined}>{o.text}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="short">
          <label htmlFor={`a-${q.id}`} className="sr-only">Ta réponse</label>
          <input id={`a-${q.id}`} type="text" autoComplete="off" spellCheck={false} lang={lang} disabled={done} placeholder={q.placeholder ?? 'Écris ta réponse'}
            value={done ? lastAns?.value ?? '' : value} aria-invalid={!!error} aria-describedby={error ? `err-${q.id}` : undefined}
            className={cx('input', done && (lastAns?.correct ? 'is-correct' : 'is-wrong'))}
            onChange={(e) => { setValue(e.target.value); setError(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (!done) submit(); } }} />
        </div>
      )}
      {error && <p className="field-error" id={`err-${q.id}`} role="alert">{error}</p>}
      {!mobile && feedback}
      {!mobile && (
        <div className="q-actions">
          {onReplay ? <button type="button" className="link" onClick={onReplay}><Icon name="replay" size={16} />Réécouter le passage</button>
            : n > 1 ? <button type="button" className="link" onClick={onPrev}><Icon name="arrowLeft" size={16} />Question précédente</button> : <span />}
          {done ? nextBtn : validate}
        </div>
      )}
      {mobile && (
        <div className={cx('lm-sheet', lastAns && 'has-feedback', lastAns && (lastAns.correct ? 'ok' : done ? 'reveal' : 'ko'))}>
          {lastAns && <span className="lm-grip" aria-hidden="true" />}
          {feedback}
          {done ? nextBtn : validate}
        </div>
      )}
    </section>
  );
}

function ResultBlock({ lesson, result, onRestart }: { lesson: Lesson; result: LessonResult; onRestart: () => void }) {
  const s = useLearner();
  const { completion: c, newBadges } = result;
  const course = getCourse(lesson.courseId)!;
  const p = Math.round((c.score / c.total) * 100);
  const nextLesson = courseLessons(course).find((l) => !s.completions[l.id]?.passed && l.id !== lesson.id);
  const skill = skillLevels(s, course.id).find((x) => x.skill === lesson.skill);
  const isPractice = PRACTICE_LESSONS.some((x) => x.id === lesson.id);
  return (
    <section className="card result" aria-live="polite" aria-labelledby="result-title">
      <div className="result-top">
        <Ring value={p} size={104} stroke={10} color={c.passed ? 'var(--mint)' : 'var(--gold)'} track={c.passed ? 'var(--mint-50)' : 'var(--gold-50)'} label={`Score : ${p} %`}><strong className="num">{p}%</strong></Ring>
        <div>
          <span className={cx('pill', c.passed ? 'pill-mint' : 'pill-gold')}>{c.passed ? (lesson.kind === 'assessment' ? 'Module validé' : 'Leçon terminée') : `Il faut ${Math.round((lesson.passMark ?? 0.7) * 100)} % pour valider`}</span>
          <h2 id="result-title">{c.score} / {c.total} {c.score > 1 ? 'bonnes réponses' : 'bonne réponse'} du premier coup</h2>
          <p className="muted">+{c.minutes} min ajoutée{c.minutes > 1 ? 's' : ''} à ton temps d’apprentissage aujourd’hui.{!isPractice && c.passed ? ' Ta progression a été mise à jour.' : ''}</p>
        </div>
      </div>
      <ul className="answers">
        {lesson.questions!.map((q, i) => {
          const first = [...s.answerLog].reverse().find((a) => a.lessonId === lesson.id && a.questionId === q.id && a.attempt === 1);
          const ok = first?.correct;
          return <li key={q.id} className={ok ? 'ok' : 'ko'}><span className="ans-ic"><Icon name={ok ? 'check' : 'x'} size={14} /></span><span><strong>Question {i + 1}</strong> · {correctAnswerText(q)}</span></li>;
        })}
      </ul>
      <div className="result-gains">
        {skill && !isPractice && <p><Icon name="star" size={16} />{SKILL_LABEL[skill.skill]} : {skill.count} leçon{skill.count > 1 ? 's' : ''} · <strong>niveau {skill.level}</strong>{skill.nextAt ? ` (niveau suivant à ${skill.nextAt})` : ''}</p>}
        {newBadges.map((b) => <p key={b} className="badge-line"><Medal icon={achievement(b).icon} tone={BADGE_TONE[b]} size={30} />Nouveau badge : <strong>{achievement(b).title}</strong></p>)}
      </div>
      <div className="q-actions">
        <Button variant="line" icon="replay" onClick={onRestart}>{c.passed ? 'Refaire' : 'Retenter l’évaluation'}</Button>
        {nextLesson && isPlayable(nextLesson) && c.passed && !isPractice
          ? <Button go onClick={() => navigate({ page: 'lesson', lessonId: nextLesson.id })}>Leçon suivante</Button>
          : <Button go onClick={() => navigate({ page: 'home' })}>Accueil</Button>}
      </div>
    </section>
  );
}

function ReviewBlock({ lesson, review, onRestart, onCourse }: { lesson: Lesson; review: Completion; onRestart: () => void; onCourse: () => void }) {
  return (
    <section className="card result review">
      <div className="result-top">
        <Ring value={(review.score / review.total) * 100} size={96} stroke={9} color={review.passed ? 'var(--mint)' : 'var(--gold)'} track={review.passed ? 'var(--mint-50)' : 'var(--gold-50)'}><strong className="num">{Math.round((review.score / review.total) * 100)}%</strong></Ring>
        <div>
          <span className={cx('pill', review.passed ? 'pill-mint' : 'pill-gold')}>{review.passed ? 'Leçon terminée' : 'Évaluation à repasser'}</span>
          <h2>{lesson.title}</h2>
          <p className="muted">{review.score} / {review.total} bonnes réponses du premier coup · {review.minutes} min.</p>
        </div>
      </div>
      <div className="q-actions"><Button variant="line" onClick={onCourse}>Voir le cours</Button><Button icon="replay" onClick={onRestart}>{review.passed ? 'Refaire la leçon' : 'Retenter'}</Button></div>
    </section>
  );
}

// ---------------------------------------------------------------- Léa's panel during a lesson
function LessonRail({ route }: { route: Route }) {
  const s = useLearner();
  const r = useRoute();
  const lesson = getLesson(route.lessonId ?? '');
  if (!lesson || !isPlayable(lesson) || r.page !== 'lesson') return null;
  return <LessonChecklist s={s} lesson={lesson} />;
}
function LessonChecklist({ s, lesson }: { s: LearnerState; lesson: Lesson }) {
  const steps = stepsFor(lesson);
  const a = s.attempts[lesson.id];
  const done = s.completions[lesson.id];
  const step = a ? a.step : done ? steps.length : 0;
  return (
    <>
      <section className="rail-sec" aria-labelledby="lc-title">
        <div className="rail-sec-head"><h3 id="lc-title">Ta leçon</h3><span className="muted num">{Math.min(step, steps.length)} sur {steps.length}</span></div>
        <ol className="todo">
          {steps.map((st, i) => {
            const qa = st.kind === 'question' ? a?.answers[st.q.id] : undefined;
            const ok = i < step || (st.kind === 'question' && !!qa?.some((x) => x.correct));
            return (
              <li key={i} className={cx(ok && 'done', i === step && 'next')}>
                <button type="button" disabled={!a || i > step || i === steps.length - 1} onClick={() => a && store.setStep(lesson.id, i)}>
                  <Check on={ok} />
                  <span className="todo-body"><strong>{st.label}</strong><small>{st.kind === 'question' ? (qa?.length ? (qa[qa.length - 1].correct ? (qa.length === 1 ? 'Juste du premier coup' : 'Juste au deuxième essai') : 'À corriger') : TYPE_LABEL[st.q.type]) : st.kind === 'media' ? `${KIND_LABEL[lesson.kind]} · ${lesson.minutes} min` : 'Score et badges'}</small></span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>
      <AskChips items={['Un indice', 'Traduire la question', 'Résume la leçon']} icons={['bulb', 'translate', 'text']} />
    </>
  );
}
registerRail('lesson', LessonRail);
