import type { Course, Lesson, LessonContent, Module, Question, Competency, LessonKind, SkillId, CategoryId } from '../types';

// ---------------------------------------------------------------------------
// Helpers to build modules. Lessons without `content`/`questions` are part of the
// catalogue (titles, durations, progress) but have no playable demo content.
// ---------------------------------------------------------------------------
type LessonSpec = Partial<Lesson> & { title: string; kind?: LessonKind; skill?: SkillId; minutes?: number };

function mod(courseId: string, index: number, title: string, specs: LessonSpec[], comps?: { label: string; lessons: number[] }[]): Module {
  const id = `${courseId}-m${index}`;
  const lessons: Lesson[] = specs.map((s, i) => ({
    kind: 'reading',
    skill: 'vocabulary',
    minutes: 10,
    ...s,
    id: `${id}-l${i + 1}`,
    courseId,
    moduleId: id,
    index: i + 1,
  }) as Lesson);
  const competencies: Competency[] = (comps ?? [{ label: title, lessons: lessons.map((_, i) => i + 1) }]).map((c, ci) => ({
    id: `${id}-c${ci + 1}`,
    label: c.label,
    lessonIds: c.lessons.map((n) => `${id}-l${n}`),
  }));
  return { id, courseId, index, title, lessons, competencies };
}

const q = {
  mcq: (id: string, prompt: string, choices: string[], correctIndex: number, hint: string, explanation: string, fr?: string): Question => ({
    type: 'mcq', id, prompt, hint, explanation, fr,
    choices: choices.map((text, i) => ({ id: String.fromCharCode(97 + i), text })),
    answer: String.fromCharCode(97 + correctIndex),
  }),
  tf: (id: string, prompt: string, answer: boolean, hint: string, explanation: string, fr?: string): Question => ({ type: 'tf', id, prompt, answer, hint, explanation, fr }),
  short: (id: string, prompt: string, accept: string[], display: string, hint: string, explanation: string, extra: { placeholder?: string; keywords?: string[]; fr?: string } = {}): Question =>
    ({ type: 'short', id, prompt, accept, display, hint, explanation, ...extra } as Question),
};

const IMG = {
  london: 'assets/media/lesson_london.webp',
  video: 'assets/media/lesson_video.mp4',
  poster: 'assets/media/lesson_video_poster.webp',
};

// ---------------------------------------------------------------------------
// ANGLAIS — the learner's current path (35 lessons, module 4 fully playable)
// ---------------------------------------------------------------------------
const EN = 'en-b1';
const en: Course = {
  id: EN,
  title: 'Anglais – Niveau intermédiaire',
  shortTitle: 'Anglais',
  category: 'langues',
  level: 'intermediaire',
  cefr: 'B1',
  flag: 'gb',
  description: 'Comprendre des conversations du quotidien, voyager en autonomie et donner ton avis avec nuance.',
  hours: 28,
  popularity: 98,
  cover: { kind: 'photo', src: 'assets/media/course_en_hd.webp', position: '62% 50%' },
  outcomes: [
    'Suivre une conversation courante à vitesse naturelle',
    'Raconter un voyage ou une expérience au passé',
    'Donner ton avis et le justifier avec des exemples',
    'Présenter un projet en 3 minutes devant un public',
  ],
  modules: [
    mod(EN, 1, 'Se présenter et échanger', [
      { title: 'Greetings and introductions', skill: 'vocabulary' },
      { title: 'Talking about your job', skill: 'vocabulary' },
      { title: 'The present simple', skill: 'grammar', kind: 'practice' },
      { title: 'Small talk at work', skill: 'listening', kind: 'audio' },
      { title: 'Asking questions politely', skill: 'grammar', kind: 'practice' },
      { title: 'Phone conversations', skill: 'listening', kind: 'audio' },
      { title: 'Introducing a colleague', skill: 'speaking', kind: 'practice' },
      { title: 'Évaluation du module 1', skill: 'listening', kind: 'assessment', minutes: 15 },
    ], [{ label: 'Se présenter', lessons: [1, 2, 3, 4] }, { label: 'Poser des questions simples', lessons: [5, 6, 7, 8] }]),
    mod(EN, 2, 'Vie quotidienne et habitudes', [
      { title: 'Daily routines', skill: 'vocabulary' },
      { title: 'Adverbs of frequency', skill: 'grammar', kind: 'practice' },
      { title: 'A day in London', skill: 'listening', kind: 'audio' },
      { title: 'Food and shopping', skill: 'vocabulary' },
      { title: 'Describing your home', skill: 'speaking', kind: 'practice' },
      { title: 'The present continuous', skill: 'grammar', kind: 'practice' },
      { title: 'Hobbies and free time', skill: 'vocabulary' },
      { title: 'Évaluation du module 2', skill: 'vocabulary', kind: 'assessment', minutes: 15 },
    ], [{ label: 'Décrire sa routine', lessons: [1, 2, 3, 4] }, { label: 'Parler de ses goûts', lessons: [5, 6, 7, 8] }]),
    mod(EN, 3, 'Raconter une expérience', [
      { title: 'The past simple', skill: 'grammar', kind: 'practice' },
      { title: 'Travel memories', skill: 'vocabulary' },
      { title: 'A weekend away', skill: 'listening', kind: 'audio' },
      { title: 'Irregular verbs', skill: 'grammar', kind: 'practice' },
      { title: 'Telling a story', skill: 'speaking', kind: 'practice' },
      { title: 'Podcast: a memorable trip', skill: 'listening', kind: 'audio' },
      { title: 'Évaluation du module 3', skill: 'speaking', kind: 'assessment', minutes: 15 },
    ], [{ label: 'Utiliser le prétérit', lessons: [1, 2, 3, 4] }, { label: 'Raconter un souvenir', lessons: [5, 6, 7] }]),
    mod(EN, 4, 'Compréhension orale', [
      {
        title: 'Airport announcements', kind: 'audio', skill: 'listening', minutes: 8,
        content: {
          heading: 'Listen and answer',
          instructions: 'Listen to the boarding announcement and answer the questions.',
          lang: 'en-GB', image: IMG.london, imageAlt: 'Palais de Westminster et Big Ben au bord de la Tamise',
          dialogue: [
            { speaker: 'Announcer', voice: 'a', text: 'Good morning, ladies and gentlemen. This is a boarding announcement for flight BA 1462 to Edinburgh.', fr: 'Bonjour mesdames et messieurs. Ceci est une annonce d’embarquement pour le vol BA 1462 à destination d’Édimbourg.' },
            { speaker: 'Announcer', voice: 'a', text: 'Boarding will begin at gate twenty-three in ten minutes. Passengers travelling with young children are invited to board first.', fr: 'L’embarquement commencera porte vingt-trois dans dix minutes. Les passagers voyageant avec de jeunes enfants sont invités à embarquer en premier.' },
            { speaker: 'Announcer', voice: 'a', text: 'Please have your boarding pass and passport ready. We apologise for the short delay, which is due to bad weather in Scotland.', fr: 'Merci de préparer votre carte d’embarquement et votre passeport. Nous nous excusons pour ce léger retard, dû au mauvais temps en Écosse.' },
          ],
          keyPoints: ['Boarding / gate / boarding pass : le vocabulaire de l’embarquement', 'Twenty-three vs thirteen : l’accent tonique distingue -ty et -teen', '« Due to » introduit une cause (= à cause de)'],
          vocab: [
            { term: 'boarding pass', fr: 'carte d’embarquement', ex: 'Please have your boarding pass ready.' },
            { term: 'gate', fr: 'porte (d’embarquement)', ex: 'Boarding will begin at gate 23.' },
            { term: 'delay', fr: 'retard', ex: 'We apologise for the short delay.' },
            { term: 'due to', fr: 'à cause de, dû à', ex: 'The delay is due to bad weather.' },
          ],
        },
        questions: [
          q.mcq('q1', 'Where is the flight going?', ['Dublin', 'Edinburgh', 'Glasgow', 'Manchester'], 1,
            'La destination est annoncée juste après le numéro du vol.', 'L’annonce dit « flight BA 1462 to Edinburgh ».', 'Où va ce vol ?'),
          q.tf('q2', 'Boarding starts at gate 13.', false,
            'Écoute bien la fin du nombre : -teen ou -ty ?', 'C’est la porte twenty-three (23). « ThirTEEN » est accentué à la fin, « TWENty » au début.', 'L’embarquement commence porte 13.'),
          q.short('q3', 'Why is the flight delayed? (one or two words)', ['bad weather', 'weather', 'the weather', 'because of bad weather', 'due to bad weather', 'because of the weather'], 'bad weather',
            'Écoute la dernière phrase : « …which is due to … ».', '« We apologise for the short delay, which is due to bad weather in Scotland. »', { keywords: ['weather'], fr: 'Pourquoi le vol est-il retardé ? (un ou deux mots)' }),
        ],
      },
      {
        title: 'Planning a weekend trip', kind: 'audio', skill: 'listening', minutes: 10,
        content: {
          heading: 'Listen and answer',
          instructions: 'Listen to the audio and choose the correct answer.',
          lang: 'en-GB', image: IMG.london, imageAlt: 'Palais de Westminster et Big Ben au bord de la Tamise',
          dialogue: [
            { speaker: 'Emma', voice: 'a', text: 'Hi Tom! Have you decided where we’re going for the long weekend?', fr: 'Salut Tom ! Tu as décidé où on part pour le long week-end ?' },
            { speaker: 'Tom', voice: 'b', text: 'I think so. What about Edinburgh? We could take the train on Friday morning.', fr: 'Je crois que oui. Que dirais-tu d’Édimbourg ? On pourrait prendre le train vendredi matin.' },
            { speaker: 'Emma', voice: 'a', text: 'Great idea! How long is the journey from London?', fr: 'Bonne idée ! Combien de temps dure le trajet depuis Londres ?' },
            { speaker: 'Tom', voice: 'b', text: 'About four and a half hours. And if we book today, the tickets are much cheaper.', fr: 'Environ quatre heures et demie. Et si on réserve aujourd’hui, les billets sont bien moins chers.' },
            { speaker: 'Emma', voice: 'a', text: 'Perfect. I’ll look for a small hotel near the castle.', fr: 'Parfait. Je vais chercher un petit hôtel près du château.' },
            { speaker: 'Tom', voice: 'b', text: 'Good. The Saturday museum tour fills up quickly, so let’s book it tonight.', fr: 'Bien. La visite du musée du samedi est vite complète, alors réservons-la ce soir.' },
          ],
          keyPoints: ['Long weekend, journey, to book, to fill up : le vocabulaire du voyage', '« How long is the journey? » sert à demander la durée d’un trajet', '« I’ll + verbe » exprime une décision prise au moment où l’on parle'],
          vocab: [
            { term: 'journey', fr: 'trajet, voyage', ex: 'How long is the journey from London?' },
            { term: 'to book', fr: 'réserver', ex: 'If we book today, the tickets are cheaper.' },
            { term: 'to fill up', fr: 'se remplir, être vite complet', ex: 'The museum tour fills up quickly.' },
            { term: 'long weekend', fr: 'pont, week-end prolongé', ex: 'Where are we going for the long weekend?' },
          ],
        },
        questions: [
          q.mcq('q1', 'What is the main topic of the conversation?', ['A travel plan', 'A job interview', 'A restaurant', 'A school project'], 0,
            'Demande-toi ce qu’Emma et Tom organisent ensemble pour le week-end.', 'Emma et Tom organisent un long week-end à Édimbourg : transport, hôtel et visite de musée. C’est un projet de voyage.', 'Quel est le sujet principal de la conversation ?'),
          q.tf('q2', 'The train journey from London to Edinburgh takes about four and a half hours.', true,
            'Écoute la réponse de Tom à la question « How long is the journey? ».', 'Tom répond « About four and a half hours », soit environ 4 h 30.', 'Le trajet en train de Londres à Édimbourg dure environ quatre heures et demie.'),
          q.short('q3', 'When will they book the museum tour? (one word)', ['tonight', 'this evening', 'tonight they will book it'], 'tonight',
            'Écoute la dernière phrase de Tom : « …so let’s book it … ».', 'Tom dit « let’s book it tonight », car la visite du samedi est vite complète.', { keywords: ['tonight'], placeholder: 'Écris ta réponse en anglais', fr: 'Quand vont-ils réserver la visite du musée ? (un mot)' }),
        ],
      },
      {
        title: 'London landmarks', kind: 'video', skill: 'listening', minutes: 8,
        content: {
          heading: 'Watch and answer',
          instructions: 'Watch the video with captions, then answer the questions.',
          lang: 'en-GB',
          video: {
            src: IMG.video, webm: 'assets/media/lesson_video.webm', poster: IMG.poster,
            captions: [
              { start: 0, end: 5.5, text: 'Welcome to London! Let’s learn some words to describe famous places.' },
              { start: 5.5, end: 12, text: 'This tall clock tower is Big Ben. It is one of London’s most famous landmarks.' },
              { start: 12, end: 18, text: 'Westminster Bridge crosses the River Thames.' },
              { start: 18, end: 24, text: 'The Houses of Parliament stand right next to the river.' },
            ],
          },
          keyPoints: ['A landmark : un lieu ou monument célèbre, facile à reconnaître', 'To cross : traverser · next to : à côté de', 'Clock tower : tour de l’horloge'],
          vocab: [
            { term: 'landmark', fr: 'monument, lieu emblématique', ex: 'Big Ben is a famous landmark.' },
            { term: 'to cross', fr: 'traverser', ex: 'Westminster Bridge crosses the River Thames.' },
            { term: 'next to', fr: 'à côté de', ex: 'Parliament stands right next to the river.' },
            { term: 'clock tower', fr: 'tour de l’horloge', ex: 'This tall clock tower is Big Ben.' },
          ],
        },
        questions: [
          q.mcq('q1', 'In the video, what is a “landmark”?', ['A famous building or place that is easy to recognise', 'A map of the city', 'A type of bridge', 'A tourist ticket'], 0,
            'Big Ben est présenté comme « one of London’s most famous … ».', 'A landmark est un lieu ou monument très connu, comme Big Ben.', 'Dans la vidéo, qu’est-ce qu’un « landmark » ?'),
          q.mcq('q2', 'What does Westminster Bridge cross?', ['The River Thames', 'The Seine', 'A canal', 'A motorway'], 0,
            'Regarde le troisième sous-titre.', '« Westminster Bridge crosses the River Thames. »', 'Que traverse le pont de Westminster ?'),
          q.tf('q3', 'The Houses of Parliament are far from the river.', false,
            'Écoute la dernière phrase : « right next to … ».', 'Ils se trouvent « right next to the river », juste au bord de la Tamise.', 'Le Parlement est loin du fleuve.'),
        ],
      },
      {
        title: 'A postcard from Edinburgh', kind: 'reading', skill: 'reading', minutes: 10,
        content: {
          heading: 'Read and answer',
          instructions: 'Read Emma’s postcard and answer the questions.',
          lang: 'en-GB',
          reading: {
            title: 'Dear Grandma,',
            paragraphs: [
              'Greetings from Edinburgh! Tom and I arrived on Friday afternoon after a long but beautiful train journey along the coast.',
              'Our hotel is tiny, but it’s only five minutes from the castle, so we walked there first thing on Saturday morning. The view over the city was amazing, even in the rain.',
              'In the afternoon we took the museum tour we had booked. Our guide was funny and explained the history of the old town. I bought you a small book about Scottish castles.',
              'We’re taking the train back on Monday. See you soon! Love, Emma',
            ],
          },
          keyPoints: ['First thing in the morning : à la première heure', 'Even in the rain : même sous la pluie', 'Le prétérit (arrived, walked, took, bought) raconte le séjour'],
          vocab: [
            { term: 'first thing', fr: 'à la première heure', ex: 'We walked there first thing on Saturday.' },
            { term: 'even in the rain', fr: 'même sous la pluie', ex: 'The view was amazing, even in the rain.' },
            { term: 'tiny', fr: 'minuscule', ex: 'Our hotel is tiny.' },
            { term: 'to take the train back', fr: 'rentrer en train', ex: 'We’re taking the train back on Monday.' },
          ],
        },
        questions: [
          q.mcq('q1', 'How did Emma and Tom travel to Edinburgh?', ['By train', 'By plane', 'By car', 'By bus'], 0,
            'Relis la première phrase de la carte.', '« …after a long but beautiful train journey along the coast. »', 'Comment Emma et Tom sont-ils allés à Édimbourg ?'),
          q.tf('q2', 'It was sunny when they visited the castle.', false,
            'Cherche la phrase qui parle de la vue sur la ville.', 'La vue était magnifique « even in the rain » : il pleuvait.', 'Il faisait beau quand ils ont visité le château.'),
          q.short('q3', 'What did Emma buy for her grandmother? (2–3 words)', ['a book', 'a small book', 'book', 'small book', 'a small book about scottish castles', 'a book about scottish castles', 'a book about castles'], 'a small book (about Scottish castles)',
            'Cherche le verbe « bought ».', '« I bought you a small book about Scottish castles. »', { keywords: ['book'], fr: 'Qu’a acheté Emma pour sa grand-mère ? (2 ou 3 mots)' }),
        ],
      },
      {
        title: 'Évaluation du module 4', kind: 'assessment', skill: 'listening', minutes: 15, passMark: 0.7,
        content: {
          heading: 'Module assessment',
          instructions: 'Listen to the conversation at the hotel reception, then answer the five questions. You need 70 % to validate the module.',
          lang: 'en-GB',
          dialogue: [
            { speaker: 'Receptionist', voice: 'b', text: 'Good evening, welcome to the Royal Mile Hotel. How can I help you?', fr: 'Bonsoir, bienvenue au Royal Mile Hotel. Que puis-je faire pour vous ?' },
            { speaker: 'Emma', voice: 'a', text: 'Hello, we have a reservation for two nights. The name is Emma Clarke.', fr: 'Bonjour, nous avons une réservation pour deux nuits. Au nom d’Emma Clarke.' },
            { speaker: 'Receptionist', voice: 'b', text: 'Thank you, Ms Clarke. You’re in room two one four, on the second floor. Breakfast is served from seven to ten.', fr: 'Merci, madame Clarke. Vous êtes chambre deux cent quatorze, au deuxième étage. Le petit-déjeuner est servi de sept à dix heures.' },
            { speaker: 'Emma', voice: 'a', text: 'Lovely. Is there a lift?', fr: 'Parfait. Y a-t-il un ascenseur ?' },
            { speaker: 'Receptionist', voice: 'b', text: 'Yes, just behind you, next to the stairs. And here’s a map of the old town.', fr: 'Oui, juste derrière vous, à côté de l’escalier. Et voici un plan de la vieille ville.' },
          ],
          keyPoints: ['Reservation, floor, lift : le vocabulaire de l’hôtel', 'Les nombres de chambre se lisent chiffre par chiffre : two one four', '« From seven to ten » indique une plage horaire'],
          vocab: [
            { term: 'reservation', fr: 'réservation', ex: 'We have a reservation for two nights.' },
            { term: 'floor', fr: 'étage', ex: 'Your room is on the second floor.' },
            { term: 'lift', fr: 'ascenseur (GB)', ex: 'Is there a lift?' },
            { term: 'stairs', fr: 'escalier', ex: 'The lift is next to the stairs.' },
          ],
        },
        questions: [
          q.mcq('q1', 'How many nights will Emma stay?', ['One', 'Two', 'Three', 'Four'], 1, 'Écoute la première réplique d’Emma.', '« We have a reservation for two nights. »', 'Combien de nuits Emma va-t-elle rester ?'),
          q.short('q2', 'What is Emma’s room number? (digits)', ['214', 'two one four', 'two hundred and fourteen'], '214', 'Le numéro est lu chiffre par chiffre.', '« You’re in room two one four » : chambre 214.', { fr: 'Quel est le numéro de chambre d’Emma ? (en chiffres)' }),
          q.tf('q3', 'Breakfast is served until eleven.', false, 'Écoute la plage horaire du petit-déjeuner.', 'Le petit-déjeuner est servi « from seven to ten », de 7 h à 10 h.', 'Le petit-déjeuner est servi jusqu’à onze heures.'),
          q.mcq('q4', 'Where is the lift?', ['Behind Emma, next to the stairs', 'On the second floor', 'Next to the restaurant', 'There is no lift'], 0, 'Écoute la réponse à « Is there a lift? ».', '« Yes, just behind you, next to the stairs. »', 'Où se trouve l’ascenseur ?'),
          q.mcq('q5', 'In this module, what does “to book” mean?', ['Réserver', 'Lire', 'Annuler', 'Payer'], 0, 'Pense à « book the tickets » dans la leçon 2.', '« To book » signifie réserver : to book a ticket, to book a tour.', 'Dans ce module, que signifie « to book » ?'),
        ],
      },
    ], [{ label: 'Comprendre une conversation de voyage', lessons: [1, 2, 3] }, { label: 'Repérer des informations clés', lessons: [4, 5] }]),
    mod(EN, 5, 'Exprimer son opinion', [
      {
        title: 'Agreeing and disagreeing', kind: 'practice', skill: 'speaking', minutes: 10,
        content: {
          heading: 'Choose the right expression',
          instructions: 'Read the useful expressions, then choose the most natural answer for each situation.',
          lang: 'en-GB',
          reading: {
            title: 'Useful expressions',
            paragraphs: [
              'To agree: “I totally agree.” · “That’s a good point.” · “Exactly!”',
              'To partly agree: “I see what you mean, but…” · “That’s true, however…”',
              'To disagree politely: “I’m not so sure about that.” · “I see it differently.”',
            ],
          },
          keyPoints: ['Accord total : I totally agree / Exactly', 'Accord partiel : I see what you mean, but…', 'Désaccord poli : I’m not so sure about that'],
          vocab: [
            { term: 'I totally agree', fr: 'je suis tout à fait d’accord', ex: 'I totally agree, remote work saves time.' },
            { term: 'I see what you mean, but…', fr: 'je vois ce que tu veux dire, mais…', ex: 'I see what you mean, but it’s expensive.' },
            { term: 'I’m not so sure about that', fr: 'je n’en suis pas si sûr', ex: 'I’m not so sure about that idea.' },
          ],
        },
        questions: [
          q.mcq('q1', 'Your colleague says: “Remote work saves a lot of time.” You fully agree. What do you say?', ['I totally agree.', 'I’m not so sure about that.', 'I see it differently.', 'That’s true, however…'], 0,
            'Cherche l’expression d’accord total.', '« I totally agree » exprime un accord complet.', 'Ton collègue dit que le télétravail fait gagner beaucoup de temps. Tu es entièrement d’accord : que réponds-tu ?'),
          q.mcq('q2', 'Which sentence is a polite way to disagree?', ['I’m not so sure about that.', 'You’re wrong.', 'No way.', 'That’s stupid.'], 0,
            'Le désaccord poli reste nuancé.', '« I’m not so sure about that » exprime un désaccord sans brusquer l’autre.', 'Quelle phrase permet d’exprimer poliment un désaccord ?'),
          q.tf('q3', '“I see what you mean, but…” shows partial agreement.', true,
            'Le « but » annonce une réserve.', 'On reconnaît le point de vue de l’autre avant d’apporter une nuance : c’est un accord partiel.', '« I see what you mean, but… » exprime un accord partiel.'),
        ],
      },
      { title: 'Giving reasons', skill: 'grammar', kind: 'practice' },
      { title: 'Debate: city or countryside?', skill: 'listening', kind: 'audio' },
      { title: 'Évaluation du module 5', skill: 'speaking', kind: 'assessment', minutes: 15 },
    ], [{ label: 'Donner son avis', lessons: [1, 2] }, { label: 'Nuancer et argumenter', lessons: [3, 4] }]),
    mod(EN, 6, 'Projet final', [
      { title: 'Preparing a short talk', skill: 'speaking', kind: 'practice' },
      { title: 'Useful phrases for presentations', skill: 'vocabulary' },
      { title: 'Présentation finale', skill: 'speaking', kind: 'assessment', minutes: 20 },
    ], [{ label: 'Préparer une présentation', lessons: [1, 2] }, { label: 'Présenter à l’oral', lessons: [3] }]),
  ],
};

// Revision exercise suggested by the assistant (not counted in course progress)
export const PRACTICE_LESSONS: Lesson[] = [
  {
    id: 'en-b1-review-irregular', courseId: EN, moduleId: 'en-b1-review', index: 1,
    title: 'Révision express : verbes irréguliers', kind: 'practice', skill: 'grammar', minutes: 6,
    content: {
      heading: 'Quick review',
      instructions: 'Write the past simple form of each verb, then choose the correct sentence.',
      lang: 'en-GB',
      reading: {
        title: 'Rappel',
        paragraphs: [
          'Les verbes irréguliers ne prennent pas -ed au prétérit : go → went, buy → bought, take → took, see → saw.',
          'Astuce : apprends-les par familles de sons (buy / bought, bring / brought, think / thought).',
        ],
      },
      keyPoints: ['go → went · buy → bought · take → took', 'Au prétérit, la forme est la même à toutes les personnes'],
      vocab: [
        { term: 'go → went', fr: 'aller', ex: 'I went to Edinburgh.' },
        { term: 'buy → bought', fr: 'acheter', ex: 'I bought a book.' },
        { term: 'take → took', fr: 'prendre', ex: 'We took the train.' },
        { term: 'see → saw', fr: 'voir', ex: 'We saw the castle.' },
      ],
    },
    questions: [
      q.short('q1', 'go → ?', ['went'], 'went', 'Ce verbe change complètement au prétérit.', 'go → went (I went to Edinburgh).', { placeholder: 'Prétérit de « go »' }),
      q.short('q2', 'buy → ?', ['bought'], 'bought', 'Même famille de sons que « think → thought ».', 'buy → bought (I bought a book).', { placeholder: 'Prétérit de « buy »' }),
      q.short('q3', 'take → ?', ['took'], 'took', 'Comme « shake → shook ».', 'take → took (We took the train).', { placeholder: 'Prétérit de « take »' }),
      q.mcq('q4', 'Choose the correct sentence.', ['We took the train to Edinburgh.', 'We taked the train to Edinburgh.', 'We take the train yesterday.', 'We have took the train.'], 0,
        '« Yesterday » demande le prétérit, et « take » est irrégulier.', '« Took » est le prétérit de « take ». « Taked » n’existe pas.', 'Choisis la phrase correcte.'),
    ],
  },
];

// ---------------------------------------------------------------------------
// Other courses: catalogue titles + one playable lesson each
// ---------------------------------------------------------------------------
const titles = (list: string[], kind: LessonKind = 'reading', skill: SkillId = 'vocabulary'): LessonSpec[] => list.map((title) => ({ title, kind, skill }));

const es: Course = {
  id: 'es-a2', title: 'Espagnol – Niveau débutant', shortTitle: 'Espagnol', category: 'langues', level: 'debutant', cefr: 'A2', flag: 'es',
  description: 'Se débrouiller en ville, commander au restaurant et préparer un premier voyage.', hours: 18, popularity: 91,
  cover: { kind: 'art', motif: 'skyline-es', tone: '#E8913A' },
  modules: [
    mod('es-a2', 1, 'Primeros pasos', titles(['Saludos', 'Los números', 'La familia', 'Mi trabajo', 'Los días de la semana', 'Evaluación'])),
    mod('es-a2', 2, 'En la ciudad', [
      ...titles(['Los lugares de la ciudad', 'El transporte', 'Comprar un billete', 'Las tiendas', 'Ser y estar']),
      {
        title: 'Pedir indicaciones', kind: 'reading', skill: 'reading', minutes: 8,
        content: {
          heading: 'Lee y responde', instructions: 'Lis le dialogue, puis réponds aux questions.', lang: 'es-ES',
          reading: { title: 'En la calle', paragraphs: ['— Perdone, ¿dónde está la estación de tren?', '— Siga todo recto y gire a la izquierda en el semáforo. La estación está al lado del museo.', '— ¿Está lejos?', '— No, está a cinco minutos a pie.'] },
          keyPoints: ['Gire a la izquierda / a la derecha : tournez à gauche / à droite', 'Todo recto : tout droit', 'Al lado de : à côté de'],
        },
        questions: [
          q.mcq('q1', '« Gire a la izquierda » signifie :', ['Tournez à gauche', 'Tournez à droite', 'Continuez tout droit', 'Faites demi-tour'], 0, '« Izquierda » s’oppose à « derecha ».', '« Izquierda » = gauche, « derecha » = droite.'),
          q.tf('q2', 'La gare est à côté du musée.', true, 'Cherche « al lado del… ».', '« La estación está al lado del museo » : elle est à côté du musée.'),
          q.short('q3', 'Combien de minutes à pied ? (chiffre)', ['5', 'cinco', 'cinq'], '5 (cinco)', 'Relis la dernière réplique.', '« Está a cinco minutos a pie » : 5 minutes à pied.'),
        ],
      },
    ]),
    mod('es-a2', 3, 'En el restaurante', titles(['Pedir la carta', 'La comida', 'Las bebidas', 'Gustar', 'Pagar la cuenta', 'Reservar una mesa', 'Evaluación'])),
    mod('es-a2', 4, 'Viajar', titles(['El aeropuerto', 'El hotel', 'El tiempo', 'Planes de viaje', 'El pretérito', 'Contar un viaje', 'Evaluación'])),
  ],
};

const fr: Course = {
  id: 'fr-b1', title: 'Français – Niveau intermédiaire', shortTitle: 'Français', category: 'langues', level: 'intermediaire', cefr: 'B1', flag: 'fr',
  description: 'Raconter, argumenter et écrire des courriels formels sans hésiter sur la grammaire.', hours: 22, popularity: 84,
  cover: { kind: 'art', motif: 'skyline-fr', tone: '#3978E5' },
  modules: [
    mod('fr-b1', 1, 'Raconter au passé', titles(['Passé composé ou imparfait ?', 'Les accords du participe', 'Le plus-que-parfait', 'Les marqueurs de temps', 'Raconter un souvenir', 'Écouter un récit', 'Évaluation'], 'reading', 'grammar')),
    mod('fr-b1', 2, 'Exprimer ses sentiments', titles(['Le vocabulaire des émotions', 'Exprimer la joie', 'Exprimer la déception', 'Les nuances', 'Réagir à une nouvelle', 'Écrire un message', 'Évaluation'])),
    mod('fr-b1', 3, 'Argumenter', [
      ...titles(['Les connecteurs logiques', 'Exprimer la cause'], 'reading', 'grammar'),
      {
        title: 'Le subjonctif : il faut que…', kind: 'practice', skill: 'grammar', minutes: 10,
        content: {
          heading: 'Réviser le subjonctif', instructions: 'Lis le rappel, puis complète les phrases.', lang: 'fr-FR',
          reading: { title: 'Rappel', paragraphs: ['Après « il faut que », on emploie le subjonctif : il faut que tu viennes, il faut que nous partions.', 'Formation : radical de « ils » au présent + -e, -es, -e, -ions, -iez, -ent (ils finissent → que je finisse, que nous finissions).'] },
          keyPoints: ['Il faut que + subjonctif', 'Radical de la 3ᵉ personne du pluriel + terminaisons', 'Penser que (affirmatif) + indicatif'],
        },
        questions: [
          q.mcq('q1', 'Il faut que tu ___ à l’heure.', ['sois', 'es', 'seras', 'étais'], 0, '« Il faut que » déclenche toujours le même mode.', '« Il faut que » est suivi du subjonctif : que tu sois.'),
          q.short('q2', 'Il faut que nous ___ (finir) ce projet.', ['finissions'], 'finissions', 'Pars de « ils finissent ».', 'Radical « finiss- » + « -ions » : que nous finissions.'),
          q.tf('q3', '« Je pense qu’il vient » est correct.', true, 'À la forme affirmative, « penser que » exprime une certitude.', 'Après « penser que » à l’affirmatif, on emploie l’indicatif. Au négatif : « je ne pense pas qu’il vienne ».'),
        ],
      },
      ...titles(['Concéder', 'Débattre à l’oral', 'Écrire un avis', 'Évaluation'], 'reading', 'writing'),
    ]),
    mod('fr-b1', 4, 'Écrire un courriel formel', titles(['Les formules d’appel', 'Structurer sa demande', 'Le conditionnel de politesse', 'Les formules de fin', 'Relire et corriger', 'Répondre à une réclamation', 'Évaluation'], 'reading', 'writing')),
  ],
};

const de: Course = {
  id: 'de-a1', title: 'Allemand – Niveau débutant', shortTitle: 'Allemand', category: 'langues', level: 'debutant', cefr: 'A1', flag: 'de',
  description: 'Les bases pour se présenter, lire l’heure et réserver une chambre en Allemagne.', hours: 16, popularity: 77,
  cover: { kind: 'art', motif: 'skyline-de', tone: '#E0B03A' },
  modules: [
    mod('de-a1', 1, 'Hallo!', titles(['Sich vorstellen', 'Die Zahlen', 'Woher kommst du?', 'Die Familie', 'Berufe', 'Test'])),
    mod('de-a1', 2, 'Im Alltag', [
      ...titles(['Der Tagesablauf', 'Die Wochentage']),
      {
        title: 'Die Uhrzeit', kind: 'reading', skill: 'vocabulary', minutes: 8,
        content: {
          heading: 'Lies und antworte', instructions: 'Lis les exemples, puis réponds aux questions.', lang: 'de-DE',
          reading: { title: 'Wie spät ist es?', paragraphs: ['Es ist acht Uhr. → Il est huit heures.', 'Es ist halb neun. → Il est huit heures et demie (littéralement « la moitié vers neuf »).', 'Es ist Viertel nach zehn. → Il est dix heures et quart.'] },
          keyPoints: ['« halb » renvoie à l’heure suivante : halb neun = 8 h 30', 'Viertel nach / Viertel vor : et quart / moins le quart'],
        },
        questions: [
          q.mcq('q1', '« Es ist halb sieben » signifie :', ['Il est six heures et demie', 'Il est sept heures et demie', 'Il est sept heures moins le quart', 'Il est six heures et quart'], 0, '« Halb » se réfère à l’heure qui arrive.', '« Halb sieben » = la moitié vers sept, donc 6 h 30.'),
          q.tf('q2', '« Viertel nach zehn » = 10 h 15.', true, '« Nach » signifie « après ».', 'Un quart après dix heures : 10 h 15.'),
          q.short('q3', 'Comment dit-on « huit » en allemand ?', ['acht'], 'acht', 'Relis le premier exemple.', '« Es ist acht Uhr » : acht = huit.'),
        ],
      },
      ...titles(['Einkaufen', 'Im Café', 'Test']),
    ]),
    mod('de-a1', 3, 'Im Hotel', titles(['Ein Zimmer reservieren', 'An der Rezeption', 'Fragen stellen', 'Probleme lösen', 'Das Frühstück', 'Test'])),
    mod('de-a1', 4, 'Unterwegs', titles(['Mit dem Zug', 'Nach dem Weg fragen', 'Das Wetter', 'Pläne machen', 'Eine Postkarte', 'Test'])),
  ],
};

const it: Course = {
  id: 'it-b1', title: 'Italien – Niveau intermédiaire', shortTitle: 'Italien', category: 'langues', level: 'intermediaire', cefr: 'B1', flag: 'it',
  description: 'Parler de soi, faire ses courses au marché et voyager en Italie avec aisance.', hours: 14, popularity: 80,
  cover: { kind: 'art', motif: 'skyline-it', tone: '#218568' },
  modules: [
    mod('it-b1', 1, 'Parlare di sé', titles(['Presentarsi', 'Il lavoro', 'I passatempi', 'Il passato prossimo', 'Raccontare', 'Verifica'])),
    mod('it-b1', 2, 'Al mercato', [
      ...titles(['Frutta e verdura', 'I numeri grandi', 'Chiedere', 'Il partitivo', 'I negozi']),
      {
        title: 'Quanto costa?', kind: 'reading', skill: 'vocabulary', minutes: 8,
        content: {
          heading: 'Leggi e rispondi', instructions: 'Lis le dialogue au marché, puis réponds.', lang: 'it-IT',
          reading: { title: 'Al mercato', paragraphs: ['— Buongiorno! Quanto costano queste pesche?', '— Due euro al chilo. Ne vuole un chilo?', '— Sì, grazie. E anche mezzo chilo di pomodori.'] },
          keyPoints: ['Quanto costa / costano ? : combien ça coûte ?', 'Al chilo : le kilo', 'Mezzo chilo : un demi-kilo'],
        },
        questions: [
          q.mcq('q1', '« Quanto costano ? » sert à demander :', ['le prix', 'l’heure', 'le chemin', 'la quantité'], 0, '« Costare » ressemble à un verbe français.', '« Quanto costano queste pesche? » = Combien coûtent ces pêches ?'),
          q.tf('q2', 'Les pêches coûtent deux euros le kilo.', true, 'Relis la réponse du marchand.', '« Due euro al chilo » : deux euros le kilo.'),
          q.short('q3', 'Comment dit-on « tomates » en italien ?', ['pomodori', 'i pomodori', 'pomodoro'], 'pomodori', 'Relis la dernière réplique.', '« Mezzo chilo di pomodori » : un demi-kilo de tomates.'),
        ],
      },
    ]),
    mod('it-b1', 3, 'Viaggiare in Italia', titles(['In treno', 'In albergo', 'Al ristorante', 'Il condizionale', 'Una giornata a Roma', 'Verifica'])),
  ],
};

const ru: Course = {
  id: 'ru-c1', title: 'Russe – Niveau avancé', shortTitle: 'Russe', category: 'langues', level: 'avance', cefr: 'C1', flag: 'ru',
  description: 'Lire la presse, écrire des courriers professionnels et débattre de sujets de société.', hours: 30, popularity: 58,
  cover: { kind: 'art', motif: 'skyline-ru', tone: '#C94F53' },
  modules: [
    mod('ru-c1', 1, 'Lecture et presse', titles(['Lire un éditorial', 'Le vocabulaire de l’économie', 'Les participes', 'Résumer un article', 'Les aspects verbaux', 'La presse régionale', 'Évaluation'], 'reading', 'reading')),
    mod('ru-c1', 2, 'Communication professionnelle', [
      {
        title: 'Formules de politesse à l’écrit', kind: 'reading', skill: 'writing', minutes: 10,
        content: {
          heading: 'Читайте и отвечайте', instructions: 'Lis le courrier, puis réponds aux questions.', lang: 'ru-RU',
          reading: { title: 'Деловое письмо', paragraphs: ['Уважаемый Иван Петрович!', 'Благодарю вас за быстрый ответ. Прошу прислать договор до пятницы.', 'С уважением, Анна Смирнова'] },
          keyPoints: ['Уважаемый + prénom et patronyme : formule d’appel formelle', 'Прошу + infinitif : demande polie', 'С уважением : formule de conclusion'],
        },
        questions: [
          q.mcq('q1', '« Уважаемый » s’emploie pour :', ['commencer une lettre formelle', 'conclure un message amical', 'remercier', 's’excuser'], 0, 'Regarde où le mot apparaît dans la lettre.', '« Уважаемый Иван Петрович! » est la formule d’appel formelle (≈ « Monsieur »).'),
          q.tf('q2', '« С уважением » est une formule de conclusion.', true, 'Regarde la dernière ligne.', '« С уважением » ≈ « Cordialement » / « Respectueusement ».'),
          q.mcq('q3', 'Que demande Anna ?', ['D’envoyer le contrat avant vendredi', 'D’annuler une réunion', 'De rappeler lundi', 'De payer une facture'], 0, '« Прошу прислать договор… »', '« Прошу прислать договор до пятницы » : merci d’envoyer le contrat avant vendredi.'),
        ],
      },
      ...titles(['Le téléphone professionnel', 'Négocier un délai', 'Le registre soutenu', 'Rédiger un compte rendu', 'Évaluation'], 'reading', 'writing'),
    ]),
    mod('ru-c1', 3, 'Culture et société', titles(['Le théâtre russe', 'La littérature contemporaine', 'Les médias', 'Débattre poliment', 'Les expressions idiomatiques', 'Évaluation'], 'reading', 'culture')),
    mod('ru-c1', 4, 'Discussion', titles(['Présenter un argument', 'Réfuter', 'La concession', 'Synthétiser', 'Débat filmé', 'Évaluation'], 'reading', 'speaking')),
  ],
};

function single(id: string, title: string, shortTitle: string, category: CategoryId, level: Course['level'], description: string, hours: number, popularity: number,
  cover: Course['cover'], moduleTitles: [string, string[]][], first: LessonSpec): Course {
  const modules = moduleTitles.map(([t, ls], i) => mod(id, i + 1, t, i === 0 ? [first, ...titles(ls, 'reading', first.skill ?? 'method')] : titles(ls, 'reading', first.skill ?? 'method')));
  return { id, title, shortTitle, category, level, description, hours, popularity, cover, modules };
}

const reading = (heading: string, instructions: string, title: string, paragraphs: string[], keyPoints: string[]): LessonContent =>
  ({ heading, instructions, reading: { title, paragraphs }, keyPoints, lang: 'fr-FR' });

const others: Course[] = [
  single('biz-pitch', 'Pitcher son projet en 3 minutes', 'Pitch', 'business', 'debutant', 'Structurer un message clair, convaincre un jury et conclure par une demande précise.', 6, 73,
    { kind: 'art', motif: 'pitch', tone: '#3978E5' },
    [['Construire son pitch', ['Trouver son accroche', 'Raconter le problème', 'Montrer la preuve']], ['Le jour J', ['La voix et le rythme', 'Répondre aux questions', 'Pitch final']], ['Après le pitch', ['Relancer un contact', 'Améliorer son pitch', 'Bilan']]],
    {
      title: 'La structure d’un pitch', kind: 'reading', skill: 'method', minutes: 8,
      content: reading('Lire et retenir', 'Lis la fiche, puis réponds aux questions.', 'Problème → solution → preuve → demande', [
        'Un pitch efficace commence par le problème que vit ton public, pas par ton produit.',
        'Présente ensuite ta solution en une phrase, puis une preuve : un chiffre, un client, un prototype.',
        'Termine par une demande précise : « 15 minutes de démo jeudi », plutôt que « n’hésitez pas à me contacter ».',
        'En trois minutes, vise trois messages clés au maximum.',
      ], ['Commencer par le problème', 'Une preuve concrète', 'Une demande précise', 'Trois messages clés au maximum']),
      questions: [
        q.mcq('q1', 'Par quoi commence un pitch efficace ?', ['Le problème que tu résous', 'L’historique de l’entreprise', 'La liste des fonctionnalités', 'Le prix'], 0, 'Relis la première phrase de la fiche.', 'On capte l’attention avec le problème vécu par le public.'),
        q.tf('q2', 'Une bonne demande finale est précise, par exemple « 15 minutes de démo jeudi ».', true, 'Compare les deux exemples de la fiche.', 'Une demande précise facilite la décision de ton interlocuteur.'),
        q.short('q3', 'Combien de messages clés au maximum en 3 minutes ? (chiffre)', ['3', 'trois'], '3', 'Relis la dernière phrase.', 'Au-delà de trois messages, le public en retient moins.'),
      ],
    }),
  single('biz-nego', 'Négociation : les fondamentaux', 'Négociation', 'business', 'intermediaire', 'Préparer une négociation, fixer ses limites et trouver un accord gagnant-gagnant.', 9, 69,
    { kind: 'art', motif: 'negotiation', tone: '#218568' },
    [['Préparer', ['Fixer son prix de réserve', 'Analyser l’autre partie', 'Construire ses options']], ['Négocier', ['L’ancrage', 'Les concessions', 'Gérer un blocage', 'Conclure']], ['Cas pratiques', ['Négocier un salaire', 'Négocier avec un fournisseur', 'Évaluation finale']]],
    {
      title: 'Préparer sa BATNA', kind: 'reading', skill: 'method', minutes: 10,
      content: reading('Lire et retenir', 'Lis la fiche, puis réponds aux questions.', 'BATNA et prix de réserve', [
        'La BATNA (Best Alternative To a Negotiated Agreement) est ta meilleure solution de rechange si l’accord échoue.',
        'Plus ta BATNA est solide, plus tu peux négocier sereinement. Évite cependant de la révéler trop tôt.',
        'Le prix de réserve est le seuil au-delà duquel tu préfères refuser l’accord.',
      ], ['BATNA : meilleure alternative en cas d’échec', 'Ne pas révéler sa BATNA trop tôt', 'Prix de réserve : seuil de refus']),
      questions: [
        q.mcq('q1', 'Que désigne la BATNA ?', ['Ta meilleure alternative si l’accord échoue', 'Le premier prix annoncé', 'Le contrat final', 'Une technique d’ancrage'], 0, 'Relis la définition en tête de fiche.', 'BATNA = Best Alternative To a Negotiated Agreement.'),
        q.tf('q2', 'Il vaut mieux révéler sa BATNA dès le début.', false, 'La fiche donne un conseil à ce sujet.', 'La révéler trop tôt affaiblit souvent ta position.'),
        q.mcq('q3', 'Le prix de réserve est :', ['le seuil au-delà duquel tu refuses l’accord', 'le prix affiché en vitrine', 'la remise maximale', 'le prix moyen du marché'], 0, 'Relis la dernière phrase.', 'C’est ta limite : au-delà, tu préfères ta BATNA.'),
      ],
    }),
  single('info-python', 'Python : premiers pas', 'Python', 'informatique', 'debutant', 'Variables, conditions, boucles et fonctions pour automatiser tes premières tâches.', 12, 88,
    { kind: 'art', motif: 'code', tone: '#14243B' },
    [['Les bases', ['Les opérateurs', 'Les chaînes de caractères', 'Les listes', 'Les conditions']], ['Structurer son code', ['Les boucles for', 'Les boucles while', 'Les fonctions', 'Les dictionnaires', 'Lire un fichier']], ['Projet', ['Analyser un CSV', 'Créer un petit jeu', 'Déboguer', 'Les modules', 'Bonnes pratiques', 'Projet final']]],
    {
      title: 'Variables et types', kind: 'reading', skill: 'method', minutes: 10,
      content: reading('Lire et retenir', 'Lis l’exemple de code, puis réponds aux questions.', 'Trois variables, trois types', [
        'age = 21        # int : nombre entier',
        'nom = "Alex"    # str : chaîne de caractères',
        'moyenne = 14.5  # float : nombre décimal',
        'Python distingue les majuscules et les minuscules : « age » et « Age » sont deux variables différentes. La fonction len() renvoie la longueur d’une chaîne.',
      ], ['int, str, float', 'Sensibilité à la casse', 'len() mesure une longueur']),
      questions: [
        q.mcq('q1', 'Quel est le type de moyenne = 14.5 ?', ['float', 'int', 'str', 'bool'], 0, 'Le nombre a une partie décimale.', '14.5 est un nombre décimal : type float.'),
        q.short('q2', 'Que vaut len("Alex") ? (chiffre)', ['4', 'quatre'], '4', 'Compte les caractères entre les guillemets.', '« Alex » contient 4 caractères.'),
        q.tf('q3', 'En Python, Age et age désignent la même variable.', false, 'Relis la dernière ligne de la fiche.', 'Python est sensible à la casse : ce sont deux variables distinctes.'),
      ],
    }),
  single('info-sql', 'SQL pour l’analyse de données', 'SQL', 'informatique', 'intermediaire', 'Interroger une base de données, agréger des résultats et construire des tableaux de bord.', 10, 75,
    { kind: 'art', motif: 'data', tone: '#3978E5' },
    [['Requêtes de base', ['DISTINCT et LIMIT', 'Les opérateurs', 'Les valeurs NULL']], ['Agréger', ['COUNT, SUM, AVG', 'GROUP BY', 'HAVING', 'Les jointures']], ['Analyser', ['Les sous-requêtes', 'Les fonctions de fenêtre', 'Les dates', 'Cas pratique', 'Tableau de bord', 'Optimiser', 'Évaluation finale']]],
    {
      title: 'SELECT, WHERE, ORDER BY', kind: 'reading', skill: 'method', minutes: 10,
      content: reading('Lire et retenir', 'Lis la requête, puis réponds aux questions.', 'Une première requête', [
        'SELECT nom, note FROM etudiants WHERE note >= 12 ORDER BY note DESC;',
        'SELECT choisit les colonnes, FROM la table, WHERE filtre les lignes, ORDER BY trie le résultat (DESC : décroissant).',
        'Pour compter des lignes, on utilise la fonction COUNT(*).',
      ], ['WHERE filtre', 'ORDER BY … DESC trie du plus grand au plus petit', 'COUNT(*) compte les lignes']),
      questions: [
        q.mcq('q1', 'Quelle clause filtre les lignes ?', ['WHERE', 'SELECT', 'ORDER BY', 'FROM'], 0, 'Relis la deuxième ligne.', 'WHERE ne garde que les lignes qui respectent la condition.'),
        q.tf('q2', 'ORDER BY note DESC trie du plus grand au plus petit.', true, 'DESC = descending.', 'DESC trie par ordre décroissant.'),
        q.short('q3', 'Quelle fonction compte les lignes ?', ['count', 'count(*)', 'count()'], 'COUNT(*)', 'Relis la dernière ligne.', 'COUNT(*) renvoie le nombre de lignes.'),
      ],
    }),
  single('perso-focus', 'Gérer son temps et sa concentration', 'Concentration', 'devperso', 'debutant', 'Planifier sa semaine, travailler par blocs et protéger ses temps de concentration.', 5, 82,
    { kind: 'art', motif: 'focus', tone: '#E8913A' },
    [['Méthodes', ['Prioriser avec la matrice d’Eisenhower', 'Planifier sa semaine', 'Le time-blocking']], ['Habitudes', ['Limiter les notifications', 'Les rituels du matin', 'Faire des pauses utiles']], ['Bilan', ['Mesurer son temps', 'Ajuster sa méthode', 'Bilan final']]],
    {
      title: 'La technique Pomodoro', kind: 'reading', skill: 'method', minutes: 7,
      content: reading('Lire et retenir', 'Lis la fiche, puis réponds aux questions.', 'Travailler par blocs', [
        'Choisis une tâche, règle un minuteur sur 25 minutes et travaille sans interruption : c’est un « pomodoro ».',
        'Prends ensuite 5 minutes de pause. Après quatre pomodoros, accorde-toi une pause plus longue (15 à 30 minutes).',
        'L’objectif : avancer par blocs courts et concentrés, plutôt que de lutter contre la distraction pendant des heures.',
      ], ['25 minutes de travail, 5 minutes de pause', 'Pause longue après 4 cycles', 'Blocs courts sans interruption']),
      questions: [
        q.mcq('q1', 'Quelle est la durée classique d’un pomodoro ?', ['25 minutes', '10 minutes', '45 minutes', '1 heure'], 0, 'Relis la première phrase.', 'Un pomodoro dure 25 minutes de travail.'),
        q.tf('q2', 'Après quatre pomodoros, on prend une pause plus longue.', true, 'Relis la deuxième phrase.', 'Une pause de 15 à 30 minutes après quatre cycles.'),
        q.mcq('q3', 'Quel est le but principal de la méthode ?', ['Travailler par blocs courts sans interruption', 'Travailler plus longtemps sans pause', 'Faire plusieurs tâches à la fois', 'Supprimer toutes les pauses'], 0, 'Relis la dernière phrase.', 'La méthode protège la concentration par des blocs courts.'),
      ],
    }),
  single('sci-climat', 'Comprendre le climat', 'Climat', 'sciences', 'intermediaire', 'Les mécanismes du climat, l’effet de serre et la lecture des données scientifiques.', 8, 71,
    { kind: 'art', motif: 'climate', tone: '#218568' },
    [['Les bases', ['L’effet de serre', 'Le cycle du carbone', 'Les océans', 'Lire un graphique']], ['Les données', ['Les mesures de température', 'Les scénarios du GIEC', 'Incertitudes et modèles', 'Les rétroactions']], ['Agir', ['Atténuation', 'Adaptation', 'Évaluer une information', 'Évaluation finale', 'Projet']]],
    {
      title: 'Météo ou climat ?', kind: 'reading', skill: 'method', minutes: 8,
      content: reading('Lire et retenir', 'Lis la fiche, puis réponds aux questions.', 'Deux échelles de temps', [
        'La météo décrit le temps qu’il fait sur quelques heures ou quelques jours.',
        'Le climat décrit les conditions moyennes d’une région sur une longue période, en général au moins 30 ans.',
        'Une journée froide ne contredit donc pas le réchauffement : c’est la tendance moyenne qui compte.',
        'Le dioxyde de carbone (CO₂) est le principal gaz à effet de serre émis par les activités humaines.',
      ], ['Météo : court terme', 'Climat : moyenne sur 30 ans', 'CO₂ : principal gaz émis par l’homme']),
      questions: [
        q.mcq('q1', 'Le climat décrit :', ['les conditions moyennes sur au moins 30 ans', 'le temps qu’il fera demain', 'la température d’une journée', 'la saison en cours'], 0, 'Relis la deuxième phrase.', 'Le climat est une moyenne sur une longue période.'),
        q.tf('q2', 'Une journée froide prouve qu’il n’y a pas de réchauffement.', false, 'Météo ou climat ?', 'Une journée relève de la météo ; le réchauffement est une tendance moyenne.'),
        q.mcq('q3', 'Quel est le principal gaz à effet de serre émis par les activités humaines ?', ['Le dioxyde de carbone (CO₂)', 'L’oxygène', 'L’azote', 'L’hélium'], 0, 'Relis la dernière phrase.', 'Le CO₂ est le principal gaz à effet de serre d’origine humaine.'),
      ],
    }),
  single('art-tableau', 'Lire un tableau', 'Peinture', 'art', 'debutant', 'Composition, lumière et couleur : les clés pour regarder une œuvre avec méthode.', 5, 66,
    { kind: 'art', motif: 'painting', tone: '#6F63D9' },
    [['Regarder', ['La lumière', 'La couleur']], ['Comprendre', ['Le contexte', 'Les symboles', 'Les styles']], ['Pratiquer', ['Analyser un portrait', 'Analyser un paysage', 'Bilan']]],
    {
      title: 'Composition et regard', kind: 'reading', skill: 'culture', minutes: 8,
      content: reading('Lire et retenir', 'Lis la fiche, puis réponds aux questions.', 'Comment le peintre guide ton regard', [
        'La règle des tiers place les éléments forts sur des lignes imaginaires qui divisent le tableau en neuf zones.',
        'Les lignes diagonales donnent souvent une impression de mouvement ; les horizontales, une impression de calme.',
        'Le point de fuite, élément de la perspective, est le point où convergent les lignes parallèles.',
      ], ['Règle des tiers', 'Diagonales : mouvement', 'Point de fuite : perspective']),
      questions: [
        q.mcq('q1', 'La règle des tiers sert à :', ['placer les éléments forts sur des lignes de force', 'choisir les couleurs', 'dater un tableau', 'mesurer la toile'], 0, 'Relis la première phrase.', 'Elle organise la composition en neuf zones.'),
        q.tf('q2', 'Une ligne diagonale donne souvent une impression de mouvement.', true, 'Relis la deuxième phrase.', 'Les diagonales dynamisent la composition.'),
        q.mcq('q3', 'Le point de fuite appartient à :', ['la perspective', 'la couleur', 'la signature', 'le cadre'], 0, 'Relis la dernière phrase.', 'C’est le point de convergence des lignes en perspective.'),
      ],
    }),
  single('art-cinema', 'Histoire du cinéma', 'Cinéma', 'art', 'avance', 'Des frères Lumière au cinéma contemporain : mouvements, auteurs et techniques.', 12, 63,
    { kind: 'art', motif: 'cinema', tone: '#14243B' },
    [['Les révolutions', ['Le néoréalisme italien', 'Le Nouvel Hollywood', 'Le cinéma japonais', 'Le Dogme 95', 'Évaluation']], ['Les techniques', ['Le plan-séquence', 'Le montage', 'Le son', 'La couleur', 'Évaluation']], ['Analyser un film', ['Lire une scène', 'Le point de vue', 'Écrire une critique', 'Festivals et prix', 'Le cinéma numérique', 'Projet', 'Évaluation finale']]],
    {
      title: 'La Nouvelle Vague', kind: 'reading', skill: 'culture', minutes: 10,
      content: reading('Lire et retenir', 'Lis la fiche, puis réponds aux questions.', 'Un cinéma plus libre', [
        'La Nouvelle Vague apparaît en France à la fin des années 1950, portée par de jeunes critiques devenus réalisateurs.',
        'Elle privilégie les tournages en décors naturels, les équipes légères et une grande liberté de montage.',
        'Parmi les cinéastes associés : François Truffaut, Jean-Luc Godard et Agnès Varda.',
      ], ['Fin des années 1950', 'Décors naturels, équipes légères', 'Truffaut, Godard, Varda']),
      questions: [
        q.mcq('q1', 'La Nouvelle Vague naît en France vers :', ['la fin des années 1950', 'les années 1920', 'les années 1980', 'l’an 2000'], 0, 'Relis la première phrase.', 'Elle apparaît à la fin des années 1950.'),
        q.mcq('q2', 'Laquelle de ces personnes y est associée ?', ['Agnès Varda', 'Steven Spielberg', 'Akira Kurosawa', 'Fritz Lang'], 0, 'Relis la dernière phrase.', 'Agnès Varda est l’une des figures du mouvement.'),
        q.tf('q3', 'Les tournages en décors naturels sont typiques de la Nouvelle Vague.', true, 'Relis la deuxième phrase.', 'Les décors naturels et les équipes légères en sont des marques.'),
      ],
    }),
];

others.find((c) => c.id === 'sci-climat')!.tag = 'new';

export const COURSES: Course[] = [en, es, fr, de, it, ru, ...others];

export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'langues', label: 'Langues' },
  { id: 'business', label: 'Business' },
  { id: 'informatique', label: 'Informatique' },
  { id: 'devperso', label: 'Développement personnel' },
  { id: 'sciences', label: 'Sciences' },
  { id: 'art', label: 'Art & Culture' },
];

export const LEVEL_LABEL: Record<Course['level'], string> = { debutant: 'Niveau débutant', intermediaire: 'Niveau intermédiaire', avance: 'Niveau avancé' };
export const LEVEL_SHORT: Record<Course['level'], string> = { debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé' };

export const SKILL_LABEL: Record<SkillId, string> = {
  listening: 'Compréhension orale', vocabulary: 'Vocabulaire', grammar: 'Grammaire', speaking: 'Expression orale',
  reading: 'Compréhension écrite', writing: 'Expression écrite', method: 'Méthode', culture: 'Culture',
};
export const KIND_LABEL: Record<LessonKind, string> = { audio: 'Écoute', video: 'Vidéo', reading: 'Lecture', practice: 'Exercice', assessment: 'Évaluation' };

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------
const lessonIndex = new Map<string, Lesson>();
for (const c of COURSES) for (const m of c.modules) for (const l of m.lessons) lessonIndex.set(l.id, l);
for (const l of PRACTICE_LESSONS) lessonIndex.set(l.id, l);

export const getCourse = (id: string) => COURSES.find((c) => c.id === id);
export const getLesson = (id: string) => lessonIndex.get(id);
export const getModule = (l: Lesson) => getCourse(l.courseId)?.modules.find((m) => m.id === l.moduleId);
export const courseLessons = (c: Course) => c.modules.flatMap((m) => m.lessons);
export const isPlayable = (l: Lesson) => !!(l.questions && l.questions.length);
