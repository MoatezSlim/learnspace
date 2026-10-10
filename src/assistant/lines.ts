// Everything Léa writes that can be prepared in advance. She does not speak aloud: her lines are
// typed out in her speech bubble while her face reacts.
import type { Lesson, Question } from '../types';
import { SKILL_LABEL } from '../data/courses';

export const LINES = {
  dashIntro: 'Tu progresses vraiment bien ! Il te suffit parfois de 10-15 min par jour pour atteindre tes objectifs de formation. 💙',
  hello: (name: string) => `Bonjour ${name} ! Prêt à continuer ton apprentissage ?`,
  recommend: (l: Lesson) => `Ta prochaine étape : ${SKILL_LABEL[l.skill].toLowerCase()}. Cela prend environ ${l.minutes} minutes.`,
  intro: {
    audio: 'Écoute bien l’enregistrement, puis réponds aux questions. Tu peux le réécouter autant que tu veux.',
    video: 'Regarde la vidéo avec les sous-titres, puis réponds aux questions.',
    reading: 'Prends le temps de lire le texte, puis réponds aux questions.',
    practice: 'Un petit entraînement : lis le rappel, puis réponds aux questions.',
    assessment: (pct: number) => `C’est l’évaluation du module : il faut ${pct} % de bonnes réponses du premier coup. Concentre-toi, tu es prêt.`,
  },
  correctMain: 'Exactement ! Tu as bien identifié l’idée principale.',
  correct: ['Exactement, c’est la bonne réponse !', 'Bien vu ! C’est correct.', 'Parfait, tu as trouvé.'],
  incorrectFirst: 'Pas tout à fait. Regardons un indice, puis réessayons ensemble.',
  incorrectReveal: 'Ce n’est pas grave. Voici la bonne réponse et son explication, puis on continue.',
  completePass: 'Bravo ! Tu viens de terminer cette leçon. Ta progression a été mise à jour.',
  completeBadge: (title: string) => `Bravo ! Tu viens de terminer cette leçon. Ta progression a été mise à jour. Et tu débloques le badge « ${title} ».`,
  completeFail: (pct: number) => `Tu y es presque. Il faut ${pct} % pour valider le module : revois les points clés, puis retente l’évaluation.`,
  hint: (q: Question) => `Voici un indice : ${q.hint}`,
  explainOk: (q: Question) => `Bonne réponse ! ${q.explanation}`,
  explainKo: (q: Question) => `Voici la correction. ${q.explanation}`,
  summary: (l: Lesson) => `L’essentiel de cette leçon : ${(l.content?.keyPoints ?? []).join(' ; ')}.`,
  noHintYet: 'Ouvre une leçon et je te donnerai des indices adaptés à chaque question, sans te donner la réponse.',
  review: 'Je te propose une révision express de six minutes sur les verbes irréguliers. C’est le meilleur moyen de consolider ce que tu as appris.',
  thanks: 'Avec plaisir ! Si tu as des questions, je suis là pour t’aider à tout moment. Tu assures ! 💪',
  allDone: 'Tu as terminé tout le contenu disponible pour le moment. Bravo !',
  voice: 'Je ne parle pas à voix haute : je t’écris ici, dans ma bulle, et mon visage te montre ce que j’en pense.',
  who: 'Je suis Léa, l’assistante virtuelle de LearnSpace. Je t’aide à comprendre tes leçons, à réviser et à choisir ta prochaine étape, en m’appuyant sur tes cours et ta progression.',
  mobile: 'LearnSpace s’adapte à ton téléphone : les mêmes pages, une barre d’onglets en bas avec moi au centre, et la même progression sur tous tes appareils quand la synchronisation est active.',
  unknown: 'Je n’ai pas de réponse préparée pour cette question en mode démo. Je peux te recommander ta prochaine leçon, résumer ton module, proposer une révision ou faire le point sur ta progression.',
  unknownLesson: 'Je n’ai pas de réponse préparée pour cette question en mode démo. Sur cette leçon, je peux te donner un indice, expliquer la correction ou résumer les points clés.',
  progressFail: 'Je n’arrive pas à lire ta progression pour le moment.',
};

/** Lines of the demanding coaching style (« Exigeante »): fewer compliments, more precise corrections. */
export const STRICT = {
  intro: 'Écoute, puis réponds sans regarder la transcription. Vise trois bonnes réponses du premier coup.',
  assessment: (pct: number) => `Évaluation du module : ${pct} % du premier coup, pas moins. Concentration.`,
  correct: ['Correct.', 'Juste. Suivante.', 'Bonne réponse. Garde ce rythme.'],
  incorrectFirst: 'Non. Relis l’indice et recommence.',
  incorrectReveal: 'Voici la correction. Note-la : elle reviendra à l’évaluation.',
  complete: (score: number, total: number) => score === total ? `Leçon validée : ${score}/${total}. Parfait, continue.` : `Leçon validée : ${score}/${total}. Vise ${total}/${total} la prochaine fois.`,
};

/** FNV-1a hash as 8 hex digits. */
export function hashText(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
