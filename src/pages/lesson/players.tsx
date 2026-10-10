import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { DialogueLine, LessonContent } from '../../types';
import { speakUtterance, stopSpeech, pauseSpeech, resumeSpeech, ttsSupported, pickVoice } from '../../assistant/speech';
import { avatar } from '../../assistant/controller';
import { lessonClip } from '../../assistant/lessonVoices';
import { Icon } from '../../components/icons';
import { IconButton, cx } from '../../components/ui';

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
const estimate = (text: string, rate: number) => (text.split(/\s+/).length / 2.55 + 0.45) / rate;

/**
 * Plays a lesson dialogue. Each line has a recording made offline with a neural British voice
 * (one voice per character); the browser's voices are only used if a recording is missing.
 * The transcript is always available.
 */
export function DialoguePlayer({ lines, lang = 'en-GB', onEnded }: { lines: DialogueLine[]; lang?: string; onEnded: () => void }) {
  const clips = useMemo(() => lines.map((l) => lessonClip(l.speaker, l.voice, l.text)), [lines]);
  const recorded = clips.every(Boolean);
  const [rate, setRate] = useState(1);
  const durations = useMemo(() => lines.map((l, i) => (clips[i]?.duration ?? estimate(l.text, 1)) / rate), [lines, clips, rate]);
  const total = durations.reduce((a, b) => a + b, 0);
  const starts = useMemo(() => durations.map((_, i) => durations.slice(0, i).reduce((a, b) => a + b, 0)), [durations]);
  const [state, setState] = useState<'stopped' | 'playing' | 'paused'>('stopped');
  const [line, setLine] = useState(-1);
  const [pos, setPos] = useState(0);
  const [muted, setMuted] = useState(false);
  const [showText, setShowText] = useState(!recorded && !ttsSupported);
  const [error, setError] = useState<string | null>(!recorded && !ttsSupported ? 'La synthèse vocale n’est pas disponible dans ce navigateur : lis la transcription ci-dessous.' : null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const run = useRef({ token: 0, lineStart: 0, pausedAt: 0, raf: 0 });
  const mutedRef = useRef(muted); mutedRef.current = muted;
  const stateRef = useRef(state); stateRef.current = state;
  const rateRef = useRef(rate); rateRef.current = rate;

  useEffect(() => () => {
    run.current.token++; cancelAnimationFrame(run.current.raf); stopSpeech();
    if (audio.current) { audio.current.pause(); audio.current.src = ''; }
    if (avatar.view.status === 'listening') avatar.setStatus('idle');
  }, []);

  const follow = (token: number, i: number, timed: boolean) => {
    if (token !== run.current.token) return;
    if (stateRef.current !== 'paused') {
      const elapsed = timed && audio.current ? audio.current.currentTime / rateRef.current : (performance.now() - run.current.lineStart) / 1000;
      setPos(Math.min(starts[i] + Math.min(elapsed, durations[i]), total));
    }
    run.current.raf = requestAnimationFrame(() => follow(token, i, timed));
  };

  const playFrom = (i: number) => {
    const token = ++run.current.token;
    cancelAnimationFrame(run.current.raf);
    avatar.stopSpeaking(); stopSpeech();
    if (audio.current) audio.current.pause();
    if (i >= lines.length) { setState('stopped'); setLine(-1); setPos(total); avatar.setStatus('idle'); onEnded(); return; }
    setState('playing'); setLine(i); setPos(starts[i]);
    avatar.setStatus('listening');
    const l = lines[i];
    const advance = () => { if (token === run.current.token) window.setTimeout(() => { if (token === run.current.token) playFrom(i + 1); }, 260); };
    const clip = clips[i];
    if (clip) {
      const a = audio.current ?? new Audio(); audio.current = a;
      a.onended = advance; a.onerror = null;
      a.src = clip.url; a.playbackRate = rateRef.current; a.muted = mutedRef.current;
      (a as any).preservesPitch = true;
      a.play().then(() => { if (token === run.current.token) follow(token, i, true); else a.pause(); }).catch((err: DOMException) => {
        if (token !== run.current.token || err?.name === 'AbortError') return;
        setError('Le navigateur a bloqué la lecture audio. Clique de nouveau sur lecture, ou lis la transcription.');
        setShowText(true); setState('stopped'); avatar.setStatus('idle');
      });
      return;
    }
    if (!ttsSupported || mutedRef.current) {
      run.current.lineStart = performance.now(); follow(token, i, false);
      window.setTimeout(advance, durations[i] * 1000);
      return;
    }
    if (!pickVoice(lang)) setError('Aucune voix anglaise n’est installée sur cet appareil : la lecture utilise la voix par défaut. La transcription reste disponible.');
    speakUtterance(l.text, {
      lang, variant: l.voice, rate: rateRef.current,
      onStart: () => { if (token !== run.current.token) return; run.current.lineStart = performance.now(); follow(token, i, false); },
      onEnd: (ok) => { cancelAnimationFrame(run.current.raf); if (ok) advance(); },
      onError: (code) => {
        if (code === 'not-allowed' || code === 'synthesis-unavailable' || code === 'unsupported') {
          setError('Le navigateur a bloqué la lecture audio. Lis la transcription, ou réessaie après avoir cliqué sur la page.');
          setShowText(true); setState('stopped'); avatar.setStatus('idle');
        }
      },
    });
  };

  const toggle = () => {
    avatar.interacted = true;
    const a = audio.current;
    if (state === 'playing') {
      setState('paused'); run.current.pausedAt = performance.now();
      if (a && clips[line]) a.pause(); else pauseSpeech();
      return;
    }
    if (state === 'paused') {
      run.current.lineStart += performance.now() - run.current.pausedAt; setState('playing');
      if (a && clips[line]) void a.play().catch(() => {}); else resumeSpeech();
      return;
    }
    playFrom(line >= 0 ? line : 0);
  };

  const seek = (e: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>) => {
    let frac: number;
    if ('clientX' in e) { const r = e.currentTarget.getBoundingClientRect(); frac = (e.clientX - r.left) / r.width; }
    else { if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return; e.preventDefault(); frac = (pos + (e.key === 'ArrowRight' ? 5 : -5)) / total; }
    const t = Math.max(0, Math.min(total - 0.01, frac * total));
    const i = starts.findIndex((s0, k) => t >= s0 && t < s0 + durations[k]);
    playFrom(Math.max(0, i));
  };

  const changeRate = () => {
    const r = rate === 1 ? 0.8 : 1; setRate(r);
    if (audio.current && clips[line] && state !== 'stopped') audio.current.playbackRate = r;
    else if (state !== 'stopped') { stopSpeech(); setState('stopped'); }
  };

  return (
    <div className="player">
      <div className="player-bar">
        <button type="button" className="play-btn" onClick={toggle} aria-label={state === 'playing' ? 'Mettre l’audio en pause' : 'Lire l’audio'}>
          <Icon name={state === 'playing' ? 'pause' : 'play'} size={20} />
        </button>
        <span className="player-time" aria-live="off">{fmt(pos)} / {fmt(total)}</span>
        <div className="player-track" role="slider" tabIndex={0} aria-label="Position dans l’audio" aria-valuemin={0} aria-valuemax={Math.round(total)} aria-valuenow={Math.round(pos)} aria-valuetext={`${fmt(pos)} sur ${fmt(total)}`}
          onClick={seek} onKeyDown={seek}>
          <span style={{ width: `${(pos / total) * 100}%` }} />
        </div>
        <button type="button" className="rate-btn" onClick={changeRate} aria-label={`Vitesse de lecture : ${rate === 1 ? 'normale' : 'ralentie'}`}>{rate === 1 ? '1×' : '0,8×'}</button>
        <IconButton icon={muted ? 'volumeOff' : 'volume'} label={muted ? 'Rétablir le son' : 'Couper le son'} aria-pressed={muted} onClick={() => { const m = !muted; setMuted(m); if (audio.current) audio.current.muted = m; }} />
      </div>
      <div className="player-foot">
        <button type="button" className="link-inline" aria-expanded={showText} onClick={() => setShowText(!showText)}>
          <Icon name="text" size={15} />{showText ? 'Masquer la transcription' : 'Afficher la transcription'}
        </button>
        <span className="muted small">{recorded ? 'Voix neuronales britanniques (enregistrement)' : 'Voix de synthèse du navigateur'}</span>
      </div>
      {error && <p className="player-error" role="status"><Icon name="info" size={15} />{error}</p>}
      {showText && (
        <ol className="transcript" aria-label="Transcription">
          {lines.map((l, i) => <li key={i} className={cx(i === line && state !== 'stopped' && 'current')}><strong>{l.speaker}</strong><span lang={lang}>{l.text}</span></li>)}
        </ol>
      )}
    </div>
  );
}

/** Video with on-page captions and optional spoken narration of each caption. */
export function VideoPlayer({ video, lang = 'en-GB', onEnded }: { video: NonNullable<LessonContent['video']>; lang?: string; onEnded: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [cue, setCue] = useState(-1);
  const [narration, setNarration] = useState(true);
  const [failed, setFailed] = useState(false);
  const spoken = useRef(-1);
  const narr = useRef<HTMLAudioElement | null>(null);
  const stopNarration = () => { stopSpeech(); if (narr.current) narr.current.pause(); };
  useEffect(() => () => { stopSpeech(); if (narr.current) { narr.current.pause(); narr.current.src = ''; } }, []);

  const onTime = () => {
    const t = ref.current?.currentTime ?? 0;
    const i = video.captions.findIndex((c) => t >= c.start && t < c.end);
    if (i !== cue) setCue(i);
    if (i >= 0 && i !== spoken.current && narration && !ref.current?.paused) {
      spoken.current = i; avatar.stopSpeaking();
      const clip = lessonClip('Narrator', 'a', video.captions[i].text);
      if (clip) {
        const a = narr.current ?? new Audio(); narr.current = a;
        a.src = clip.url; void a.play().catch(() => {});
      } else speakUtterance(video.captions[i].text, { lang, variant: 'a', rate: 1 });
    }
  };

  return (
    <div className="video">
      {failed ? <p className="player-error"><Icon name="alert" size={15} />La vidéo n’a pas pu être chargée. Les sous-titres ci-dessous contiennent tout le texte de la leçon.</p> : (
        <video ref={ref} poster={video.poster} controls playsInline muted preload="metadata"
          onTimeUpdate={onTime} onSeeked={() => { spoken.current = -1; stopNarration(); }} onPause={() => stopNarration()} onPlay={() => { avatar.interacted = true; avatar.setStatus('listening'); }}
          onEnded={() => { avatar.setStatus('idle'); onEnded(); }}>
          {video.webm && <source src={video.webm} type="video/webm" />}
          <source src={video.src} type="video/mp4" onError={() => setFailed(true)} />
        </video>
      )}
      <div className="video-caption" aria-live="polite" lang="en">{cue >= 0 ? video.captions[cue].text : <span className="muted">Les sous-titres s’affichent ici pendant la lecture.</span>}</div>
      <div className="player-foot">
        <label className="switch-inline"><input type="checkbox" checked={narration} onChange={(e) => { setNarration(e.target.checked); if (!e.target.checked) stopNarration(); }} /> Narration vocale</label>
        <details className="small"><summary>Transcription complète</summary><ol className="transcript">{video.captions.map((c, i) => <li key={i}><span lang="en">{c.text}</span></li>)}</ol></details>
      </div>
    </div>
  );
}

export function ReadingCard({ reading, lang }: { reading: NonNullable<LessonContent['reading']>; lang?: string }) {
  return (
    <article className="reading" lang={lang?.slice(0, 2)}>
      <h3>{reading.title}</h3>
      {reading.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
    </article>
  );
}
