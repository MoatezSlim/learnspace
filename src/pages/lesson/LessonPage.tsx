import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Lesson, Question, Completion } from '../../types';
import { getLesson, getCourse, courseLessons, isPlayable, KIND_LABEL, SKILL_LABEL, PRACTICE_LESSONS } from '../../data/courses';
import { store, useLearner, LessonResult } from '../../state/store';
import { correctAnswerText, skillLevels, lessonPosition } from '../../state/selectors';
import { achievement } from '../../state/achievements';
import { navigate } from '../../router';
import { react, setLessonContext, ask } from '../../assistant/assistant';
import { avatar } from '../../assistant/controller';
import { Lea } from '../../assistant/Lea';
import { Bubble, openAssistant, StatusDot } from '../../assistant/AssistantPanels';
import { Button, Empty, ProgressBar, Ring, cx, toast } from '../../components/ui';
import { Icon } from '../../components/icons';
import { DialoguePlayer, VideoPlayer, ReadingCard } from './players';

type StepKind = { kind: 'media'; label: string } | { kind: 'question'; q: Question; n: number; label: string } | { kind: 'result'; label: string };

function stepsFor(l: Lesson): StepKind[] {
  const media = l.content?.video ? 'Vidéo' : l.content?.dialogue ? 'Écoute' : l.kind === 'practice' ? 'Rappel' : 'Lecture';
  return [{ kind: 'media', label: media }, ...(l.questions ?? []).map((q, i) => ({ kind: 'question' as const, q, n: i + 1, label: `Question ${i + 1}` })), { kind: 'result', label: 'Résultat' }];
}

const isDone = (answers: { value: string; correct: boolean }[] | undefined, revealed: boolean | undefined) =>
  !!answers?.length && (answers[answers.length - 1].correct || !!revealed || answers.length >= 2);

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
      <Empty icon="lock" title={`« ${lesson.title} » arrive bientôt`} action={<div className="row-gap"><Button variant="secondary" onClick={() => navigate({ page: 'course', courseId: c.id })}>Voir le cours</Button><Button onClick={() => navigate({ page: 'library' })}>Explorer la bibliothèque</Button></div>}>
        Le contenu de cette leçon n’est pas encore disponible dans cette démonstration. Les leçons jouables sont signalées dans chaque cours.
      </Empty>
    </div>
  );
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

  // start (or resume) the attempt
  useEffect(() => {
    const completed = store.state.completions[lesson.id];
    if (store.state.attempts[lesson.id] || !completed) { store.startLesson(lesson.id); void react.lessonStart(lesson); }
    avatar.setFocus(true);
    return () => { avatar.setFocus(false); store.logPartialTime(lesson.id); setLessonContext(undefined); };
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

  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, [step]);

  const go = (i: number) => { if (!attempt) return; store.setStep(lesson.id, Math.max(0, Math.min(steps.length - 1, i))); if (mobile) window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const finish = () => {
    const r = store.completeLesson(lesson.id);
    if (!r) return;
    setResult(r);
    void react.complete(lesson, r.completion.passed, r.newBadges);
    r.newBadges.forEach((b) => toast(`Badge obtenu : ${achievement(b).title}`, 'badge'));
  };

  const next = () => {
    if (cur.kind === 'media') { store.markMediaDone(lesson.id); go(step + 1); return; }
    if (cur.kind === 'question') { if (step + 1 === steps.length - 1) finish(); else go(step + 1); }
  };

  const progressPct = (step / (steps.length - 1)) * 100;
  const crumbs = (
    <nav className="crumbs" aria-label="Fil d’Ariane">
      <button type="button" className="crumb-back" aria-label="Retour" onClick={() => navigate(isPractice ? { page: 'home' } : { page: 'course', courseId: course.id })}><Icon name="arrowLeft" size={18} /></button>
      <ol>
        <li><button type="button" onClick={() => navigate({ page: 'course', courseId: course.id })}>{course.shortTitle}</button></li>
        {isPractice ? <li><span>Révision</span></li> : <li><button type="button" onClick={() => navigate({ page: 'course', courseId: course.id })}>Module {module?.index}</button></li>}
        {!isPractice && <li aria-current="page"><span>Leçon {lesson.index} sur {count}</span></li>}
      </ol>
    </nav>
  );

  const side = (
    <aside className="lesson-side" aria-label="Assistante et étapes">
      <div className="lesson-assistant card">
        <div className="lesson-stage"><Lea framing="bust" /></div>
        <div className="lesson-assistant-body">
          <div className="lesson-assistant-head"><strong>Léa</strong><StatusDot /></div>
          <Bubble fallback="Je suis là si tu as besoin d’un indice ou d’une explication." tail="top" className="lesson-bubble" />
          <div className="chips">
            <button type="button" className="chip" onClick={() => { openAssistant(true); void ask('Un indice, s’il te plaît'); }}>Un indice</button>
            <button type="button" className="chip" onClick={() => { openAssistant(true); void ask('Explique-moi la correction'); }}>Explique</button>
            <button type="button" className="chip" onClick={() => { openAssistant(true); void ask('Résume la leçon'); }}>Résume</button>
          </div>
        </div>
      </div>
      {!mobile && (
        <div className="card steps-card">
          <h2>Progression de la leçon</h2>
          <ol className="steps">
            {steps.map((st, i) => {
              const done = i < step || (st.kind === 'result' && !!result);
              const status = done ? 'Terminé' : i === step ? 'En cours' : 'À venir';
              return (
                <li key={i} className={cx('step', done && 'done', i === step && 'current')}>
                  <button type="button" disabled={!attempt || i > step || !!result} onClick={() => go(i)} aria-current={i === step ? 'step' : undefined}>
                    <span className="step-icon" aria-hidden="true">{done ? <Icon name="check" size={14} /> : st.kind === 'result' ? <Icon name="play" size={10} /> : st.kind === 'media' ? <Icon name={lesson.content?.video ? 'video' : lesson.content?.dialogue ? 'headphones' : 'text'} size={13} /> : <span>{(st as { n: number }).n}</span>}</span>
                    <span className="step-label">{st.label}</span>
                    <span className="step-status">{status}{done && <Icon name="check" size={12} />}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </aside>
  );

  if (review && !attempt && !result) {
    return (
      <div className="page lesson-page">
        <div className="lesson-main">
          {crumbs}
          <div className="card done-card">
            <Ring value={(review.score / review.total) * 100} size={96} stroke={9} color={review.passed ? 'var(--green)' : 'var(--amber)'} />
            <div>
              <span className="eyebrow">{review.passed ? 'Leçon terminée' : 'Évaluation à repasser'}</span>
              <h1>{lesson.title}</h1>
              <p className="muted">{review.score} / {review.total} bonnes réponses du premier coup · {review.minutes} min.</p>
              <div className="row-gap">
                <Button icon="replay" onClick={restart}>{review.passed ? 'Refaire la leçon' : 'Retenter'}</Button>
                <Button variant="secondary" onClick={() => navigate({ page: 'course', courseId: course.id })}>Voir le cours</Button>
              </div>
            </div>
          </div>
        </div>
        {side}
      </div>
    );
  }

  return (
    <div className={cx('page lesson-page', mobile && 'is-mobile')}>
      <div className="lesson-main">
        <div className="lesson-top">
          {crumbs}
          <span className="lesson-counter" aria-label={`Étape ${step + 1} sur ${steps.length}`}>{step + 1} / {steps.length}</span>
        </div>
        <ProgressBar value={progressPct} label="Progression dans la leçon" className="lesson-bar" />
        {mobile && side}

        {cur.kind !== 'result' && <LessonMedia lesson={lesson} compact={cur.kind === 'question'} />}

        <div className="lesson-heading">
          <h1 ref={headingRef} tabIndex={-1}>{cur.kind === 'result' ? 'Résultat de la leçon' : lesson.content?.heading}</h1>
          {cur.kind !== 'result' && <p className="muted" lang={lesson.content?.lang?.slice(0, 2)}>{lesson.content?.instructions}</p>}
        </div>

        {lesson.content?.dialogue && cur.kind !== 'result' && (
          <DialoguePlayer lines={lesson.content.dialogue} lang={lesson.content.lang} onEnded={() => store.markMediaDone(lesson.id)} />
        )}

        {cur.kind === 'media' && (
          <div className="card media-intro">
            <p><strong>{lesson.title}</strong> · {KIND_LABEL[lesson.kind]} · {lesson.minutes} min · {lesson.questions!.length} questions</p>
            <ul className="keypoints">{lesson.content?.keyPoints.map((k) => <li key={k}>{k}</li>)}</ul>
          </div>
        )}

        {cur.kind === 'question' && attempt && (
          <QuestionBlock key={cur.q.id} lesson={lesson} q={cur.q} n={cur.n} total={lesson.questions!.length} answers={attempt.answers[cur.q.id]} revealed={!!attempt.revealed[cur.q.id]} onNext={next} last={step + 1 === steps.length - 1} />
        )}

        {cur.kind === 'result' && result && <ResultBlock lesson={lesson} result={result} onRestart={restart} />}

        {cur.kind === 'media' && (
          <div className="lesson-nav">
            <Button variant="secondary" icon="chevronLeft" onClick={() => navigate(isPractice ? { page: 'home' } : { page: 'course', courseId: course.id })}>Précédent</Button>
            <Button iconRight="arrowRight" onClick={next}>{attempt?.mediaDone ? 'Commencer les questions' : 'Passer aux questions'}</Button>
          </div>
        )}
      </div>
      {!mobile && side}
    </div>
  );
}

function LessonMedia({ lesson, compact }: { lesson: Lesson; compact: boolean }) {
  const c = lesson.content!;
  if (c.video) return <VideoPlayer video={c.video} lang={c.lang} onEnded={() => store.markMediaDone(lesson.id)} />;
  if (c.image) return <figure className={cx('lesson-image', compact && 'compact')}><img src={c.image} alt={c.imageAlt ?? ''} /></figure>;
  if (c.reading) return <ReadingCard reading={c.reading} lang={c.lang} />;
  return null;
}

function QuestionBlock({ lesson, q, n, total, answers, revealed, onNext, last }: { lesson: Lesson; q: Question; n: number; total: number; answers?: { value: string; correct: boolean }[]; revealed: boolean; onNext: () => void; last: boolean }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const done = isDone(answers, revealed);
  const lastAns = answers?.[answers.length - 1];
  const retry = !!lastAns && !lastAns.correct && !done;
  const feedbackRef = useRef<HTMLDivElement>(null);
  const lang = lesson.content?.lang?.slice(0, 2);

  useEffect(() => { if (lastAns) feedbackRef.current?.focus({ preventScroll: false }); }, [answers?.length, revealed]);

  const submit = () => {
    if (!value.trim()) { setError(q.type === 'short' ? 'Écris une réponse avant de valider.' : 'Choisis une réponse avant de valider.'); return; }
    setError(null); avatar.interacted = true;
    const r = store.answer(lesson.id, q.id, value);
    if (r.correct) void react.correct(q.id, lesson); else void react.incorrect(r.attempt === 1);
    setValue('');
  };

  const shown = done ? lastAns?.value : value; // keep the learner's final answer visible
  const triedWrong = new Set((answers ?? []).filter((a) => !a.correct).map((a) => a.value));
  const optionState = (id: string) => {
    if (!done) return triedWrong.has(id) ? 'wrong' : value === id ? 'selected' : '';
    const correctId = q.type === 'mcq' ? q.answer : q.type === 'tf' ? String(q.answer) : '';
    if (id === correctId) return 'correct';
    if (id === lastAns?.value) return 'wrong';
    return 'muted';
  };
  const options = q.type === 'mcq' ? q.choices : q.type === 'tf' ? [{ id: 'true', text: 'Vrai' }, { id: 'false', text: 'Faux' }] : [];

  return (
    <section className="question" aria-labelledby={`q-${q.id}`}>
      <h2 id={`q-${q.id}`} className="q-prompt"><span className="q-num">{n}.</span> <span lang={q.type === 'short' && /[a-z]/i.test(q.prompt) && !/[éèàç]/.test(q.prompt) ? lang : undefined}>{q.prompt}</span><span className="sr-only"> (question {n} sur {total})</span></h2>
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
            value={done ? shown ?? '' : value} aria-invalid={!!error} aria-describedby={error ? `err-${q.id}` : undefined}
            className={cx(done && (lastAns?.correct ? 'is-correct' : 'is-wrong'))}
            onChange={(e) => { setValue(e.target.value); setError(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (!done) submit(); } }} />
        </div>
      )}
      {error && <p className="field-error" id={`err-${q.id}`} role="alert">{error}</p>}

      {lastAns && (
        <div ref={feedbackRef} tabIndex={-1} className={cx('feedback', lastAns.correct ? 'ok' : done ? 'reveal' : 'ko')} role="status">
          <div className="feedback-head">
            <Icon name={lastAns.correct ? 'check' : done ? 'info' : 'x'} size={18} />
            <strong>{lastAns.correct ? (answers!.length === 1 ? 'Bonne réponse !' : 'Bonne réponse, au deuxième essai.') : done ? `La bonne réponse : ${correctAnswerText(q)}` : 'Pas tout à fait.'}</strong>
          </div>
          {retry ? (
            <>
              <p><span className="feedback-label">Indice :</span> {q.hint}</p>
              <div className="row-gap"><span className="muted small">Choisis une autre réponse puis valide, ou</span><button type="button" className="link-inline" onClick={() => { store.reveal(lesson.id, q.id); void react.incorrect(false); }}>affiche la correction</button></div>
            </>
          ) : <p><span className="feedback-label">Explication :</span> {q.explanation}</p>}
        </div>
      )}

      <div className="lesson-nav">
        <Button variant="secondary" icon="chevronLeft" onClick={() => store.setStep(lesson.id, Math.max(0, (store.state.attempts[lesson.id]?.step ?? 1) - 1))}>Précédent</Button>
        {done
          ? <Button iconRight="arrowRight" onClick={onNext}>{last ? 'Voir le résultat' : 'Suivant'}</Button>
          : <Button iconRight="check" onClick={submit} aria-disabled={!value.trim()}>{retry ? 'Valider à nouveau' : 'Valider'}</Button>}
      </div>
    </section>
  );
}

function ResultBlock({ lesson, result, onRestart }: { lesson: Lesson; result: LessonResult; onRestart: () => void }) {
  const s = useLearner();
  const { completion: c, newBadges } = result;
  const course = getCourse(lesson.courseId)!;
  const p = Math.round((c.score / c.total) * 100);
  const lessons = courseLessons(course);
  const nextLesson = lessons.find((l) => !s.completions[l.id]?.passed && l.id !== lesson.id);
  const skill = skillLevels(s, course.id).find((x) => x.skill === lesson.skill);
  const isPractice = PRACTICE_LESSONS.some((x) => x.id === lesson.id);
  return (
    <section className="result" aria-live="polite">
      <div className="card result-hero">
        <Ring value={p} size={112} stroke={10} color={c.passed ? 'var(--green)' : 'var(--amber)'} label={`Score : ${p} %`} />
        <div>
          <span className={cx('pill', c.passed ? 'pill-green' : 'pill-amber')}>{c.passed ? (lesson.kind === 'assessment' ? 'Module validé' : 'Leçon terminée') : `Il faut ${Math.round((lesson.passMark ?? 0.7) * 100)} % pour valider`}</span>
          <h2>{c.score} / {c.total} {c.score > 1 ? "bonnes réponses" : "bonne réponse"} du premier coup</h2>
          <p className="muted">+{c.minutes} min ajoutée{c.minutes > 1 ? 's' : ''} à ton temps d’apprentissage aujourd’hui.{!isPractice && c.passed ? ' Ta progression a été mise à jour.' : ''}</p>
        </div>
      </div>
      <div className="result-grid">
        <div className="card">
          <h3>Tes réponses</h3>
          <ul className="answers">
            {lesson.questions!.map((q, i) => {
              const first = [...s.answerLog].reverse().find((a) => a.lessonId === lesson.id && a.questionId === q.id && a.attempt === 1);
              const ok = first?.correct;
              return <li key={q.id} className={ok ? 'ok' : 'ko'}><Icon name={ok ? 'check' : 'x'} size={16} /><span><strong>Question {i + 1}</strong> — {correctAnswerText(q)}</span></li>;
            })}
          </ul>
        </div>
        <div className="card">
          <h3>Ce que ça change</h3>
          {skill && !isPractice && <p><Icon name="star" size={16} /> {SKILL_LABEL[skill.skill]} : {skill.count} leçon{skill.count > 1 ? 's' : ''} · <strong>Niv. {skill.level}</strong>{skill.nextAt ? ` (niveau suivant à ${skill.nextAt})` : ''}</p>}
          {newBadges.length ? newBadges.map((b) => <p key={b} className="badge-line"><Icon name="medal" size={16} /> Nouveau badge : <strong>{achievement(b).title}</strong></p>) : <p className="muted">Aucun nouveau badge cette fois.</p>}
        </div>
      </div>
      <div className="lesson-nav">
        <Button variant="secondary" icon="replay" onClick={onRestart}>{c.passed ? 'Refaire' : 'Retenter l’évaluation'}</Button>
        {nextLesson && isPlayable(nextLesson) && c.passed && !isPractice
          ? <Button iconRight="arrowRight" onClick={() => navigate({ page: 'lesson', lessonId: nextLesson.id })}>Leçon suivante : {nextLesson.title}</Button>
          : <Button iconRight="arrowRight" onClick={() => navigate({ page: 'home' })}>Retour à l’accueil</Button>}
      </div>
    </section>
  );
}
