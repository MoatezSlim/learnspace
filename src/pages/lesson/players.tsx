import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { DialogueLine, LessonContent } from '../../types';
import { speakUtterance, stopSpeech, pauseSpeech, resumeSpeech, ttsSupported, pickVoice } from '../../assistant/speech';
import { avatar } from '../../assistant/controller';
import { lessonClip } from '../../assistant/lessonVoices';
import { hashText } from '../../assistant/lines';
import { Icon } from '../../components/icons';
import { cx } from '../../components/ui';

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
const estimate = (text: string, rate: number) => (text.split(/\s+/).length / 2.55 + 0.45) / rate;
const SPEAKER_TONE = ['#2F6BFF', '#FF7A2F', '#16A472', '#6E63F2'];

/** Bars of the waveform, the same for a given dialogue. */
function waveform(lines: DialogueLine[], n: number) {
  let seed = parseInt(hashText(lines.map((l) => l.text).join('|')), 16) || 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  return Array.from({ length: n }, (_, i) => {
    const env = 0.55 + 0.45 * Math.sin((i / n) * Math.PI * 5.3 + 1.1) ** 2;
    return Math.max(0.16, Math.min(1, env * (0.35 + rnd() * 0.75)));
  });
}

export interface DialogueApi {
  state: 'stopped' | 'playing' | 'paused'; line: number; pos: number; total: number; starts: number[]; durations: number[];
  toggle: () => void; playFrom: (i: number) => void; back: () => void; rate: number; changeRate: () => void; muted: boolean; toggleMute: () => void;
  recorded: boolean; error: string | null; seekTo: (frac: number) => void;
}

/**
 * Plays a lesson dialogue. Each line has a recording made offline with a neural British voice (one voice
 * per character); the browser's voices are only used if a recording is missing.
 */
export function useDialogue(lines: DialogueLine[], lang = 'en-GB', onEnded: () => void): DialogueApi {
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
  const [error, setError] = useState<string | null>(!recorded && !ttsSupported ? 'La synthèse vocale n’est pas disponible dans ce navigateur : lis la transcription.' : null);
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
        setState('stopped'); avatar.setStatus('idle');
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
          setState('stopped'); avatar.setStatus('idle');
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
      avatar.setStatus('idle');
      return;
    }
    if (state === 'paused') {
      run.current.lineStart += performance.now() - run.current.pausedAt; setState('playing'); avatar.setStatus('listening');
      if (a && clips[line]) void a.play().catch(() => {}); else resumeSpeech();
      return;
    }
    playFrom(line >= 0 ? line : 0);
  };
  const lineAt = (t: number) => Math.max(0, starts.findIndex((s0, k) => t >= s0 && t < s0 + durations[k]));
  const seekTo = (frac: number) => playFrom(lineAt(Math.max(0, Math.min(total - 0.01, frac * total))));
  const back = () => playFrom(lineAt(Math.max(0, pos - 5)));
  const changeRate = () => {
    const r = rate === 1 ? 0.8 : 1; setRate(r);
    if (audio.current && clips[line] && state !== 'stopped') audio.current.playbackRate = r;
    else if (state !== 'stopped') { stopSpeech(); setState('stopped'); }
  };
  const toggleMute = () => { const m = !muted; setMuted(m); if (audio.current) audio.current.muted = m; };
  return { state, line, pos, total, starts, durations, toggle, playFrom, back, rate, changeRate, muted, toggleMute, recorded, error, seekTo };
}

/** Initials of the speakers (« E », « T »). */
export const speakerOf = (lines: DialogueLine[]) => [...new Map(lines.map((l) => [l.speaker, l.voice])).entries()].map(([name], i) => ({ name, initial: name[0], tone: SPEAKER_TONE[i % SPEAKER_TONE.length] }));

/** The dark audio player: speakers, play, waveform, time and tools. */
export function AudioPlayer({ api, lines, compact, transcript, onTranscript, translation, onTranslation }: {
  api: DialogueApi; lines: DialogueLine[]; compact?: boolean; transcript?: boolean; onTranscript?: () => void; translation?: boolean; onTranslation?: () => void;
}) {
  const bars = useMemo(() => waveform(lines, compact ? 34 : 64), [lines, compact]);
  const speakers = speakerOf(lines);
  const frac = api.total ? api.pos / api.total : 0;
  const onWave = (e: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>) => {
    if ('clientX' in e) { const r = e.currentTarget.getBoundingClientRect(); api.seekTo((e.clientX - r.left) / r.width); return; }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); api.seekTo((api.pos + (e.key === 'ArrowRight' ? 5 : -5)) / api.total); }
  };
  return (
    <div className={cx('player', compact && 'is-compact', api.state === 'playing' && 'is-playing')}>
      {!compact && (
        <div className="player-top">
          <span className="speakers" aria-hidden="true">{speakers.map((sp) => <i key={sp.name} style={{ background: sp.tone }}>{sp.initial}</i>)}</span>
          <span className="player-who"><strong>{speakers.map((x) => x.name).join(' & ')}</strong><small>{lines.length > 1 ? `Dialogue · ${lines.length} répliques` : 'Annonce'} · {api.recorded ? 'voix enregistrées' : 'voix de synthèse'}</small></span>
          <button type="button" className="player-rate" onClick={api.changeRate} aria-label={`Vitesse de lecture : ${api.rate === 1 ? 'normale' : 'ralentie'}`}>{api.rate === 1 ? '1×' : '0,8×'}</button>
        </div>
      )}
      <div className="player-main">
        <button type="button" className="play-btn" onClick={api.toggle} aria-label={api.state === 'playing' ? 'Mettre l’audio en pause' : 'Lire l’audio'}>
          <Icon name={api.state === 'playing' ? 'pause' : 'play'} size={compact ? 18 : 22} />
        </button>
        <div className="wave" role="slider" tabIndex={0} aria-label="Position dans l’audio" aria-valuemin={0} aria-valuemax={Math.round(api.total)} aria-valuenow={Math.round(api.pos)}
          aria-valuetext={`${fmt(api.pos)} sur ${fmt(api.total)}`} onClick={onWave} onKeyDown={onWave}>
          {bars.map((h, i) => <i key={i} className={cx(i / bars.length < frac && 'on')} style={{ height: `${Math.round(h * 100)}%` }} />)}
        </div>
        <span className="player-time" aria-live="off">{compact ? fmt(Math.max(0, api.total - api.pos)) : `${fmt(api.pos)} / ${fmt(api.total)}`}</span>
      </div>
      {!compact && (
        <div className="player-tools">
          <button type="button" onClick={api.back} disabled={api.pos < 0.5}><Icon name="rewind" size={17} />Revenir 5 s</button>
          {onTranscript && <button type="button" aria-pressed={!!transcript} className={cx(transcript && 'on')} onClick={onTranscript}><Icon name="text" size={17} />Transcription</button>}
          {onTranslation && <button type="button" aria-pressed={!!translation} className={cx(translation && 'on')} onClick={onTranslation}><Icon name="translate" size={17} />Traduction</button>}
          <button type="button" className="player-mute" aria-pressed={api.muted} aria-label={api.muted ? 'Rétablir le son' : 'Couper le son'} onClick={api.toggleMute}><Icon name={api.muted ? 'volumeOff' : 'volume'} size={18} /></button>
        </div>
      )}
      {api.error && <p className="player-error" role="status"><Icon name="info" size={15} />{api.error}</p>}
    </div>
  );
}

/** Transcript with the line being heard highlighted, and its French translation. */
export function Transcript({ api, lines, lang, translation }: { api: DialogueApi; lines: DialogueLine[]; lang?: string; translation: boolean }) {
  const speakers = speakerOf(lines);
  const tone = (n: string) => speakers.find((x) => x.name === n)?.tone ?? SPEAKER_TONE[0];
  return (
    <ol className="transcript" aria-label="Transcription">
      {lines.map((l, i) => (
        <li key={i} className={cx(i === api.line && api.state !== 'stopped' && 'current')}>
          <button type="button" onClick={() => api.playFrom(i)} aria-label={`Écouter à partir de la réplique ${i + 1}`}>
            <i className="tr-who" style={{ background: tone(l.speaker) }} aria-hidden="true">{l.speaker[0]}</i>
            <span className="tr-body">
              <strong>{l.speaker}</strong>
              <span lang={lang?.slice(0, 2)}>{l.text}</span>
              {translation && l.fr && <em>{l.fr}</em>}
            </span>
            <span className="tr-time num">{fmt(api.starts[i] ?? 0)}</span>
          </button>
        </li>
      ))}
    </ol>
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
          onTimeUpdate={onTime} onSeeked={() => { spoken.current = -1; stopNarration(); }} onPause={() => { stopNarration(); avatar.setStatus('idle'); }} onPlay={() => { avatar.interacted = true; avatar.setStatus('listening'); }}
          onEnded={() => { avatar.setStatus('idle'); onEnded(); }}>
          {video.webm && <source src={video.webm} type="video/webm" />}
          <source src={video.src} type="video/mp4" onError={() => setFailed(true)} />
        </video>
      )}
      <div className="video-caption" aria-live="polite" lang="en">{cue >= 0 ? video.captions[cue].text : <span>Les sous-titres s’affichent ici pendant la lecture.</span>}</div>
      <label className="video-narr"><input type="checkbox" checked={narration} onChange={(e) => { setNarration(e.target.checked); if (!e.target.checked) stopNarration(); }} /> Narration des sous-titres</label>
    </div>
  );
}

export function ReadingCard({ reading, lang }: { reading: NonNullable<LessonContent['reading']>; lang?: string }) {
  return (
    <article className="card reading" lang={lang?.slice(0, 2)}>
      <h3>{reading.title}</h3>
      {reading.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
    </article>
  );
}
