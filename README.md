# LearnSpace

Plateforme d’apprentissage en ligne (prototype fonctionnel) construite à partir des écrans de référence LearnSpace, avec Léa, une assistante animée réalisée à partir de sa planche de personnage.

**En ligne : https://moatezslim.github.io/learnspace/**

Le site est republié à chaque envoi sur `main` : le workflow `.github/workflows/deploy.yml` installe, vérifie le TypeScript, compile, puis place `dist-site/` sur la branche `gh-pages`, que GitHub Pages sert. Sur ce site, la progression est enregistrée dans le navigateur et Léa répond avec ses réponses préparées ; les réponses en direct et la synchronisation entre appareils demandent un hébergement qui fournit ces services (voir « Réponses » et « Persistance » ci-dessous).

## Ce qui fonctionne

| Domaine | État |
|---|---|
| Écrans | Tableau de bord (reproduit d’après `02_Page_1_Dashboard.png`, complété en dessous par l’activité de la semaine, les prochaines leçons, les badges récents et les autres cours), leçon, bibliothèque, progression, conversation avec l’assistante. Pages annexes : Mes cours, fiche de cours, Badges, Paramètres, Abonnement. Barre latérale flottante (marges, coins arrondis, ombre portée). |
| Mobile | Même design que la version web (sous 1000 px de large) : mêmes cartes empilées sur une colonne, barre du haut avec menu, recherche, notifications et profil ; la barre latérale bleu marine s’ouvre en tiroir. |
| Navigation | Barre latérale, fil d’Ariane, recherche globale (cours et leçons), ancres d’URL `#library`, `#progress`, `#messages`, `#settings`, `#courses`, `#badges`, `#subscription`. |
| Barre latérale coulissante | Sur ordinateur, la barre latérale se replie sur ses icônes et se déplie : clic (ou clavier) sur la poignée ronde, ou glisser la poignée ou le bord de la barre ; pendant le glissement la largeur suit le pointeur, puis elle se pose sur l’état le plus proche (ou suit un geste rapide). Les icônes ne bougent pas, les libellés s’estompent, la page récupère la place libérée. Repliée, chaque icône affiche son nom au survol ou au focus clavier. Le choix est mémorisé. Sur les fenêtres peu hautes, son contenu se resserre pour tenir sans défiler. |
| Photo de profil | Celle de l’apprenant (menu, barre du haut, Paramètres) : un des 6 avatars illustrés, ses initiales (6 couleurs) ou sa propre photo, importée depuis l’appareil, recadrée au centre et réduite à 256 px dans le navigateur, puis enregistrée avec sa progression. Accès : menu du profil « Changer ma photo » ou Paramètres. |
| Nouveau cours | Bouton « Nouveau cours » en haut de la barre latérale : liste des cours que l’apprenant ne suit pas encore, recherche et filtres par catégorie. « Ajouter » l’inscrit, ouvre la fiche du cours et Léa le présente ; il apparaît dans « Mes cours ». |
| Abonnement | Carte dans la barre latérale (offre, jours restants, période écoulée, bouton « Payer l’abonnement » quand la fin approche), page Abonnement (offre, période payée, changement d’offre mensuelle ou annuelle, moyen de paiement, factures et leur détail). **Paiement de démonstration** : aucune donnée bancaire n’est demandée et rien n’est débité ; payer prolonge l’accès à partir de la fin de la période en cours, ajoute une facture et une notification, et Léa remercie l’apprenant. L’échéance suit le calendrier tant que l’apprenant n’a pas payé lui-même. |
| Leçons | 14 cours au catalogue (259 leçons), 19 leçons jouables (audio, vidéo, lecture, exercice, évaluation) et 1 révision. Séquence : contenu → question → réponse → correction → explication → mise à jour de la progression → leçon suivante. Les réponses sont évaluées d’après les données des questions (QCM, vrai/faux, réponse courte normalisée avec mots-clés). Deux essais, puis la correction s’affiche. Le score retenu est celui du premier essai. Les évaluations exigent 70 %. Les dialogues des leçons d’écoute et la narration de la vidéo sont des enregistrements (voix neuronales britanniques). |
| Progression | Toutes les statistiques sont calculées à partir de l’état de l’apprenant : leçons terminées, temps d’apprentissage (temps actif mesuré pendant la leçon), série de jours, compétences (par module), niveaux par compétence, scores aux évaluations, graphiques jour/semaine, badges. Objectif quotidien : 10 min. |
| Persistance | Enregistrement 0,7 s après chaque changement, et tout de suite quand la page est masquée ou fermée. Navigateur (`localStorage`) et, dans la page publiée, un document privé par utilisateur via la capacité `db` (`data/users/<id>/learnspace`), synchronisé entre appareils : sur un nouvel appareil, la progression enregistrée remplace l’état de démonstration. Sans stockage, l’application fonctionne en mémoire et le signale dans Paramètres. |
| Assistante | Un seul contrôleur partagé (`src/assistant/controller.ts`) pour toutes les vues. Léa ne parle pas à voix haute et ses lèvres ne bougent pas : ses phrases s’écrivent dans sa bulle, lettre après lettre, comme si elle te parlait. Ses yeux suivent la souris (ou le doigt), elle cligne des yeux, respire et change d’expression selon ce qui se passe. |
| Réactions | Bonne réponse : grand sourire et petites étoiles. Leçon réussie : éclat de rire et confettis. Mauvaise réponse : surprise puis tristesse, la tête un peu baissée. Évaluation échouée : triste, avec une petite pluie. Accueil : un clin d’œil. Réponse en préparation : main sous le menton. Dictée : regard curieux. |
| Présentation des cours | Quand l’apprenant va vers un cours, Léa apparaît et le présente dans une bulle : au survol d’une carte de cours (ordinateur) et à l’ouverture d’une fiche de cours (ordinateur et mobile, en feuille en bas de l’écran). Le texte vient des données : programme, nombre de leçons et de modules, durée, niveau, progression et prochaine leçon, avec un bouton pour commencer ou continuer. |
| Réponses | **Réponses en direct** quand la page est publiée et que l’utilisateur l’autorise (capacité `sample` de la page publiée), rédigées avec le contexte réel : progression, leçon ouverte, question en cours, règle « ne jamais donner la réponse avant que l’apprenant ait répondu ». Sinon **réponses préparées**, calculées à partir des données. Le choix se fait dans Paramètres. L’interface ne nomme ni le modèle d’IA ni son fournisseur : les messages sont signés Léa, et la consigne envoyée au modèle lui demande de se présenter comme l’assistante virtuelle de LearnSpace. Saisie vocale dans la conversation si le navigateur et l’autorisation du micro le permettent (bouton masqué sinon). |
| Accessibilité | HTML sémantique, navigation clavier (onglets, options de réponse, graphiques, cartes de cours : le focus clavier déclenche aussi la présentation de Léa), focus visible, libellés ARIA, alternatives texte (transcriptions audio, sous-titres vidéo, tableaux de données des graphiques, texte complet des bulles pour les lecteurs d’écran), `prefers-reduced-motion` et réglage « Animations réduites » (pas de respiration ni de mouvements de tête, textes affichés d’un coup). |

## L’assistante : ce qui est réel et ce qui ne l’est pas

- **Avatar 2D tiré de la planche, pas un modèle 3D.** Les 14 expressions de la planche (neutre, sourires, rire, réflexion, curiosité, surprise, tristesse, scepticisme, clins d’œil, yeux fermés) sont agrandies ×4 (Real-ESRGAN x4plus), détourées (BiRefNet) avec correction des couleurs de bord, puis alignées sur sa silhouette. Corps et tenue sont ceux de la planche (veste bleu marine, haut blanc, collier).
- **Cheveux immobiles d’une expression à l’autre.** Sur la planche, chaque expression a ses propres cheveux : en changeant d’image, les mèches sautaient. Les 10 expressions de face partagent maintenant la même tête : seul l’intérieur du visage (sourcils, yeux, nez, bouche, joues) vient de l’expression, recalé sur le nez puis fondu par clonage de Poisson. Cheveux, cou et tenue sont identiques au pixel près, donc un changement d’expression ne touche que le visage (fondu de 0,3 s). Les 4 images qui ont leur propre tête (main sous le menton, tête levée, tête tournée, éclat de rire) gardent leurs cheveux et passent par un fondu plus long (0,56 s), qui ne saute jamais, même s’il est interrompu.
- **Mouvements de tête amortis.** Les yeux suivent vite (saccades) ; la tête suit la même cible à travers un ressort amorti : elle démarre et s’arrête en douceur et ne reprend jamais les sauts des yeux. Hochement, petit saut, « non » de la tête et tête baissée partent et finissent au repos, sans à-coup.
- **Suivi du regard réel, clignements procéduraux.** Sur les 7 expressions où elle regarde l’apprenant, l’iris d’origine est effacé et redessiné sur un calque : il suit le pointeur à l’intérieur de la forme de l’œil (masque SVG mesuré sur chaque expression), avec un reflet et l’ombre de la paupière. Quand le pointeur ne bouge plus, le regard erre doucement. Les paupières se ferment toutes les 2,4 à 6,2 s, parfois deux fois de suite. Sur les autres expressions (réflexion, rire, clins d’œil…), le regard est celui dessiné sur la planche.
- **Pas de voix, pas de mouvement des lèvres.** Ses phrases s’affichent dans sa bulle ; sa bouche reste celle de l’expression affichée.
- **Poses tournées non utilisées.** La troisième rangée de la planche (tête tournée, de dos) n’est pas utilisée : son cadrage diffère trop des expressions de face et l’image sautait. La tristesse passe par la tête légèrement baissée, la joie par un petit saut.
- **Rangée des yeux non utilisée telle quelle.** Les mouvements d’yeux sont produits par le calque d’iris décrit ci-dessus, sur le visage de chaque expression, plutôt qu’en collant les gros plans de la planche.
- **Intégration 3D prévue mais non implémentée.** L’état de l’animation (`live` dans `src/assistant/leaRig.ts` : regard, inclinaison, hochement, saut, tête baissée) et l’expression courante sont indépendants du rendu. Pour passer à un modèle 3D (Three.js / React Three Fiber + VRM), il suffit de remplacer `Lea.tsx` par un composant qui traduit cet état en morph targets et en rotations.

## Données de démonstration

L’historique d’« Alex Martin » est généré relativement à la date du jour : 24 leçons d’anglais sur 35 (modules 1 à 3 et leçon 4.1 terminés), progression dans 5 autres langues, série de 5 jours, 12 h 40 d’apprentissage, 3 évaluations réussies, 10 min sur 10 aujourd’hui.

Tant que l’apprenant n’a terminé aucune leçon lui-même, cet historique suit le calendrier : chaque nouveau jour s’ouvre sur la même journée que la maquette (leçon terminée aujourd’hui, objectif atteint, série en cours). Tout ce que l’apprenant a fait est conservé tel quel (réponses, leçons en cours, minutes, messages, badges, réglages). Dès qu’il termine une leçon, plus rien ne bouge : chaque chiffre vient de ce qu’il fait réellement. Les sauvegardes des versions précédentes sont mises à niveau. « Réinitialiser la démonstration » (Paramètres) revient à l’état de départ.

Médias : photo de Londres et vignette extraites des références puis agrandies, vidéo « London landmarks » montée à partir de cette photo (MP4 + WebM), couvertures illustrées en SVG pour les autres cours, dialogues et narration des leçons enregistrés.

## Développement

```bash
npm install
npm run typecheck     # TypeScript strict
npm run build         # dist/ (page hébergée), dist-local/ (page de test) et dist-site/ (site public, GitHub Pages)
npm run serve         # http://localhost:4173
npm test              # tous les tests (voir ci-dessous)
```

Stack : React 18 + TypeScript, compilé avec esbuild en un seul script. React est chargé depuis cdnjs dans la version publiée. Aucun backend : la persistance et l’IA passent par les capacités de la page publiée.

```
src/
  data/        cours, leçons, questions ; historique de démonstration ; plans.ts (offres d’abonnement, abonnement de démonstration)
  state/       store (actions), sélecteurs (toutes les statistiques), badges, persistance, demo.ts (historique et mises à niveau), ui.ts (fenêtres ouvertes depuis la barre latérale)
  assistant/   avatar (leaRig.ts, Lea.tsx), contrôleur (expressions, réactions, bulle), présentation des cours
               (guideState.ts, CourseGuide.tsx), réponses (en direct / préparées), panneaux, saisie vocale
  pages/       tableau de bord, leçon (+ lecteurs audio/vidéo), bibliothèque, cours, progression, abonnement, autres
  components/  icônes, primitives UI, graphiques, coque (barre latérale coulissante, barre du haut, tiroir mobile), Overlays.tsx (nouveau cours, paiement, photo), avatars.tsx (avatars illustrés, initiales, redimensionnement des photos)
  lea-frames.json  géométrie des expressions (yeux, iris) sur le canevas commun
public/assets/
  lea/         expressions (x/*.webp), iris, petits portraits ronds
  voice/       dialogues des leçons (l_*.mp3)
  media/       photo, vignette, vidéo
scripts/       export des dialogues à enregistrer
tools/asset-pipeline/  scripts hors ligne qui ont produit les images de Léa et les dialogues
tests/         tests unitaires et navigateur
```

## Tests

`npm test` lance `tests/run.sh` : vérification TypeScript, compilation, test unitaire de l’historique de démonstration, puis sept suites navigateur (Playwright pour Python, Chromium) contre `dist-local/` servi sur le port 4173. 178 vérifications, toutes au vert sur cette version.

| Suite | Vérifie |
|---|---|
| `tests/unit/demo.test.ts` | Historique suivant le calendrier, conservation des actions de l’apprenant, gel après une leçon terminée, mises à niveau (dont l’ancien nom du mode de réponses), plusieurs fuseaux horaires, juste après minuit, abonnement (échéance de démonstration, suivi du calendrier, paiement conservé, états actif / à payer / expiré) |
| `test_dashboard_lea.py` | Bulle écrite lettre après lettre, yeux qui suivent le pointeur (gauche, droite, haut, bas), tête qui suit sans à-coup et en retard sur les yeux, cheveux identiques sur les 10 expressions de face, fondu enchaîné entre deux expressions, clignements, expressions de la planche, barre latérale flottante, aucune commande de voix, aucune bouche animée, chiffres de la maquette, nouvelles sections, Léa triste sur une erreur puis rayonnante avec des étoiles sur une bonne réponse, aucun son de Léa, dialogue de leçon enregistré |
| `test_course_guide.py` | Présentation d’un cours au survol (tableau de bord, bibliothèque), texte complet, disparition en quittant la carte, présentation à l’ouverture d’un cours avec « Continuer » et « Plus tard », mobile : design web, tiroir de navigation, feuille de présentation, pas de défilement horizontal |
| `test_lesson_and_chat.py` | Parcours complet d’une leçon, conversation avec Léa, bibliothèque, progression, vues mobiles |
| `test_pages_and_settings.py` | Messages (réponses en direct signées Léa), paramètres, aucun nom de modèle d’IA ni de fournisseur sur aucune page (texte et attributs), cours, leçon vidéo, évaluation échouée, animations réduites, clavier |
| `test_saved_progress.py` | Sauvegarde d’un jour précédent, sauvegarde gelée, progression du cloud adoptée sur un nouvel appareil |
| `test_sidebar_and_billing.py` | Barre latérale repliée au clic, au clavier et en glissant (poignée et bord), place rendue à la page, noms des icônes au survol, état mémorisé ; « Nouveau cours » (liste, recherche, filtres, ajout, présentation par Léa, « Mes cours ») ; paiement de démonstration (aucun champ bancaire, offre annuelle, prolongation d’un an, carte et notification mises à jour, facture et détail) ; photo de profil (avatar par défaut, initiales, photo importée recadrée à 256 px et conservée au rechargement, fichier non image refusé) ; mobile : tiroir avec les mêmes éléments, paiement au premier plan, aucune page élargie |
| `test_layout.py` | Pas de défilement horizontal de 1000 à 1920 px, captures des pages |

Prérequis : Node 18+, Python 3, `pip install playwright && python3 -m playwright install chromium`. Journaux et captures : `tests/.out/`.

## Chaîne de production des images de Léa (hors ligne)

Les fichiers de `public/assets/lea/` et `src/lea-frames.json` sont déjà produits ; ces scripts ne servent qu’à les régénérer (Python, PyTorch sur CPU, OpenCV, pymatting, modèles téléchargés depuis Hugging Face). À lancer depuis un dossier de travail contenant `v3/sheet.png` (la planche) :

1. `find_frames.py` : repère les rangées et une case par tête → `v3/boxes.json`.
2. `extract_frames.py` : agrandit ×4 (Real-ESRGAN, `esrgan.py`) et détoure (BiRefNet, `matte.py`) chaque case → `v3/x4/`.
3. `align_frames.py` : nettoie les bords, aligne les expressions sur la silhouette de la première, applique une silhouette commune → `v3/aligned/`.
4. `face_composite.py` : pose le visage de chaque expression de face sur la tête de l’expression neutre (recalage sur le nez, masque limité à la peau des deux images, clonage de Poisson) → `v3/aligned_fs/` et une planche de contrôle.
5. `SRC=v3/aligned_fs eye_rig.py <dossier>` : mesure les yeux (iris par corrélation, forme de l’œil à partir du blanc de l’œil et du bord de l’iris), efface les iris, exporte les expressions, l’iris, les portraits ronds et `frames.json` (à copier dans `src/lea-frames.json`).

Dialogues des leçons : `npx esbuild scripts/export-lesson-lines.ts --bundle --platform=node --outfile=x.cjs && node x.cjs lines.json`, puis `tts_lessons.py lines.json public/assets/voice src/lesson-voice.json <fichier des voix Kokoro>`.

## Limites connues

- Pas d’authentification ni de base de données serveur : l’identité vient de la plateforme qui héberge la page.
- Le paiement de l’abonnement est simulé. Pour encaisser réellement, il faut un prestataire de paiement (par exemple une page de paiement hébergée) et un serveur qui confirme le paiement avant de prolonger l’accès : `store.paySubscription` est l’endroit à remplacer.
- La planche ne contient qu’un nombre fini d’expressions : Léa passe de l’une à l’autre par un fondu court, ce n’est pas une animation continue du visage. Les cheveux restent immobiles entre les expressions de face ; ils changent quand elle passe à une image qui a sa propre tête (réflexion, curiosité, scepticisme, rire).
- La saisie vocale n’est généralement pas autorisée dans la page publiée (micro bloqué) : le bouton est alors masqué.
- Les leçons marquées « Bientôt » font partie du catalogue (titres, durées, progression) mais n’ont pas de contenu jouable.
