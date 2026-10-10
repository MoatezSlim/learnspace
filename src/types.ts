// Domain model for LearnSpace. Content (courses, lessons, questions) is static demo data;
// everything the learner does lives in LearnerState and is persisted.

export type Level = 'debutant' | 'intermediaire' | 'avance';
export type CategoryId = 'langues' | 'business' | 'informatique' | 'devperso' | 'sciences' | 'art';
export type SkillId = 'listening' | 'vocabulary' | 'grammar' | 'speaking' | 'reading' | 'writing' | 'method' | 'culture';
export type LessonKind = 'audio' | 'video' | 'reading' | 'practice' | 'assessment';

export interface Choice { id: string; text: string }

/** `fr`: French translation of the prompt (questions written in another language) */
export type Question =
  | { type: 'mcq'; id: string; prompt: string; choices: Choice[]; answer: string; hint: string; explanation: string; fr?: string }
  | { type: 'tf'; id: string; prompt: string; answer: boolean; hint: string; explanation: string; fr?: string }
  | { type: 'short'; id: string; prompt: string; accept: string[]; keywords?: string[]; placeholder?: string; hint: string; explanation: string; display: string; fr?: string };

export interface DialogueLine { speaker: string; voice: 'a' | 'b'; text: string; /** French translation shown under the line */ fr?: string }
/** A word or expression taught by a lesson */
export interface VocabItem { term: string; fr: string; ex?: string }

export interface LessonContent {
  /** Activity heading shown above the instructions, e.g. "Listen and answer" */
  heading: string;
  /** Short instruction shown under the title, e.g. "Listen to the audio and choose the correct answer." */
  instructions: string;
  /** Language spoken in audio/video, used to pick a synthetic voice */
  lang?: string;
  image?: string;
  imageAlt?: string;
  dialogue?: DialogueLine[];
  video?: { src: string; webm?: string; poster: string; captions: { start: number; end: number; text: string }[] };
  reading?: { title: string; paragraphs: string[]; source?: string };
  /** Key notions the assistant can explain or summarise */
  keyPoints: string[];
  /** Words and expressions of the lesson (vocabulary card, word of the day) */
  vocab?: VocabItem[];
}

export interface Lesson {
  id: string;
  courseId: string;
  moduleId: string;
  index: number; // 1-based inside module
  title: string;
  kind: LessonKind;
  minutes: number;
  skill: SkillId;
  content?: LessonContent;
  questions?: Question[];
  /** assessments must reach this share of correct first answers to count as completed */
  passMark?: number;
}

export interface Module { id: string; courseId: string; index: number; title: string; lessons: Lesson[]; competencies: Competency[] }
export interface Competency { id: string; label: string; lessonIds: string[] }

export type Cover =
  | { kind: 'photo'; src: string; position?: string }
  | { kind: 'art'; motif: 'skyline-ru' | 'skyline-fr' | 'skyline-es' | 'skyline-de' | 'skyline-it' | 'pitch' | 'negotiation' | 'code' | 'data' | 'focus' | 'climate' | 'painting' | 'cinema'; tone: string };

export interface Course {
  id: string;
  title: string;
  shortTitle: string;
  category: CategoryId;
  level: Level;
  cefr?: string;
  flag?: 'gb' | 'es' | 'fr' | 'de' | 'it' | 'ru';
  description: string;
  hours: number;
  popularity: number;
  cover: Cover;
  modules: Module[];
  /** What the learner will be able to do at the end */
  outcomes?: string[];
  /** catalogue badge */
  tag?: 'new';
}

export interface AnswerRecord {
  lessonId: string;
  questionId: string;
  value: string;
  correct: boolean;
  attempt: number;
  at: string;
}

export interface LessonAttempt {
  step: number;
  /** per question: answers given in order (first one counts for the score) */
  answers: Record<string, { value: string; correct: boolean }[]>;
  revealed: Record<string, boolean>;
  startedAt: string;
  activeMs: number;
  mediaDone: boolean;
}

export interface Completion { at: string; score: number; total: number; minutes: number; passed: boolean }

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: string;
  source?: 'live' | 'demo' | 'system';
  actions?: AssistantAction[];
  /** rich content under Léa's answer */
  card?: ChatCard;
  error?: boolean;
}

export type ChatCard =
  | { kind: 'course'; courseId: string }
  | { kind: 'words'; items: { term: string; ex: string; fr: string }[] }
  | { kind: 'lesson'; lessonId: string };

/** An earlier conversation with Léa, kept when a new one starts */
export interface ChatThread { id: string; title: string; at: string; messages: ChatMessage[] }

export type AssistantAction =
  | { kind: 'lesson'; lessonId: string; label: string }
  | { kind: 'page'; page: PageId; label: string; courseId?: string }
  | { kind: 'ask'; text: string; label: string }
  | { kind: 'open'; target: 'newCourse' | 'payment'; label: string }
  | { kind: 'pause'; courseId: string; label: string }
  | { kind: 'remind'; at: string; title: string; label: string };

export interface AppNotification { id: string; at: string; title: string; body: string; read: boolean; kind: 'badge' | 'lesson' | 'streak' | 'info' | 'payment' }

/** Profile picture: an illustrated avatar, initials, or the learner's own photo (JPEG data URL, 256 px). */
export type ProfilePhoto = { kind: 'avatar'; id: string } | { kind: 'initials'; color: number } | { kind: 'image'; src: string };

export type PlanId = 'monthly' | 'yearly';
/** One payment of the subscription. Demo: no real payment is ever made. */
export interface Invoice { id: string; at: string; amount: number; plan: PlanId; from: string; to: string; method: string }
export interface Subscription { plan: PlanId; startedAt: string; paidUntil: string; invoices: Invoice[] }

export type CoachStyle = 'encourage' | 'strict' | 'discreet';
export interface Prefs {
  voice: boolean;
  voiceURI: string;
  rate: number;
  /** Léa's animations: system setting, full, reduced (no head moves, text shown at once) or none (still picture) */
  motion: 'system' | 'reduced' | 'full' | 'none';
  aiMode: 'live' | 'demo';
  /** desktop sidebar: full width or icons only */
  sidebar?: 'full' | 'rail';
  /** desktop: Léa in a panel on the right, or in a floating bubble */
  dock?: 'panel' | 'bubble';
  /** how Léa talks to the learner */
  coach?: CoachStyle;
  /** show French translations (lesson transcripts, Léa's word cards) */
  translate?: boolean;
  /** in-app reminders */
  notify?: { daily: boolean; weekly: boolean; newCourses: boolean };
  /** last time the learner opened the conversation (unread count in the menu) */
  chatSeenAt?: string;
}

/** A reminder the learner asked for; it becomes a notification on its day */
export interface Reminder { id: string; at: string; title: string; body: string }

export interface LearnerState {
  version: 1 | 2;
  profile: { firstName: string; lastName: string; dailyGoalMin: number; photo?: ProfilePhoto; /** what the learner wants to achieve, in their words */ goal?: string };
  prefs: Prefs;
  currentCourseId: string;
  enrollments: Record<string, { enrolledAt: string; lastActiveAt: string; paused?: boolean }>;
  completions: Record<string, Completion>;
  attempts: Record<string, LessonAttempt>;
  answerLog: AnswerRecord[];
  activity: Record<string, number>; // 'YYYY-MM-DD' -> minutes
  achievements: Record<string, string>; // id -> earnedAt
  conversation: ChatMessage[];
  /** earlier conversations */
  chats?: ChatThread[];
  assistantQuestions: number;
  reminders?: Reminder[];
  /** keys of automatic notifications already sent (daily reminder, weekly summary) */
  sentNotes?: string[];
  notifications: AppNotification[];
  subscription: Subscription;
  seededAt: string;
  updatedAt: string;
}

export type PageId = 'home' | 'courses' | 'course' | 'library' | 'progress' | 'badges' | 'messages' | 'settings' | 'lesson' | 'subscription';
export interface Route { page: PageId; courseId?: string; lessonId?: string }
