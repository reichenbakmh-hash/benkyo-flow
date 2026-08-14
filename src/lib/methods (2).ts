// ---------------------------------------------------------------------------
// Benkyo Flow — Bibliothèque de méthodes d'apprentissage
// ---------------------------------------------------------------------------
// Contenu statique (pas de backend nécessaire) : dix méthodes classiques,
// chacune avec de quoi comprendre rapidement l'essentiel et passer à
// l'action. Les favoris (côté utilisateur) sont gérés séparément dans
// storage.ts / App.tsx, pas ici — ce fichier ne contient que le contenu.
// ---------------------------------------------------------------------------

export type MethodCategory =
  | "memorisation"
  | "comprehension"
  | "organisation"
  | "revision"
  | "concentration"
  | "examens"
  | "prise_de_notes";

export const METHOD_CATEGORIES: { id: MethodCategory; label: string; icon: string }[] = [
  { id: "memorisation", label: "Mémorisation", icon: "brain" },
  { id: "comprehension", label: "Compréhension", icon: "lightbulb" },
  { id: "organisation", label: "Organisation", icon: "folder-kanban" },
  { id: "revision", label: "Révision", icon: "repeat" },
  { id: "concentration", label: "Concentration", icon: "target" },
  { id: "examens", label: "Préparation aux examens", icon: "graduation-cap" },
  { id: "prise_de_notes", label: "Prise de notes", icon: "pen-line" },
];

export type MethodDifficulty = "facile" | "moyen" | "exigeant";

export interface StudyMethod {
  id: string;
  name: string;
  categories: MethodCategory[];
  shortDescription: string;
  objective: string;
  whenToUse: string;
  steps: string[];
  recommendedDuration: string | null;
  difficulty: MethodDifficulty;
  usefulSubjects: string[];
}

export const STUDY_METHODS: StudyMethod[] = [
  {
    id: "active-recall",
    name: "Active Recall (rappel actif)",
    categories: ["memorisation", "revision"],
    shortDescription: "Se tester sans regarder le cours, au lieu de le relire passivement.",
    objective: "Ancrer durablement l'information en forçant le cerveau à la retrouver lui-même.",
    whenToUse:
      "Dès qu'un chapitre a été lu une première fois — pour vérifier ce qui est vraiment retenu, pas juste reconnu.",
    steps: [
      "Ferme ton cours ou ton livre.",
      "Écris ou dis à voix haute tout ce dont tu te souviens sur le sujet.",
      "Rouvre le cours et compare avec ce que tu as écrit.",
      "Note les points oubliés ou faux, puis recommence sur ces points-là uniquement.",
    ],
    recommendedDuration: "10 à 20 min par session",
    difficulty: "moyen",
    usefulSubjects: ["Toutes matières théoriques", "Histoire", "SVT", "Droit", "Langues"],
  },
  {
    id: "repetition-espacee",
    name: "Répétition espacée",
    categories: ["memorisation", "revision"],
    shortDescription: "Revoir une information à intervalles de plus en plus longs.",
    objective: "Lutter contre la courbe de l'oubli en révisant juste avant d'oublier.",
    whenToUse: "Pour du vocabulaire, des formules, des dates — tout ce qui doit rester en mémoire longtemps.",
    steps: [
      "Revois la notion le lendemain de l'avoir apprise.",
      "Revois-la à nouveau après 3 jours.",
      "Puis après 1 semaine.",
      "Puis après 2-3 semaines, et ainsi de suite en espaçant à chaque fois davantage.",
    ],
    recommendedDuration: "5 à 10 min par rappel",
    difficulty: "facile",
    usefulSubjects: ["Langues", "Vocabulaire", "Médecine", "Sciences", "Droit"],
  },
  {
    id: "methode-feynman",
    name: "Méthode Feynman",
    categories: ["comprehension"],
    shortDescription: "Expliquer une notion avec des mots simples, comme à un enfant.",
    objective: "Repérer précisément ce qu'on ne comprend pas vraiment derrière ce qu'on croit savoir.",
    whenToUse: "Quand une notion semble comprise mais reste floue dès qu'il faut l'appliquer.",
    steps: [
      "Choisis une notion et écris son nom en haut d'une feuille.",
      "Explique-la avec des mots très simples, comme si tu parlais à quelqu'un qui ne connaît rien au sujet.",
      "Repère les endroits où tu bloques ou où tu utilises un mot compliqué sans le redéfinir.",
      "Retourne au cours pour combler ces trous, puis reformule à nouveau plus simplement.",
    ],
    recommendedDuration: "15 à 25 min par notion",
    difficulty: "moyen",
    usefulSubjects: ["Mathématiques", "Physique", "Philosophie", "Économie", "Informatique"],
  },
  {
    id: "pomodoro",
    name: "Pomodoro",
    categories: ["concentration", "organisation"],
    shortDescription: "Travailler par blocs de temps courts et intenses, entrecoupés de pauses.",
    objective: "Maintenir la concentration et éviter l'épuisement en rendant le travail moins intimidant.",
    whenToUse: "Pour démarrer une tâche qu'on repousse, ou pour tenir plusieurs heures de révision d'affilée.",
    steps: [
      "Choisis une seule tâche précise à faire.",
      "Travaille dessus 25 minutes sans interruption (téléphone loin, notifications coupées).",
      "Fais une pause de 5 minutes.",
      "Toutes les 4 sessions, prends une pause plus longue de 15 à 30 minutes.",
    ],
    recommendedDuration: "25 min de travail / 5 min de pause",
    difficulty: "facile",
    usefulSubjects: ["Toutes matières", "Particulièrement utile en cas de procrastination"],
  },
  {
    id: "leitner",
    name: "Système Leitner",
    categories: ["memorisation", "revision"],
    shortDescription: "Trier des flashcards en plusieurs boîtes selon ce qu'on maîtrise déjà.",
    objective: "Concentrer le temps de révision sur ce qui n'est pas encore su, pas sur ce qui est déjà acquis.",
    whenToUse: "Pour réviser de grandes quantités de flashcards (vocabulaire, définitions, formules).",
    steps: [
      "Crée des flashcards et mets-les toutes dans la Boîte 1.",
      "Révise la Boîte 1 tous les jours ; une carte réussie monte en Boîte 2.",
      "Révise la Boîte 2 tous les 3 jours ; une carte réussie monte en Boîte 3, une ratée redescend en Boîte 1.",
      "Continue ainsi (Boîte 3 = 1 semaine, Boîte 4 = 2 semaines...) jusqu'à ce que tout soit en dernière boîte.",
    ],
    recommendedDuration: "10 à 15 min par jour",
    difficulty: "moyen",
    usefulSubjects: ["Langues", "Vocabulaire", "Anatomie", "Chimie", "Histoire (dates, personnages)"],
  },
  {
    id: "chunking",
    name: "Chunking (découpage en blocs)",
    categories: ["memorisation", "comprehension"],
    shortDescription: "Regrouper des informations isolées en blocs de sens plus larges.",
    objective: "Réduire la charge mentale en manipulant moins d'unités d'information, mais plus riches.",
    whenToUse: "Face à une longue liste d'éléments à retenir (numéros, étapes, dates, éléments d'une liste).",
    steps: [
      "Repère les éléments qui ont un point commun (thème, catégorie, chronologie).",
      "Regroupe-les en petits blocs de 3 à 5 éléments maximum.",
      "Donne un nom ou une image à chaque bloc pour le retenir comme une seule unité.",
      "Révise bloc par bloc plutôt qu'élément par élément.",
    ],
    recommendedDuration: null,
    difficulty: "facile",
    usefulSubjects: ["Mathématiques", "Informatique (code)", "Histoire", "Chimie", "Musique"],
  },
  {
    id: "cornell",
    name: "Prise de notes Cornell",
    categories: ["prise_de_notes", "organisation"],
    shortDescription: "Diviser sa page en trois zones : notes, indices, résumé.",
    objective: "Prendre des notes utilisables pour réviser plus tard, pas juste pour le moment présent.",
    whenToUse: "Pendant un cours, une conférence, ou la lecture d'un chapitre dense.",
    steps: [
      "Divise ta page en deux colonnes (une large à droite, une étroite à gauche) et une bande en bas.",
      "Pendant le cours, prends tes notes normalement dans la colonne large.",
      "Juste après, écris dans la colonne étroite des mots-clés ou questions qui résument chaque idée.",
      "En bas de page, écris un résumé de 2-3 phrases de tout le contenu de la page.",
    ],
    recommendedDuration: null,
    difficulty: "moyen",
    usefulSubjects: ["Cours magistraux", "Histoire", "Philosophie", "Droit", "SES"],
  },
  {
    id: "blurting",
    name: "Blurting",
    categories: ["memorisation", "revision"],
    shortDescription: "Vider sur une feuille tout ce qu'on sait sur un sujet, sans support.",
    objective: "Faire un état des lieux honnête de ce qui est su et de ce qui manque, très rapidement.",
    whenToUse: "En fin de révision d'un chapitre, pour vérifier ce qui reste avant un contrôle.",
    steps: [
      "Prends une feuille blanche et écris le titre du chapitre.",
      "Pendant un temps limité (5-10 min), écris tout ce qui te vient à l'esprit sur le sujet, sans t'arrêter.",
      "Compare avec le cours et surligne en couleur ce qui manque ou qui est faux.",
      "Refais l'exercice le lendemain en te concentrant sur les points surlignés.",
    ],
    recommendedDuration: "5 à 10 min",
    difficulty: "facile",
    usefulSubjects: ["Toutes matières théoriques", "Idéal juste avant un contrôle"],
  },
  {
    id: "preparation-examen",
    name: "Préparation d'examen",
    categories: ["examens", "organisation"],
    shortDescription: "Une méthode en plusieurs étapes pour aborder un examen sereinement.",
    objective: "Répartir l'effort dans le temps au lieu de tout réviser la veille.",
    whenToUse: "Dès qu'une date d'examen est connue, idéalement 2 à 3 semaines avant.",
    steps: [
      "Liste tous les chapitres au programme et évalue ton niveau de maîtrise sur chacun.",
      "Priorise les chapitres les moins maîtrisés et ceux qui comptent le plus de points.",
      "Planifie des sessions courtes et régulières plutôt que de longues sessions isolées.",
      "Fais des exercices ou annales dans les conditions réelles de l'examen (temps limité, sans notes).",
      "Dans les derniers jours, privilégie la révision active (rappel, blurting) plutôt que la relecture.",
    ],
    recommendedDuration: "Étalé sur 2 à 3 semaines",
    difficulty: "exigeant",
    usefulSubjects: ["Toutes matières", "Particulièrement utile pour les examens finaux et concours"],
  },
  {
    id: "planification-session",
    name: "Planification d'une session de révision",
    categories: ["organisation", "revision"],
    shortDescription: "Structurer à l'avance ce qu'on va faire pendant une session de travail.",
    objective: "Éviter de perdre du temps à décider quoi faire une fois assis au bureau.",
    whenToUse: "Avant chaque session de révision un peu longue, ou en préparant sa semaine.",
    steps: [
      "Choisis un objectif clair et mesurable pour la session (pas juste \"réviser les maths\").",
      "Découpe la session en 2 ou 3 blocs de travail (par exemple via la méthode Pomodoro).",
      "Prévois le matériel nécessaire à l'avance (cours, exercices, flashcards).",
      "À la fin, note en une phrase ce qui a été fait et ce qu'il reste pour la prochaine fois.",
    ],
    recommendedDuration: "5 min de préparation avant chaque session",
    difficulty: "facile",
    usefulSubjects: ["Toutes matières", "Utile pour tous niveaux, du collège à l'université"],
  },
  {
    id: "mind-mapping",
    name: "Carte mentale (Mind Mapping)",
    categories: ["comprehension", "organisation", "prise_de_notes"],
    shortDescription: "Représenter une notion sous forme de branches reliées entre elles, autour d'une idée centrale.",
    objective: "Visualiser les liens entre les idées plutôt que de les empiler en liste, pour mieux comprendre la structure d'un sujet.",
    whenToUse:
      "Pour découvrir un nouveau chapitre, réviser un sujet large, ou préparer un plan de dissertation ou d'exposé.",
    steps: [
      "Écris le sujet principal au centre d'une feuille (à l'horizontale, c'est plus confortable).",
      "Trace des branches vers les grandes sous-parties du sujet.",
      "Ajoute des branches plus fines pour les détails, exemples ou mots-clés de chaque sous-partie.",
      "Utilise des couleurs et des petits dessins pour distinguer les branches — ça aide la mémoire visuelle.",
      "Relis la carte à voix haute en suivant les branches, comme un fil conducteur.",
    ],
    recommendedDuration: "20 à 40 min selon l'ampleur du sujet",
    difficulty: "facile",
    usefulSubjects: ["Histoire-Géo", "SVT", "Philosophie", "Français (dissertation)", "Sciences économiques"],
  },
  {
    id: "sq3r",
    name: "SQ3R (Survey, Question, Read, Recite, Review)",
    categories: ["comprehension", "prise_de_notes"],
    shortDescription: "Une méthode en 5 étapes pour lire un chapitre efficacement, au lieu de le lire une seule fois de façon linéaire.",
    objective: "Transformer une lecture passive en lecture active, pour mieux comprendre et retenir dès la première fois.",
    whenToUse: "Face à un chapitre de manuel ou un texte long et dense, avant de prendre des notes détaillées.",
    steps: [
      "Survey : parcours rapidement le chapitre (titres, sous-titres, résumé, schémas) pour avoir une vue d'ensemble.",
      "Question : transforme chaque titre en question à laquelle tu t'attends à répondre en lisant.",
      "Read : lis le chapitre en cherchant activement les réponses à tes questions.",
      "Recite : après chaque section, referme le livre et résume ce que tu viens de lire, avec tes propres mots.",
      "Review : une fois le chapitre terminé, relis tes résumés et vérifie que l'ensemble tient debout.",
    ],
    recommendedDuration: "Variable selon la longueur du chapitre",
    difficulty: "moyen",
    usefulSubjects: ["Manuels scolaires", "Histoire", "SVT", "Sciences économiques et sociales", "Droit"],
  },
  {
    id: "entrelacement",
    name: "Entrelacement (Interleaving)",
    categories: ["revision", "organisation"],
    shortDescription: "Alterner plusieurs matières ou types d'exercices dans une même session, au lieu de les traiter en bloc.",
    objective: "Forcer le cerveau à identifier quelle méthode utiliser pour chaque problème, plutôt qu'à l'appliquer par automatisme.",
    whenToUse:
      "En période de révisions, surtout pour des matières où plusieurs types d'exercices ou de notions se ressemblent (maths, physique, langues).",
    steps: [
      "Choisis 2 ou 3 matières ou types d'exercices à réviser dans la session.",
      "Découpe le temps en courtes tranches (15-25 min) consacrées chacune à un type différent.",
      "Alterne entre les types au lieu d'épuiser un seul sujet avant de passer au suivant.",
      "Accepte que ce soit plus inconfortable au début — c'est justement ce qui renforce l'apprentissage à long terme.",
    ],
    recommendedDuration: "45 min à 1h30 par session",
    difficulty: "exigeant",
    usefulSubjects: ["Mathématiques", "Physique-Chimie", "Langues", "Exercices de type varié"],
  },
  {
    id: "palais-memoire",
    name: "Palais de mémoire (méthode des loci)",
    categories: ["memorisation"],
    shortDescription: "Associer chaque information à un lieu précis d'un trajet mental familier, pour s'en souvenir dans l'ordre.",
    objective: "Mémoriser une liste longue ou ordonnée (dates, étapes, éléments) en s'appuyant sur la mémoire spatiale, très puissante.",
    whenToUse: "Pour des listes ordonnées : étapes d'un raisonnement, dates clés, éléments d'une classification, plan d'exposé.",
    steps: [
      "Choisis un trajet que tu connais très bien (ta maison, ton trajet vers le lycée).",
      "Repère 5 à 10 endroits précis sur ce trajet, toujours dans le même ordre.",
      "Associe chaque information à retenir à un endroit, sous forme d'image mentale marquante ou insolite.",
      "Pour te souvenir, parcours mentalement le trajet et \"récupère\" chaque information à son endroit.",
      "Répète le parcours mental plusieurs fois pour ancrer les associations.",
    ],
    recommendedDuration: "15 à 25 min pour construire le palais, puis quelques min pour le repasser",
    difficulty: "exigeant",
    usefulSubjects: ["Listes ordonnées", "Histoire (dates, étapes)", "Sciences (classifications)", "Exposés"],
  },
  {
    id: "double-codage",
    name: "Double codage (texte + image)",
    categories: ["memorisation", "comprehension"],
    shortDescription: "Associer systématiquement un schéma, un dessin ou une image à chaque notion écrite.",
    objective: "Créer deux \"chemins\" mentaux vers la même information (verbal et visuel), ce qui la rend plus facile à retrouver.",
    whenToUse: "Pour des notions abstraites, des processus ou des relations de cause à effet difficiles à retenir avec du texte seul.",
    steps: [
      "Après avoir appris une notion, ferme le cours et dessine un schéma simple qui la représente.",
      "N'hésite pas à utiliser des flèches, des symboles ou des personnages simples plutôt qu'un dessin réaliste.",
      "Ajoute quelques mots-clés autour du schéma, pas des phrases complètes.",
      "Pour réviser, essaie de reconstruire le schéma de mémoire avant de vérifier.",
    ],
    recommendedDuration: "10 à 15 min par notion",
    difficulty: "facile",
    usefulSubjects: ["SVT", "Physique-Chimie", "Géographie", "Sciences économiques", "Processus et cycles"],
  },
  {
    id: "sketchnoting",
    name: "Sketchnoting (prise de notes visuelle)",
    categories: ["prise_de_notes", "comprehension"],
    shortDescription: "Prendre des notes en combinant mots-clés, flèches, cadres et petits dessins plutôt que des phrases complètes.",
    objective: "Rester activement concentré pendant un cours ou une vidéo, et produire des notes plus faciles à relire ensuite.",
    whenToUse: "Pendant un cours oral, une conférence ou une vidéo — dès qu'il faut suivre en direct sans pouvoir tout réécouter.",
    steps: [
      "Prépare ta page à l'avance avec quelques zones ou cadres plutôt qu'une simple liste de lignes.",
      "Note uniquement des mots-clés et des chiffres, jamais des phrases entières.",
      "Utilise des flèches pour montrer les liens de cause à effet ou de chronologie.",
      "Ajoute des petits symboles récurrents (étoile = important, point d'interrogation = à vérifier).",
      "Relis et complète tes notes juste après le cours, pendant que c'est encore frais.",
    ],
    recommendedDuration: "Pendant toute la durée du cours",
    difficulty: "moyen",
    usefulSubjects: ["Cours magistraux", "Conférences", "Histoire", "Philosophie", "Sciences économiques"],
  },
];
