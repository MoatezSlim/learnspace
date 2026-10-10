// Browser speech: text-to-speech (Web Speech API) and optional speech recognition.
// Everything here is optional; callers fall back to text when it is unavailable.

export const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

let voices: SpeechSynthesisVoice[] = [];
const voiceListeners = new Set<() => void>();
function refreshVoices() {
  if (!ttsSupported) return;
  try { voices = window.speechSynthesis.getVoices(); } catch { voices = []; }
  voiceListeners.forEach((l) => l());
}
if (ttsSupported) {
  refreshVoices();
  try { window.speechSynthesis.addEventListener('voiceschanged', refreshVoices); } catch { /* old Safari */ }
}
export const getVoices = () => voices;
export const onVoices = (l: () => void) => { voiceListeners.add(l); return () => voiceListeners.delete(l); };

// Voice names that identify the speaker's gender on common systems (Windows/Edge, macOS/iOS, Chrome, Android).
const FEMALE_HINTS = ['amélie', 'amelie', 'audrey', 'aurélie', 'aurelie', 'marie', 'julie', 'denise', 'hortense', 'virginie', 'céline', 'celine', 'eloise', 'éloïse',
  'vivienne', 'brigitte', 'coralie', 'jacqueline', 'josephine', 'yvette', 'ariane', 'charline', 'sylvie', 'léa', 'chantal', 'female', 'femme', 'woman',
  'google français', 'google francais', 'fr-fr-x-frc', 'fr-fr-x-vlf', 'fr-fr-language',
  'serena', 'kate', 'libby', 'sonia', 'maisie', 'hazel', 'susan', 'moira', 'fiona', 'tessa', 'karen', 'samantha', 'google uk english female', 'mónica', 'paulina', 'anna', 'alice', 'helena', 'elsa', 'katja', 'isabella', 'elvira'];
const MALE_HINTS = ['daniel', 'thomas', 'nicolas', 'paul', 'henri', 'rémi', 'remi', 'jérôme', 'jerome', 'claude', 'fabrice', 'antoine', 'alain', 'yves', 'maxime', 'jean', 'gerard', 'gérard',
  'ryan', 'george', 'oliver', 'arthur', 'thomas', 'male', 'homme', 'man ', 'google uk english male', 'jorge', 'diego', 'luca', 'conrad', 'stefan', 'fr-fr-x-frd', 'fr-fr-x-fre'];
const isMale = (n: string) => MALE_HINTS.some((h) => n.includes(h)) && !n.includes('female');
const isFemale = (n: string) => FEMALE_HINTS.some((h) => n.includes(h));

/**
 * Best voice for a language. Variant `a` (Léa, narrators) only ever returns a female voice when
 * one is installed; variant `b` prefers a different, male-sounding voice for dialogue partners.
 */
export function pickVoice(lang: string, preferredURI = '', variant: 'a' | 'b' = 'a'): SpeechSynthesisVoice | null {
  if (!voices.length) refreshVoices();
  if (preferredURI) { const v = voices.find((x) => x.voiceURI === preferredURI); if (v) return v; }
  const base = lang.slice(0, 2).toLowerCase();
  const same = voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith(lang.toLowerCase()));
  let pool = same.length ? same : voices.filter((v) => v.lang.toLowerCase().startsWith(base));
  if (!pool.length) return null;
  if (variant === 'a') { const notMale = pool.filter((v) => !isMale(v.name.toLowerCase())); if (notMale.length) pool = notMale; }
  const score = (v: SpeechSynthesisVoice) => {
    const n = v.name.toLowerCase(); let s = 0;
    const female = isFemale(n), male = isMale(n);
    if (variant === 'a') s += female ? 6 : male ? -10 : 0; else s += male ? 4 : female ? -2 : 0;
    if (/natural|neural|online|premium|enhanced|wavenet/.test(n)) s += 3; // neural voices sound far more natural
    if (v.lang.toLowerCase().replace('_', '-') === lang.toLowerCase()) s += 1;
    return s;
  };
  return [...pool].sort((a, b) => score(b) - score(a))[0];
}

/** Female voices available for a language (for the settings menu). */
export function femaleVoices(langPrefix: string) {
  return voices.filter((v) => v.lang.toLowerCase().startsWith(langPrefix) && !isMale(v.name.toLowerCase()));
}

export function splitSentences(text: string): string[] {
  const out: string[] = []; let cur = '';
  for (let i = 0; i < text.length; i++) {
    cur += text[i];
    if (/[.!?…]/.test(text[i]) && (text[i + 1] === ' ' || text[i + 1] === '\n' || i === text.length - 1)) { out.push(cur.trim()); cur = ''; }
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(Boolean);
}

export interface SpeakOptions {
  lang: string;
  voiceURI?: string;
  variant?: 'a' | 'b';
  rate?: number;
  onStart?: () => void;
  onBoundary?: (charIndex: number) => void;
  onEnd?: (completed: boolean) => void;
  onError?: (code: string) => void;
}

let current: { cancelled: boolean } | null = null;
const opts_pitch = (o: SpeakOptions) => (o.variant === 'b' ? 0.95 : 1.04);

/** Speak one utterance. Resolves when it ends; errors are reported, never thrown. */
export function speakUtterance(text: string, o: SpeakOptions): { cancel: () => void } {
  const token = { cancelled: false };
  if (!ttsSupported) { o.onError?.('unsupported'); o.onEnd?.(false); return { cancel: () => {} }; }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = o.lang;
  const v = pickVoice(o.lang, o.voiceURI, o.variant);
  // Léa never speaks with a male voice or a voice of another language: without a suitable voice her
  // line stays on screen with a silent mouth animation
  if (o.variant === 'a' && voices.length && (!v || isMale(v.name.toLowerCase()))) { o.onError?.('no-voice'); o.onEnd?.(false); return { cancel: () => {} }; }
  if (v) u.voice = v;
  u.rate = o.rate ?? 1;
  u.pitch = opts_pitch(o);
  let ended = false;
  const finish = (ok: boolean) => { if (ended) return; ended = true; o.onEnd?.(ok && !token.cancelled); };
  u.onstart = () => { if (!token.cancelled) o.onStart?.(); };
  u.onboundary = (e) => { if (!token.cancelled && (e.name === 'word' || !e.name)) o.onBoundary?.(e.charIndex); };
  u.onend = () => finish(true);
  u.onerror = (e) => { const code = (e as SpeechSynthesisErrorEvent).error || 'error'; if (code !== 'interrupted' && code !== 'canceled') o.onError?.(code); finish(false); };
  current = token;
  try { window.speechSynthesis.speak(u); } catch { o.onError?.('error'); finish(false); }
  // Some engines never fire onstart when blocked; watchdog
  window.setTimeout(() => { if (!ended && !token.cancelled && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) { o.onError?.('not-allowed'); finish(false); } }, 1500);
  return { cancel: () => { token.cancelled = true; try { window.speechSynthesis.cancel(); } catch { /* ignore */ } finish(false); } };
}

export function stopSpeech() {
  if (current) current.cancelled = true;
  if (ttsSupported) { try { window.speechSynthesis.cancel(); } catch { /* ignore */ } }
}
export function pauseSpeech() { if (ttsSupported) try { window.speechSynthesis.pause(); } catch { /* ignore */ } }
export function resumeSpeech() { if (ttsSupported) try { window.speechSynthesis.resume(); } catch { /* ignore */ } }

// ---------------------------------------------------------------------------
// Speech recognition (voice input). Often unavailable inside sandboxed frames.
// ---------------------------------------------------------------------------
function micAllowed(): boolean {
  try {
    const fp = (document as any).permissionsPolicy || (document as any).featurePolicy;
    return fp && typeof fp.allowsFeature === 'function' ? fp.allowsFeature('microphone') : true;
  } catch { return true; }
}
/** Voice input needs the recognition API and microphone access in this frame. */
export const sttSupported = typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) && micAllowed();

export function listen(o: { lang: string; onText: (text: string, final: boolean) => void; onEnd: () => void; onError: (code: string) => void }) {
  const R = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!R) { o.onError('unsupported'); o.onEnd(); return { stop: () => {} }; }
  const rec = new R();
  rec.lang = o.lang; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
  rec.onresult = (e: any) => {
    let text = ''; let final = false;
    for (let i = 0; i < e.results.length; i++) { text += e.results[i][0].transcript; if (e.results[i].isFinal) final = true; }
    o.onText(text, final);
  };
  rec.onerror = (e: any) => o.onError(e.error || 'error');
  rec.onend = () => o.onEnd();
  try { rec.start(); } catch { o.onError('error'); o.onEnd(); }
  return { stop: () => { try { rec.stop(); } catch { /* ignore */ } } };
}
