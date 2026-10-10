// English recordings for lesson dialogues and video narration, synthesised offline with neural
// British voices (one voice per character). The browser's voices are only a fallback.
import manifestJson from '../lesson-voice.json';
import { COURSES, courseLessons, PRACTICE_LESSONS } from '../data/courses';
import { hashText } from './lines';

const MANIFEST = manifestJson as unknown as Record<string, number>;
export const SPEAKER_VOICE: Record<string, string> = { Announcer: 'bf_isabella', Emma: 'bf_emma', Tom: 'bm_george', Receptionist: 'bm_lewis', Narrator: 'bf_emma' };
export const voiceFor = (speaker: string, variant: 'a' | 'b' = 'a') => SPEAKER_VOICE[speaker] ?? (variant === 'b' ? 'bm_george' : 'bf_emma');
export const lessonKey = (voice: string, text: string) => hashText(`en|${voice}|${text}`);

export interface LessonClip { url: string; duration: number }
export function lessonClip(speaker: string, variant: 'a' | 'b', text: string): LessonClip | null {
  const key = lessonKey(voiceFor(speaker, variant), text);
  const d = MANIFEST[key];
  return d ? { url: `assets/voice/l_${key}.mp3`, duration: d } : null;
}

/** Every English line to record (used by the offline build). */
export function allLessonLines() {
  const out: { key: string; voice: string; text: string }[] = [];
  for (const l of [...COURSES.flatMap(courseLessons), ...PRACTICE_LESSONS]) {
    for (const d of l.content?.dialogue ?? []) { const voice = voiceFor(d.speaker, d.voice); out.push({ key: lessonKey(voice, d.text), voice, text: d.text }); }
    for (const c of l.content?.video?.captions ?? []) { const voice = voiceFor('Narrator'); out.push({ key: lessonKey(voice, c.text), voice, text: c.text }); }
  }
  return [...new Map(out.map((o) => [o.key, o])).values()];
}
