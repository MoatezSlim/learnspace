// Domain model for LearnSpace. Content (courses, lessons, questions) is static demo data;
// everything the learner does lives in LearnerState and is persisted.

export type Level = 'debutant' | 'intermediaire' | 'avance';
export type CategoryId = 'langues' | 'business' | 'informatique' | 'devperso' | 'sciences' | 'art';
export type SkillId = 'listening' | 'vocabulary' | 'grammar' | 'speaking' | 'reading' | 'writing' | 'method' | 'culture';
export type LessonKind = 'audio' | 'video' | 'reading' | 'practice' | 'assessment';

export interface Choice { id: string; text: string }

export type Question =
  | { type: 'mcq'; id: string; prompt: string; choices: Choice[]; answer: string; hint: string; explanation: string }
  | { type: 'tf'; id: string; prompt: string; answer: boolean; hint: string; explanation: string }
  | { type: 'short'; id: string; prompt: string; accept: string[]; keywords?: string[]; placeholder?: string; hint: string; explanation: string; display: string };

export interface DialogueLine { speaker: string; voice: 'a' | 'b'; text: string }

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
  error?: boolean;
}

export type AssistantAction =
  | { kind: 'lesson'; lessonId: string; label: string }
  | { kind: 'page'; page: PageId; label: string }
  | { kind: 'ask'; text: string; label: string }
  | { kind: 'open'; target: 'newCourse' | 'payment'; label: string };

export interface AppNotification { id: string; at: string; title: string; body: string; read: boolean; kind: 'badge' | 'lesson' | 'streak' | 'info' | 'payment' }

/** Profile picture: an illustrated avatar, initials, or the learner's own photo (JPEG data URL, 256 px). */
export type ProfilePhoto = { kind: 'avatar'; id: string } | { kind: 'initials'; color: number } | { kind: 'image'; src: string };

export type PlanId = 'monthly' | 'yearly';
/** One payment of the subscription. Demo: no real payment is ever made. */
export interface Invoice { id: string; at: string; amount: number; plan: PlanId; from: string; to: string; method: string }
export interface Subscription { plan: PlanId; startedAt: string; paidUntil: string; invoices: Invoice[] }

export interface Prefs {
  voice: boolean;
  voiceURI: string;
  rate: number;
  motion: 'system' | 'reduced' | 'full';
  aiMode: 'live' | 'demo';
  /** desktop sidebar: full width or icons only */
  sidebar?: 'full' | 'rail';
}

export interface LearnerState {
  version: 1 | 2;
  profile: { firstName: string; lastName: string; dailyGoalMin: number; photo?: ProfilePhoto };
  prefs: Prefs;
  currentCourseId: string;
  enrollments: Record<string, { enrolledAt: string; lastActiveAt: string }>;
  completions: Record<string, Completion>;
  attempts: Record<string, LessonAttempt>;
  answerLog: AnswerRecord[];
  activity: Record<string, number>; // 'YYYY-MM-DD' -> minutes
  achievements: Record<string, string>; // id -> earnedAt
  conversation: ChatMessage[];
  assistantQuestions: number;
  notifications: AppNotification[];
  subscription: Subscription;
  seededAt: string;
  updatedAt: string;
}

export type PageId = 'home' | 'courses' | 'course' | 'library' | 'progress' | 'badges' | 'messages' | 'settings' | 'lesson' | 'subscription';
export interface Route { page: PageId; courseId?: string; lessonId?: string }
