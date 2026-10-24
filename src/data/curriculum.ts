export interface ChapterInfo {
  id: string;
  title: string;
  subject: 'Physique' | 'Chimie';
  domain: string;
  branches?: ('PC' | 'SM')[];
  weightInExam: string; // e.g. "2.5 à 3 pts"
  summary: string;
  keyFormulas: {
    name: string;
    latex: string;
    units: string;
    condition?: string;
  }[];
  nationalChecklist: string[];
  classicPitfalls: string[];
  suggestedPrompt: string;
}

export const CURRICULUM: ChapterInfo[] = [
  // --- PHYSIQUE : ONDES ---
  {
    id: 'ondes-mecaniques',
    title: 'Ondes mécaniques progressives et périodiques',
    subject: 'Physique',
    domain: 'Ondes',
    weightInExam: '2.5 à 3.0 pts',
    summary: 'Propagation d\'une perturbation sans transport de matière mais avec transport d\'énergie. Périodicité spatiale (longueur d\'onde) et temporelle (période/fréquence). Phénomène de diffraction et milieu dispersif.',
    keyFormulas: [
      {
        name: 'Célérité de l\'onde',
        latex: 'v = \\frac{d}{\\Delta t}',
        units: '$v$ en $m\\cdot s^{-1}$, $d$ en $m$, $\\Delta t$ en $s$',
      },
      {
        name: 'Retard temporel tau',
        latex: '\\tau = \\frac{SM}{v} \\quad \\text{et} \\quad y_M(t) = y_S(t - \\tau)',
        units: '$\\tau$ en secondes ($s$)',
      },
      {
        name: 'Double périodicité',
        latex: '\\lambda = v \\cdot T = \\frac{v}{N}',
        units: '$\\lambda$ en $m$, $T$ en $s$, $N$ (ou $\\nu$) en $Hz$',
      },
      {
        name: 'Milieu dispersif',
        latex: 'v = f(N) \\neq \\text{cte}',
        units: 'La célérité dépend de la fréquence de l\'onde',
      },
      {
        name: 'Condition de diffraction',
        latex: 'a \\le \\lambda \\quad \\text{(ou } a \\approx \\lambda \\text{)}',
        units: '$a$ dimension de l\'ouverture en $m$',
      },
    ],
    nationalChecklist: [
      'Distinguer onde longitudinale (ex: son) et transversale (ex: corde, surface de l\'eau).',
      'Calculer le retard temporel $\\tau$ graphiquement ou par calcul.',
      'Justifier si un milieu est dispersif ou non.',
      'Établir l\'état vibratoire de deux points (en phase si $d = k\\lambda$, en opposition de phase si $d = (2k+1)\\frac{\\lambda}{2}$).',
    ],
    classicPitfalls: [
      'Confondre retard temporel $\\tau$ et période temporelle $T$.',
      'Oublier de convertir la sensibilité de balayage ou l\'échelle graphique en mètres/secondes.',
      'Affirmer qu\'il y a transport de matière (seule l\'énergie est transportée).',
    ],
    suggestedPrompt: 'Si Driss, comment déterminer graphiquement si deux points vibrent en phase ou en opposition de phase sur une onde périodique ?',
  },
  {
    id: 'ondes-lumineuses',
    title: 'Propagation des ondes lumineuses (Diffraction & Réfraction)',
    subject: 'Physique',
    domain: 'Ondes',
    weightInExam: '2.5 à 3.0 pts',
    summary: 'La lumière est une onde électromagnétique se propageant dans le vide et dans les milieux transparents. Phénomène de diffraction par un fil ou une fente, dispersion par un prisme.',
    keyFormulas: [
      {
        name: 'Écart angulaire de diffraction',
        latex: '\\theta = \\frac{\\lambda}{a}',
        units: '$\\theta$ en $rad$, $\\lambda$ en $m$, $a$ en $m$',
        condition: 'Pour une fente ou fil de largeur a',
      },
      {
        name: 'Relation avec la tache centrale',
        latex: '\\tan \\theta \\approx \\theta = \\frac{L}{2D} \\implies \\frac{L}{2D} = \\frac{\\lambda}{a}',
        units: '$L$ largeur de la tache en $m$, $D$ distance en $m$',
      },
      {
        name: 'Célérité et indice de réfraction',
        latex: 'n = \\frac{c}{v} \\ge 1 \\quad \\text{et} \\quad \\lambda = \\frac{\\lambda_0}{n}',
        units: '$n$ sans unité, $c = 3.00\\times 10^8\\ m\\cdot s^{-1}$',
      },
      {
        name: 'Fréquence invariante',
        latex: '\\nu = \\frac{c}{\\lambda_0} = \\frac{v}{\\lambda} = \\text{constante}',
        units: 'La couleur/fréquence ne change pas de milieu',
      },
    ],
    nationalChecklist: [
      'Tracer le schéma du dispositif de diffraction avec $\\theta$, $a$, $D$, $L$.',
      'Exploiter une courbe linéaire $L = f(1/a)$ pour déduire $\\lambda$ par la pente $k = 2\\lambda D$.',
      'Expliquer la dispersion de la lumière blanche par un prisme ($n$ dépend de $\\lambda$).',
    ],
    classicPitfalls: [
      'Écrire $\\tan \\theta = L/D$ au lieu de $L/(2D)$ pour le demi-écart angulaire.',
      'Croire que la fréquence change quand la lumière entre dans le verre (seules $\\lambda$ et $v$ changent !).',
      'Oublier de convertir les $nm$ ($10^{-9}\\ m$) ou $\\mu m$ ($10^{-6}\\ m$) en mètres.',
    ],
    suggestedPrompt: 'Prof, montre-moi l\'exploitation rigoureuse de la courbe $L = f(1/a)$ pour trouver la longueur d\'onde $\\lambda$ au National.',
  },

  // --- PHYSIQUE : NUCLÉAIRE ---
  {
    id: 'decroissance-radioactive',
    title: 'Décroissance radioactive & Datation',
    subject: 'Physique',
    domain: 'Nucléaire',
    weightInExam: '2.0 à 2.5 pts',
    summary: 'Stabilité des noyaux, désintégrations $\\alpha, \\beta^-, \\beta^+$, désexcitation $\\gamma$, lois de conservation de Soddy, loi de décroissance $N(t)$, temps de demi-vie et datation.',
    keyFormulas: [
      {
        name: 'Lois de conservation de Soddy',
        latex: '{}_{Z}^{A}X \\to {}_{Z_1}^{A_1}Y + {}_{Z_2}^{A_2}P \\implies A = A_1 + A_2 \\quad \\text{et} \\quad Z = Z_1 + Z_2',
        units: 'Conservation de A (nucléons) et Z (charge)',
      },
      {
        name: 'Loi de décroissance radioactive',
        latex: 'N(t) = N_0 \\cdot e^{-\\lambda t}',
        units: '$\\lambda$ en $s^{-1}$, $t$ en $s$',
      },
      {
        name: 'Demi-vie t1/2',
        latex: 't_{1/2} = \\frac{\\ln 2}{\\lambda} \\approx \\frac{0.693}{\\lambda}',
        units: '$t_{1/2}$ et $\\lambda$ ont des unités inverses',
      },
      {
        name: 'Activité d\'une source',
        latex: 'a(t) = -\\frac{dN}{dt} = \\lambda \\cdot N(t) = a_0 \\cdot e^{-\\lambda t}',
        units: '$a(t)$ en Becquerels ($Bq = 1\\text{ désint/s}$)',
      },
      {
        name: 'Âge d\'un échantillon (Datation)',
        latex: 't = \\frac{t_{1/2}}{\\ln 2} \\ln\\left(\\frac{a_0}{a(t)}\\right) = -\\frac{1}{\\lambda}\\ln\\left(\\frac{N(t)}{N_0}\\right)',
        units: '$t$ dans la même unité que $t_{1/2}$',
      },
    ],
    nationalChecklist: [
      'Écrire les équations nucléaires en appliquant rigoureusement les lois de Soddy.',
      'Définir le temps de demi-vie $t_{1/2}$ (durée au bout de laquelle la moitié des noyaux radioactifs s\'est désintégrée).',
      'Exploiter les graphes $\\ln(N) = f(t)$ ou $\\ln(a) = f(t)$ de pente $-\\lambda$.',
    ],
    classicPitfalls: [
      'Calculer l\'activité en utilisant $t$ en années alors que $\\lambda$ est en $s^{-1}$ (ou vice-versa pour $a = \\lambda N$).',
      'Confondre le nombre de noyaux désintégrés $N_d(t) = N_0 - N(t) = N_0(1 - e^{-\\lambda t})$ et le nombre restant $N(t)$.',
    ],
    suggestedPrompt: 'Si Driss, quelle est la méthode infaillible pour ne pas confondre noyaux restants et noyaux formés dans la datation ?',
  },
  {
    id: 'noyaux-masse-energie',
    title: 'Noyaux, Masse et Énergie (Défaut de masse, Fission, Fusion)',
    subject: 'Physique',
    domain: 'Nucléaire',
    weightInExam: '2.0 à 2.5 pts',
    summary: 'Équivalence masse-énergie d\'Einstein $E = m c^2$, défaut de masse d\'un noyau, énergie de liaison $E_l$, énergie de liaison par nucléon et courbe d\'Aston, énergie libérée lors d\'une réaction nucléaire.',
    keyFormulas: [
      {
        name: 'Énergie de masse d\'Einstein',
        latex: 'E = m \\cdot c^2',
        units: '$E$ en $J$ ou $MeV$, $1\\ u = 931.5\\ MeV/c^2$',
      },
      {
        name: 'Défaut de masse d\'un noyau',
        latex: '\\Delta m = \\left[ Z \\cdot m_p + (A - Z) m_n \\right] - m({}_{Z}^{A}X) > 0',
        units: '$\\Delta m > 0$ en $u$ ou $kg$',
      },
      {
        name: 'Énergie de liaison El',
        latex: 'E_l = \\Delta m \\cdot c^2 > 0',
        units: 'En $MeV$ ou $J$',
      },
      {
        name: 'Énergie de liaison par nucléon',
        latex: '\\xi = \\frac{E_l}{A}',
        units: 'Plus $\\xi$ est grande, plus le noyau est stable',
      },
      {
        name: 'Énergie libérée par réaction',
        latex: '\\Delta E = \\left( \\sum m_{\\text{produits}} - \\sum m_{\\text{réactifs}} \\right) c^2 < 0 \\implies E_{\\text{libérée}} = |\\Delta E|',
        units: '$E_{\\text{libérée}} > 0$',
      },
    ],
    nationalChecklist: [
      'Calculer $\\Delta m$ avec 4 à 5 chiffres significatifs (ne pas arrondir trop tôt les masses atomiques !).',
      'Comparer la stabilité de deux noyaux à l\'aide de $E_l / A$.',
      'Calculer l\'énergie libérée par mole ou pour une masse $m$ de combustible ($E_T = N \\cdot |\\Delta E|$ avec $N = \\frac{m}{M} N_A$).',
    ],
    classicPitfalls: [
      'Arrondir la masse $u$ en cours de calcul (le défaut de masse est une petite différence entre grands nombres).',
      'Confondre $E_l$ (énergie de liaison d\'un noyau) et $\\Delta E$ (variation d\'énergie d\'une réaction).',
      'Oublier le facteur $N_A$ pour passer à une quantité molaire ou macroscopique.',
    ],
    suggestedPrompt: 'Prof, pourquoi un noyau avec une énergie de liaison par nucléon plus élevée est-il plus stable ?',
  },

  // --- PHYSIQUE : ÉLECTRICITÉ ---
  {
    id: 'dipole-rc',
    title: 'Dipôle RC (Charge, Décharge & Constante de temps)',
    subject: 'Physique',
    domain: 'Électricité',
    weightInExam: '2.5 à 3.0 pts',
    summary: 'Comportement d\'un condensateur soumis à un échelon de tension. Équation différentielle vérifiée par $u_C(t)$ ou $q(t)$, constante de temps $\\tau = RC$, aspect énergétique.',
    keyFormulas: [
      {
        name: 'Relations fondamentales',
        latex: 'q = C \\cdot u_C \\quad \\text{et} \\quad i = \\frac{dq}{dt} = C \\frac{du_C}{dt}',
        units: '$q$ en $C$, $C$ en $F$, $u_C$ en $V$, $i$ en $A$',
      },
      {
        name: 'Équation différentielle (Charge)',
        latex: 'u_C + R C \\frac{du_C}{dt} = E \\iff u_C + \\tau \\frac{du_C}{dt} = E',
        units: 'Loi d\'additivité : $u_R + u_C = E$',
      },
      {
        name: 'Solution analytique (Charge)',
        latex: 'u_C(t) = E \\left(1 - e^{-t/\\tau}\\right) \\quad \\text{avec} \\quad \\tau = RC',
        units: '$\\tau$ en secondes ($s$)',
      },
      {
        name: 'Décharge du condensateur',
        latex: 'u_C(t) = E \\cdot e^{-t/\\tau} \\quad (u_C + \\tau \\frac{du_C}{dt} = 0)',
        units: 'À $t = \\tau$, $u_C = 0.37 E$',
      },
      {
        name: 'Énergie emmagasinée',
        latex: '\\mathcal{E}_e = \\frac{1}{2} C u_C^2 = \\frac{1}{2} \\frac{q^2}{C}',
        units: '$\\mathcal{E}_e$ en Joules ($J$)',
      },
    ],
    nationalChecklist: [
      'Schématiser le circuit avec le fléchage des tensions en convention récepteur ($u_R$ et $u_C$ opposés à $i$).',
      'Établir l\'équation différentielle en appliquant la loi d\'additivité.',
      'Vérifier par analyse dimensionnelle que $[\tau] = T$ (durée).',
      'Déterminer $\\tau$ par 2 méthodes : méthode de la tangente à l\'origine ($t = \\tau$) et méthode des 63% ($u_C = 0.63 E$).',
    ],
    classicPitfalls: [
      'Oublier d\'exprimer $u_R = R \\cdot i$ avant d\'injecter $i = C du_C/dt$.',
      'Analyse dimensionnelle : oublier d\'utiliser la loi d\'Ohm ($[R] = [U]/[I]$) et $[C] = [I][T]/[U]$.',
      'Confondre microfarads ($\\mu F = 10^{-6}\\ F$) et nanofarads ($nF = 10^{-9}\\ F$).',
    ],
    suggestedPrompt: 'Si Driss, comment rédiger impeccablement l\'analyse dimensionnelle de $\\tau = RC$ au National ?',
  },
  {
    id: 'dipole-rl',
    title: 'Dipôle RL (Établissement & Rupture du courant)',
    subject: 'Physique',
    domain: 'Électricité',
    weightInExam: '2.5 à 3.0 pts',
    summary: 'Rôle d\'une bobine d\'inductance $L$ et de résistance interne $r$. Retard à l\'établissement du courant. Équation différentielle en $i(t)$, constante de temps $\\tau = \\frac{L}{R_T}$, énergie magnétique.',
    keyFormulas: [
      {
        name: 'Tension aux bornes de la bobine',
        latex: 'u_L = L \\frac{di}{dt} + r \\cdot i',
        units: '$L$ en Henry ($H$), $r$ en $\\Omega$',
      },
      {
        name: 'Équation diff (Établissement)',
        latex: 'L \\frac{di}{dt} + (R + r) i = E \\iff i + \\tau \\frac{di}{dt} = I_0 = \\frac{E}{R + r}',
        units: '$\\tau = \\frac{L}{R_T} = \\frac{L}{R + r}$',
      },
      {
        name: 'Solution du courant i(t)',
        latex: 'i(t) = \\frac{E}{R+r} \\left(1 - e^{-t/\\tau}\\right)',
        units: 'À $t \\to \\infty$, $i_{\\infty} = I_0 = \\frac{E}{R+r}$ (régime permanent)',
      },
      {
        name: 'Énergie magnétique',
        latex: '\\mathcal{E}_m = \\frac{1}{2} L i^2',
        units: '$\\mathcal{E}_m$ en Joules ($J$)',
      },
    ],
    nationalChecklist: [
      'Justifier que la bobine s\'oppose aux variations du courant électrique.',
      'Exploiter le régime permanent pour déterminer la résistance interne $r = \\frac{E}{I_0} - R$.',
      'Déterminer $\\tau$ graphiquement par la tangente à l\'origine et déduire $L = \\tau \\cdot (R+r)$.',
    ],
    classicPitfalls: [
      'Oublier la résistance interne $r$ de la bobine dans $R_T = R + r$.',
      'Croire que la tension aux bornes de la bobine est nulle en régime permanent (elle vaut $r \\cdot I_0$, non nulle si $r \\neq 0$ !).',
    ],
    suggestedPrompt: 'Prof, comment exploiter la courbe $u_R(t)$ pour trouver à la fois $L$ et $r$ sans se tromper ?',
  },
  {
    id: 'oscillations-rlc',
    title: 'Oscillations libres RLC série & Aspect Énergétique',
    subject: 'Physique',
    domain: 'Électricité',
    weightInExam: '3.0 à 3.5 pts',
    summary: 'Décharge d\'un condensateur dans une bobine. Régimes pseudo-périodique, apériodique et critique. Période propre $T_0 = 2\\pi\\sqrt{LC}$. Transfert d\'énergie et effet Joule. Dispositif d\'entretien.',
    keyFormulas: [
      {
        name: 'Équation diff RLC série',
        latex: '\\frac{d^2 u_C}{dt^2} + \\frac{R_T}{L} \\frac{du_C}{dt} + \\frac{1}{LC} u_C = 0',
        units: 'avec $R_T = R + r$',
      },
      {
        name: 'Période propre (Circuit LC idéal)',
        latex: 'T_0 = 2\\pi \\sqrt{L C} \\iff \\omega_0 = \\frac{1}{\\sqrt{LC}}',
        units: '$T_0$ en secondes, $L$ en $H$, $C$ en $F$',
      },
      {
        name: 'Pseudo-période',
        latex: 'T \\approx T_0 = 2\\pi \\sqrt{LC} \\quad (\\text{pour faible amortissement})',
        units: 'Mesurée graphiquement entre 2 sommets successifs',
      },
      {
        name: 'Énergie totale du circuit',
        latex: '\\mathcal{E}_T = \\mathcal{E}_e + \\mathcal{E}_m = \\frac{1}{2} C u_C^2 + \\frac{1}{2} L i^2',
        units: '$\\frac{d\\mathcal{E}_T}{dt} = -R_T i^2 \\le 0$ (dissipation par effet Joule)',
      },
      {
        name: 'Entretien des oscillations',
        latex: 'u_G(t) = R_0 \\cdot i(t) \\implies R_0 = R_T = R + r',
        units: 'Générateur de résistance négative compense les pertes',
      },
    ],
    nationalChecklist: [
      'Distinguer les régimes périodique ($R=0$), pseudo-périodique ($R$ faible) et apériodique ($R$ forte).',
      'Démontrer que $\\frac{d\\mathcal{E}_T}{dt} = -R_T i^2$ à partir de l\'équation différentielle.',
      'Exploiter les courbes d\'énergie $E_e(t), E_m(t), E_T(t)$ : la période des énergies est $\\mathcal{T} = T/2$.',
    ],
    classicPitfalls: [
      'Attention piège classique du National : la période de l\'énergie est $T/2$ et NON $T$ !',
      'Confondre $T$ (pseudo-période mesurée sur $u_C$) et la durée entre un maximum et le zéro suivant ($T/4$).',
    ],
    suggestedPrompt: 'Si Driss, pourquoi la période des courbes d\'énergie $E_e$ et $E_m$ est égale à $T/2$ ? Peux-tu me le prouver ?',
  },
  {
    id: 'modulation-am',
    title: 'Modulation et Démodulation d\'Amplitude (AM) - Spécifique PC',
    subject: 'Physique',
    domain: 'Électricité',
    branches: ['PC'],
    weightInExam: '1.5 à 2.0 pts',
    summary: 'Transmission d\'un signal informatif BF sur une onde porteuse HF. Circuit multiplieur, signal modulé $s(t)$, taux de modulation $m$, condition de bonne modulation, détection d\'enveloppe.',
    keyFormulas: [
      {
        name: 'Signal informatif et porteuse',
        latex: 's(t) = S_m \\cos(2\\pi f_s t) \\quad \\text{et} \\quad p(t) = P_m \\cos(2\\pi F_p t)',
        units: 'Fréquences : $F_p \\gg f_s$ (au moins $F_p \\ge 10 f_s$)',
      },
      {
        name: 'Expression du signal modulé',
        latex: 'u(t) = k \\cdot [s(t) + U_0] \\cdot p(t) = A [1 + m \\cos(2\\pi f_s t)] \\cos(2\\pi F_p t)',
        units: '$U_0$ tension de décalage (offset)',
      },
      {
        name: 'Taux de modulation m',
        latex: 'm = \\frac{S_m}{U_0} = \\frac{U_{max} - U_{min}}{U_{max} + U_{min}}',
        units: '$m$ sans unité. Bonne modulation $\\iff m < 1$',
      },
      {
        name: 'Spectre de fréquences',
        latex: '3 \\text{ raies : } F_p - f_s, \\quad F_p, \\quad F_p + f_s',
        units: 'Largeur de bande : $\\Delta F = 2 f_s$',
      },
      {
        name: 'Condition de détection d\'enveloppe',
        latex: 'T_p \\ll \\tau = R C < T_s \\iff \\frac{1}{F_p} \\ll R C < \\frac{1}{f_s}',
        units: 'Filtre passe-bas (diode + RC parallèle)',
      },
    ],
    nationalChecklist: [
      'Citer les 2 conditions pour une bonne modulation : $m < 1$ (pas d\'inversion de phase) et $F_p \\ge 10 f_s$.',
      'Calculer $m$ à partir de l\'oscillogramme temporel ($U_{max}$ et $U_{min}$) ou du trapèze en mode XY.',
      'Expliquer le rôle de chaque bloc : multiplieur, détection d\'enveloppe (diode + RC), filtre éliminateur de la composante continue (RC série passe-haut).',
    ],
    classicPitfalls: [
      'Confondre $F_p$ (haute fréquence porteuse) et $f_s$ (basse fréquence signal).',
      'Oublier la condition sur $\\tau = RC$ : si $\\tau > T_s$, la décharge est trop lente (mauvais suivi) ; si $\\tau < T_p$, l\'onde porteuse n\'est pas filtrée.',
    ],
    suggestedPrompt: 'Prof, comment exploiter la figure du trapèze en mode XY pour prouver que la modulation est de bonne qualité ?',
  },
  {
    id: 'oscillations-electriques-forcees-rlc',
    title: 'Oscillations Électriques Forcées RLC & Résonance d\'Intensité - Spécifique SM',
    subject: 'Physique',
    domain: 'Électricité',
    branches: ['SM'],
    weightInExam: '3.0 à 4.0 pts',
    summary: 'Régime sinusoïdal forcé imposé par un GBF $u(t) = U_m \\cos(\\omega t)$. Impédance du dipôle RLC série $Z$, déphasage $\\varphi$, résonance d\'intensité à $\\omega_0 = 1/\\sqrt{LC}$, facteur de qualité $Q$, bande passante à $-3dB$ et acuité de la résonance.',
    keyFormulas: [
      {
        name: 'Impédance du circuit RLC série',
        latex: 'Z = \\frac{U_m}{I_m} = \\sqrt{R_T^2 + \\left(L\\omega - \\frac{1}{C\\omega}\\right)^2}',
        units: '$Z$ en Ohms ($\\Omega$), $R_T = R + r$',
      },
      {
        name: 'Déphasage tension/courant',
        latex: '\\tan \\varphi = \\frac{L\\omega - \\frac{1}{C\\omega}}{R_T} \\quad \\text{avec } u(t) = U_m \\cos(\\omega t), \\ i(t) = I_m \\cos(\\omega t - \\varphi)',
        units: '$\\varphi = \\varphi_u - \\varphi_i$ en radians',
      },
      {
        name: 'Condition de résonance d\'intensité',
        latex: 'L\\omega_0 - \\frac{1}{C\\omega_0} = 0 \\implies \\omega_0 = \\frac{1}{\\sqrt{LC}} \\quad \\text{et} \\quad Z_{min} = R_T, \\quad I_{0,m} = \\frac{U_m}{R_T}',
        units: 'À la résonance : $\\varphi = 0$ (tension et courant sont en phase)',
      },
      {
        name: 'Facteur de surtension / qualité Q',
        latex: 'Q = \\frac{U_{C,0}}{U} = \\frac{U_{L,0}}{U} = \\frac{L\\omega_0}{R_T} = \\frac{1}{R_T C \\omega_0} = \\frac{1}{R_T}\\sqrt{\\frac{L}{C}}',
        units: '$Q$ sans unité. Si $Q > 1$, il y a phénomène de surtension aux bornes de $C$ et $L$',
      },
      {
        name: 'Bande passante à -3 dB',
        latex: '\\Delta N = N_2 - N_1 = \\frac{R_T}{2\\pi L} = \\frac{N_0}{Q}',
        units: 'Définie pour $I \\ge \\frac{I_0}{\\sqrt{2}}$ et $P \\ge \\frac{P_{max}}{2}$',
      },
    ],
    nationalChecklist: [
      'Construire ou exploiter le diagramme de Fresnel pour le dipôle RLC série.',
      'Démontrer l\'expression de l\'impédance $Z$ et de $\\tan\\varphi$ par méthode analytique ou vectorielle.',
      'Identifier la résonance sur un graphe $I = f(N)$ : sommet $I_0 = U/R_T$ à $N = N_0$.',
      'Déterminer la bande passante $\\Delta N$ à $I_0/\\sqrt{2} \\approx 0.707 I_0$ et en déduire le facteur $Q = N_0/\\Delta N$.',
      'Justifier si le circuit est inductif ($\\varphi > 0, L\\omega > 1/C\\omega$) ou capacitif ($\\varphi < 0, L\\omega < 1/C\\omega$).',
    ],
    classicPitfalls: [
      'GROS PIÈGE SM : Confondre la fréquence propre $N_0 = \\frac{1}{2\\pi\\sqrt{LC}}$ et la fréquence imposée $N$ par le GBF (seule $N_0$ est fixe, $N$ varie !).',
      'Oublier de diviser $I_{max}$ par $\\sqrt{2}$ (et non par 2) pour lire la bande passante à $-3\\text{ dB}$.',
      'Attention au signe du déphasage : $\\varphi = \\varphi_u - \\varphi_i$. Si le courant est en avance, $\\varphi < 0$.',
    ],
    suggestedPrompt: 'Si Driss, montre-moi la démonstration complète de l\'impédance $Z$ et de la bande passante $\\Delta N = N_0/Q$ pour le National SM.',
  },

  // --- PHYSIQUE : MÉCANIQUE ---
  {
    id: 'lois-newton-chute',
    title: 'Lois de Newton & Chute avec frottement visqueux',
    subject: 'Physique',
    domain: 'Mécanique',
    weightInExam: '3.0 à 4.0 pts',
    summary: 'Les 3 lois de Newton dans un référentiel galiléen. Chute verticale d\'un solide dans un fluide avec poussée d\'Archimède et frottements $f = k v^n$. Équation différentielle, vitesse limite, méthode d\'Euler.',
    keyFormulas: [
      {
        name: '2ème loi de Newton',
        latex: '\\sum \\vec{F}_{ext} = m \\cdot \\vec{a}_G = m \\frac{d\\vec{v}_G}{dt}',
        units: 'Forces en Newtons ($N$), $m$ en $kg$, $a$ en $m\\cdot s^{-2}$',
      },
      {
        name: 'Bilan des forces en chute verticale',
        latex: '\\vec{P} + \\vec{F}_A + \\vec{f} = m \\vec{a}',
        units: '$P = mg$, $F_A = \\rho_f V g$, $f = k v^n$',
      },
      {
        name: 'Équation différentielle de la vitesse',
        latex: '\\frac{dv}{dt} = A - B \\cdot v^n \\quad \\text{avec} \\quad A = g\\left(1 - \\frac{\\rho_f V}{m}\\right)',
        units: 'Si $v = 0$, $a_0 = A$. Si $t \\to \\infty$, $dv/dt = 0 \\implies v_{lim} = (A/B)^{1/n}$',
      },
      {
        name: 'Méthode d\'Euler (Algorithme)',
        latex: 'a_i = A - B v_i^n \\quad \\text{et} \\quad v_{i+1} = v_i + a_i \\cdot \\Delta t',
        units: '$\\Delta t$ est le pas de calcul (doit être $\\ll \\tau$)',
      },
      {
        name: 'Temps caractéristique',
        latex: '\\tau = \\frac{v_{lim}}{a_0}',
        units: '$\\tau$ déterminé par la tangente à l\'origine',
      },
    ],
    nationalChecklist: [
      'RÉDACTION OBLIGATOIRE DU NATIONAL : 1) Système étudié, 2) Référentiel galiléen, 3) Bilan des forces extérieures.',
      'Projeter la 2ème loi de Newton sur l\'axe vertical orienté vers le bas (attention aux signes de $\\vec{F}_A$ et $\\vec{f}$ !).',
      'Calculer une étape d\'Euler ($a_i$ puis $v_{i+1}$).',
    ],
    classicPitfalls: [
      'Oublier de préciser "supposé galiléen" pour le référentiel terrestre (pénalité systématique de 0.25 pt).',
      'Confondre la masse volumique du fluide $\\rho_f$ (dans la poussée d\'Archimède) et la masse volumique du corps $\\rho_s$.',
      'Oublier que $dv/dt = 0$ quand $v = v_{lim}$.',
    ],
    suggestedPrompt: 'Si Driss, rappelle-moi la structure de rédaction parfaite pour la 2ème loi de Newton au barème du National.',
  },
  {
    id: 'mouvements-plans',
    title: 'Mouvements plans : Projectiles & Particules chargées',
    subject: 'Physique',
    domain: 'Mécanique',
    weightInExam: '3.0 à 3.5 pts',
    summary: 'Mouvement dans un champ de pesanteur uniforme $\\vec{g}$ (équations horaires, trajectoire parabolique, portée, flèche) et mouvement d\'une particule chargée dans un champ électrostatique uniforme $\\vec{E}$.',
    keyFormulas: [
      {
        name: 'Accélération du projectile',
        latex: '\\vec{a} = \\vec{g} \\implies a_x = 0, \\quad a_y = -g',
        units: 'Chute libre (seul le poids agit)',
      },
      {
        name: 'Équations horaires du projectile',
        latex: 'x(t) = (v_0 \\cos\\alpha) t + x_0, \\quad y(t) = -\\frac{1}{2} g t^2 + (v_0 \\sin\\alpha) t + y_0',
        units: 'Intégration avec conditions initiales',
      },
      {
        name: 'Équation de la trajectoire',
        latex: 'y(x) = -\\frac{g}{2 v_0^2 \\cos^2\\alpha} x^2 + (\\tan\\alpha) x + y_0',
        units: 'Trajectoire parabolique',
      },
      {
        name: 'Force électrostatique',
        latex: '\\vec{F}_e = q \\cdot \\vec{E} \\implies \\vec{a} = \\frac{q}{m} \\vec{E}',
        units: '$E = \\frac{U}{d}$ en $V\\cdot m^{-1}$, $F_e$ en $N$',
      },
    ],
    nationalChecklist: [
      'Poser les conditions initiales à $t = 0$ pour $\\vec{OM}_0$ et $\\vec{v}_0$.',
      'Intégrer les composantes de $\\vec{a}$ pour trouver $\\vec{v}(t)$ puis $\\vec{OM}(t)$ en justifiant les constantes d\'intégration.',
      'Calculer la portée $x_P$ ($y=0$) ou la flèche $y_S$ ($v_y = 0$).',
    ],
    classicPitfalls: [
      'Inverser $\\cos\\alpha$ et $\\sin\\alpha$ dans les composantes de $\\vec{v}_0$.',
      'Oublier le signe de la charge $q$ (si électron, $q = -e < 0$, donc $\\vec{F}_e$ est opposée à $\\vec{E}$).',
    ],
    suggestedPrompt: 'Prof, comment calculer la portée et la flèche d\'un projectile étape par étape sans apprendre par cœur l\'équation finale ?',
  },
  {
    id: 'oscillateurs-mecaniques',
    title: 'Systèmes mécaniques oscillants & Aspects énergétiques',
    subject: 'Physique',
    domain: 'Mécanique',
    weightInExam: '3.0 à 4.0 pts',
    summary: 'Pendule élastique horizontal/vertical, pendule de torsion, pendule pesant et pendule simple. Étude dynamique (équations différentielles) et énergétique (énergie cinétique, potentielle élastique/pesanteur, conservation de l\'énergie mécanique).',
    keyFormulas: [
      {
        name: 'Force de rappel élastique',
        latex: '\\vec{T} = -k \\cdot \\Delta l \\cdot \\vec{i} = -k \\cdot x \\cdot \\vec{i}',
        units: '$k$ raideur du ressort en $N\\cdot m^{-1}$',
      },
      {
        name: 'Équation diff pendule élastique',
        latex: '\\ddot{x} + \\frac{k}{m} x = 0 \\implies T_0 = 2\\pi \\sqrt{\\frac{m}{k}}',
        units: '$T_0$ période propre en secondes',
      },
      {
        name: 'Pendule de torsion',
        latex: 'J_\\Delta \\ddot{\\theta} + C \\theta = 0 \\implies T_0 = 2\\pi \\sqrt{\\frac{J_\\Delta}{C}}',
        units: '$C$ constante de torsion en $N\\cdot m\\cdot rad^{-1}$',
      },
      {
        name: 'Énergie mécanique',
        latex: 'E_m = E_c + E_{pe} + E_{pp} = \\frac{1}{2} m \\dot{x}^2 + \\frac{1}{2} k x^2 + \\text{cte}',
        units: 'Sans frottements : $E_m = \\text{constante} \\implies \\frac{dE_m}{dt} = 0$',
      },
    ],
    nationalChecklist: [
      'Établir l\'équation différentielle par 2 méthodes : dynamique (2ème loi de Newton) et énergétique ($dE_m/dt = 0$).',
      'Exploiter les graphes $E_c(x), E_{pe}(x), E_m(x)$ pour trouver l\'amplitude $X_m$ et la vitesse maximale $V_{max}$.',
      'Vérifier l\'expression de la période propre par analyse dimensionnelle.',
    ],
    classicPitfalls: [
      'Confondre l\'énergie potentielle élastique $E_{pe} = \\frac{1}{2} k x^2 + C$ et de pesanteur $E_{pp} = mgz + C$.',
      'Dérivée de $x^2$ par rapport au temps : attention $\\frac{d(x^2)}{dt} = 2 x \\dot{x}$ !',
    ],
    suggestedPrompt: 'Si Driss, comment démontrer l\'équation différentielle du pendule élastique en utilisant la conservation de l\'énergie mécanique ?',
  },
  {
    id: 'rotation-solide-axe-fixe',
    title: 'Rotation d\'un solide indéformable autour d\'un axe fixe - Spécifique SM',
    subject: 'Physique',
    domain: 'Mécanique',
    branches: ['SM'],
    weightInExam: '2.5 à 3.5 pts',
    summary: 'Relation fondamentale de la dynamique en rotation autour d\'un axe fixe $\\Delta$ : $\\sum M_\\Delta(\\vec{F}) = J_\\Delta \\ddot{\\theta}$. Moment d\'une force $M_\\Delta(\\vec{F}) = \\pm F \\cdot d$, moment d\'inertie $J_\\Delta$, énergie cinétique de rotation $E_{c,rot} = \\frac{1}{2} J_\\Delta \\dot{\\theta}^2$, travail d\'un couple et théorème de l\'énergie cinétique.',
    keyFormulas: [
      {
        name: 'Relation fondamentale de la dynamique (RFD en rotation)',
        latex: '\\sum M_\\Delta(\\vec{F}_{ext}) = J_\\Delta \\cdot \\ddot{\\theta} = J_\\Delta \\cdot \\alpha',
        units: '$M_\\Delta$ en $N\\cdot m$, $J_\\Delta$ en $kg\\cdot m^2$, $\\ddot{\\theta}$ en $rad\\cdot s^{-2}$',
      },
      {
        name: 'Moment d\'une force orthogonale à l\'axe',
        latex: 'M_\\Delta(\\vec{F}) = \\pm F \\cdot d',
        units: '$d$ distance orthogonale entre l\'axe $\\Delta$ et la droite d\'action en $m$',
      },
      {
        name: 'Énergie cinétique de rotation',
        latex: 'E_{c,rot} = \\frac{1}{2} J_\\Delta \\dot{\\theta}^2 = \\frac{1}{2} J_\\Delta \\omega^2',
        units: '$E_{c}$ en Joules ($J$), $\\omega = \\dot{\\theta}$ en $rad\\cdot s^{-1}$',
      },
      {
        name: 'Travail d\'un moment ou couple constant',
        latex: 'W_{A \\to B}(M) = M_\\Delta \\cdot \\Delta\\theta',
        units: '$W$ en $J$, $\\Delta\\theta$ en radians ($rad$)',
      },
      {
        name: 'Théorème de l\'énergie cinétique en rotation',
        latex: '\\Delta E_c = \\frac{1}{2} J_\\Delta \\dot{\\theta}_f^2 - \\frac{1}{2} J_\\Delta \\dot{\\theta}_i^2 = \\sum W_{i \\to f}(\\vec{F}_{ext})',
        units: 'Applicable entre deux instants dans un référentiel galiléen',
      },
      {
        name: 'Puissance instantanée en rotation',
        latex: '\\mathcal{P} = M_\\Delta \\cdot \\dot{\\theta} = M_\\Delta \\cdot \\omega',
        units: '$\\mathcal{P}$ en Watts ($W$)',
      },
    ],
    nationalChecklist: [
      'Bien définir le sens positif de rotation choisi avant de calculer les moments des forces.',
      'Ne pas oublier que les forces dont la droite d\'action coupe l\'axe $\\Delta$ ou lui est parallèle ont un moment nul ($M_\\Delta(\\vec{R}) = 0$).',
      'Appliquer la RFD pour trouver l\'accélération angulaire $\\ddot{\\theta} = \\text{cste}$ (mouvement circulaire uniformément varié) et intégrer : $\\dot{\\theta}(t) = \\ddot{\\theta} t + \\dot{\\theta}_0$ et $\\theta(t) = \\frac{1}{2}\\ddot{\\theta}t^2 + \\dot{\\theta}_0 t + \\theta_0$.',
      'Associer un solide en translation et un solide en rotation (ex: fil inextensible sans glissement sur une poulie : $a = r \\cdot \\ddot{\\theta}$ et $v = r \\cdot \\dot{\\theta}$).',
    ],
    classicPitfalls: [
      'GROS PIÈGE SM : Oublier la relation de non-glissement du fil sur la poulie : $a = r \\cdot \\ddot{\\theta}$ !',
      'Erreur de signe sur le moment : vérifier si la force tend à faire tourner le solide dans le sens positif (+ ou -).',
      'Unité de $J_\\Delta$ : $kg\\cdot m^2$ (ne jamais la confondre avec un moment de force en $N\\cdot m$).',
    ],
    suggestedPrompt: 'Si Driss, montre-moi la méthode rigoureuse pour coupler un solide en translation et une poulie en rotation dans un sujet SM.',
  },
  {
    id: 'oscillations-mecaniques-forcees',
    title: 'Oscillations Mécaniques Forcées & Résonance Mécanique - Spécifique SM',
    subject: 'Physique',
    domain: 'Mécanique',
    branches: ['SM'],
    weightInExam: '2.0 à 3.0 pts',
    summary: 'Système oscillant soumis à une force excitatrice périodique $F(t) = F_m \\cos(\\omega t)$. Excitateur et résonateur, régime transitoire et permanent. Phénomène de résonance mécanique d\'amplitude et de vitesse, influence du frottement fluide sur l\'acuité.',
    keyFormulas: [
      {
        name: 'Équation différentielle en régime forcé',
        latex: 'm \\ddot{x} + h \\dot{x} + k x = F_m \\cos(\\omega t)',
        units: '$h$ coefficient de frottement fluide en $kg\\cdot s^{-1}$',
      },
      {
        name: 'Solution en régime sinusoïdal établi',
        latex: 'x(t) = X_m \\cos(\\omega t + \\varphi)',
        units: 'La fréquence du résonateur est égale à celle de l\'excitateur ($N = N_e$)',
      },
      {
        name: 'Fréquence de résonance d\'amplitude',
        latex: 'N_r = N_0 \\sqrt{1 - \\frac{h^2}{2 m k}} \\quad (\\text{si amortissement très faible, } N_r \\approx N_0)',
        units: '$N_0 = \\frac{1}{2\\pi}\\sqrt{\\frac{k}{m}}$ fréquence propre',
      },
      {
        name: 'Résonance de vitesse',
        latex: 'v_m \\text{ est maximale exactement à } \\omega = \\omega_0 = \\sqrt{\\frac{k}{m}}',
        units: 'À la résonance de vitesse : la vitesse et la force excitatrice sont en phase ($\\varphi_v = \\varphi_F$)',
      },
    ],
    nationalChecklist: [
      'Identifier l\'excitateur (qui impose la fréquence $N$) et le résonateur (qui oscille à la fréquence imposée $N$).',
      'Décrire le phénomène de résonance : amplitude $X_m$ maximale lorsque la fréquence de l\'excitateur est proche de la fréquence propre $N_0$.',
      'Expliquer l\'effet de l\'amortissement : quand $h$ augmente, l\'amplitude à la résonance diminue et le pic s\'aplatit (résonance floue).',
    ],
    classicPitfalls: [
      'Affirmer que la résonance a lieu à $N = N_0$ pour tout amortissement : pour l\'élongation $x$, $N_r < N_0$ dès qu\'il y a frottement !',
      'Confondre régime transitoire initial et régime permanent sinusoïdal établi.',
    ],
    suggestedPrompt: 'Prof, quelle est la différence exacte entre résonance d\'amplitude et résonance de vitesse pour les Sciences Maths ?',
  },
  {
    id: 'atome-bohr',
    title: 'L\'Atome et la Mécanique de Newton (Modèle de Bohr)',
    subject: 'Physique',
    domain: 'Mécanique & Quantique',
    weightInExam: '1.5 à 2.0 pts',
    summary: 'Insuffisance de la mécanique classique, quantification des niveaux d\'énergie de l\'atome d\'hydrogène, émission et absorption de photons, relation de Planck-Einstein $\\Delta E = h \\nu = h c / \\lambda$.',
    keyFormulas: [
      {
        name: 'Niveaux d\'énergie de l\'hydrogène',
        latex: 'E_n = -\\frac{E_0}{n^2} = -\\frac{13.6}{n^2} \\text{ eV}',
        units: '$n \\in \\mathbb{N}^*$ (entier quantique), $1\\text{ eV} = 1.602\\times 10^{-19}\\ J$',
      },
      {
        name: 'Relation de Planck-Einstein',
        latex: '|\\Delta E| = |E_p - E_n| = h \\cdot \\nu = \\frac{h \\cdot c}{\\lambda}',
        units: '$h = 6.626\\times 10^{-34}\\ J\\cdot s$, $\\lambda$ en $m$',
      },
      {
        name: 'Énergie d\'ionisation',
        latex: 'E_{ion} = E_\\infty - E_1 = 0 - (-13.6\\text{ eV}) = +13.6\\text{ eV}',
        units: 'Passage de l\'état fondamental $n=1$ à l\'état ionisé $n=\\infty$',
      },
    ],
    nationalChecklist: [
      'Distinguer émission d\'un photon (transition d\'un niveau haut vers un niveau bas) et absorption.',
      'Convertir les électron-volts ($eV$) en Joules ($J$) avant de calculer la longueur d\'onde $\\lambda$.',
    ],
    classicPitfalls: [
      'Oublier la conversion $eV \\leftrightarrow J$ : $1\\text{ eV} = 1.6\\times 10^{-19}\\ J$.',
      'Calculer $\\Delta E$ négatif et trouver une longueur d\'onde négative (utiliser la valeur absolue $|\\Delta E|$).',
    ],
    suggestedPrompt: 'Prof, comment calculer la longueur d\'onde émise lors de la transition de $n=3$ à $n=2$ (raie rouge $H_\\alpha$) ?',
  },

  // --- CHIMIE ---
  {
    id: 'cinetique-chimique',
    title: 'Transformations lentes et rapides & Facteurs cinétiques',
    subject: 'Chimie',
    domain: 'Cinétique Chimique',
    weightInExam: '2.5 à 3.0 pts',
    summary: 'Facteurs cinétiques (température, concentration des réactifs, catalyseur). Suivi temporel par spectrophotométrie (loi de Beer-Lambert), conductimétrie, pressiométrie, ou titrage. Vitesse volumique et temps de demi-réaction $t_{1/2}$.',
    keyFormulas: [
      {
        name: 'Vitesse volumique de réaction',
        latex: 'v(t) = \\frac{1}{V} \\frac{dx}{dt}',
        units: '$v$ en $mol\\cdot L^{-1}\\cdot s^{-1}$, $V$ volume du mélange réactionnel',
      },
      {
        name: 'Temps de demi-réaction t1/2',
        latex: 'x(t_{1/2}) = \\frac{x_f}{2} \\quad \\text{(ou } \\frac{x_{max}}{2} \\text{ si totale)}',
        units: 'Déterminé graphiquement sur la courbe $x(t)$',
      },
      {
        name: 'Loi de Beer-Lambert',
        latex: 'A = k \\cdot [X] = \\epsilon \\cdot l \\cdot [X]',
        units: '$A$ absorbance sans unité',
      },
      {
        name: 'Conductivité de la solution',
        latex: '\\sigma = \\sum \\lambda_i [X_i]',
        units: '$\\sigma$ en $S\\cdot m^{-1}$, attention $[X_i]$ en $mol\\cdot m^{-3}$ !',
      },
      {
        name: 'Équation des gaz parfaits',
        latex: 'P \\cdot V = n \\cdot R \\cdot T',
        units: '$P$ en $Pa$, $V$ en $m^3$, $T$ en $K$ ($T = \\theta + 273.15$)',
      },
    ],
    nationalChecklist: [
      'Dresser le tableau d\'avancement complet (initial, intermédiaire, final en moles).',
      'Établir la relation entre $x(t)$ et la grandeur mesurée ($A(t), \\sigma(t)$ ou $P(t)$).',
      'Calculer la vitesse $v$ à un instant $t$ par la pente de la tangente : $\\frac{dx}{dt} = \\frac{\\Delta x}{\\Delta t}$.',
      'Justifier la diminution de la vitesse volumique au cours du temps (diminution des concentrations des réactifs).',
    ],
    classicPitfalls: [
      'PIÈGE CONDUCTIMÉTRIE : Dans $\\sigma = \\sum \\lambda_i [X_i]$, les concentrations DOIVENT être converties en $mol\\cdot m^{-3}$ ($1\\ mol/L = 1000\\ mol/m^3$) !',
      'Oublier le volume total $V$ dans $v = \\frac{1}{V}\\frac{dx}{dt}$.',
      'Confondre $x_f$ et $x_{max}$ pour une réaction limitée.',
    ],
    suggestedPrompt: 'Si Driss, quelle est la méthode pour relier l\'avancement $x(t)$ à la conductivité $\\sigma(t)$ au National ?',
  },
  {
    id: 'acide-base-equilibre',
    title: 'Transformations non totales & Réactions acido-basiques',
    subject: 'Chimie',
    domain: 'Équilibre & Acido-basique',
    weightInExam: '3.5 à 4.5 pts',
    summary: 'Taux d\'avancement final $\\tau = x_f/x_{max}$, quotient de réaction $Q_r$, constante d\'équilibre $K$, produit ionique de l\'eau $K_e$, $pH$, constante d\'acidité $K_A$ et $pK_A$, diagramme de prédominance, dosage acido-basique (saut de pH, méthode des tangentes).',
    keyFormulas: [
      {
        name: 'Taux d\'avancement final',
        latex: '\\tau = \\frac{x_f}{x_{max}} \\quad (\\tau = 1 \\iff \\text{totale}, \\quad \\tau < 1 \\iff \\text{limitée})',
        units: '$\\tau$ sans unité (souvent en %)',
      },
      {
        name: 'Quotient de réaction Qr',
        latex: 'Q_r = \\frac{[C]^c [D]^d}{[A]^a [B]^b} \\quad (\\text{seuls les solutés aqueux figurent})',
        units: 'À l\'équilibre : $Q_{r,eq} = K$',
      },
      {
        name: 'pH et autoprotolyse',
        latex: 'pH = -\\log[H_3O^+] \\iff [H_3O^+] = 10^{-pH} \\quad \\text{et} \\quad K_e = [H_3O^+][HO^-] = 10^{-14}',
        units: 'À $25^\\circ\\text{C}$',
      },
      {
        name: 'Relation d\'Henderson-Hasselbalch',
        latex: 'pH = pK_A + \\log\\left( \\frac{[A^-]_{eq}}{[AH]_{eq}} \\right)',
        units: '$pK_A = -\\log K_A$',
      },
      {
        name: 'Relation à l\'équivalence du titrage',
        latex: 'C_A \\cdot V_A = C_B \\cdot V_{bE}',
        units: 'À l\'équivalence, les réactifs ont été mélangés en proportions stœchiométriques',
      },
      {
        name: 'Demi-équivalence',
        latex: '\\text{À } V_b = \\frac{V_{bE}}{2} : \\quad [AH] = [A^-] \\implies pH = pK_A',
        units: 'Zone tampon',
      },
    ],
    nationalChecklist: [
      'Démontrer l\'expression de $\\tau$ en fonction de $C$ et $pH$ (ex: $\\tau = 10^{-pH}/C$ pour un acide).',
      'Tracer et exploiter le diagramme de prédominance (si $pH > pK_A$, la base $A^-$ prédomine).',
      'Déterminer le point d\'équivalence $(V_{bE}, pH_E)$ par la méthode des tangentes parallèles ou par la dérivée $dpH/dV_b$.',
      'Justifier le choix de l\'indicateur coloré convenable (sa zone de virage doit englober $pH_E$).',
    ],
    classicPitfalls: [
      'Ne pas inclure l\'eau ou les solides dans le quotient de réaction $Q_r$ (leur activité vaut 1).',
      'Confondre constante d\'acidité $K_A$ (qui ne dépend que de la température) et taux d\'avancement $\\tau$ (qui dépend aussi de la concentration initiale $C$).',
    ],
    suggestedPrompt: 'Prof, comment prouver que $\\tau$ augmente avec la dilution d\'une solution acide ?',
  },
  {
    id: 'piles-electrolyse',
    title: 'Piles électrochimiques & Électrolyse (Transformations forcées)',
    subject: 'Chimie',
    domain: 'Électrochimie',
    weightInExam: '2.5 à 3.0 pts',
    summary: 'Critère d\'évolution spontanée ($Q_{r,i}$ comparé à $K$). Fonctionnement des piles, polarité des électrodes (anode = oxydation, cathode = réduction), pont salin. Quantité d\'électricité $Q = I \\Delta t = n(e^-) F$. Électrolyse (réactions forcées aux électrodes).',
    keyFormulas: [
      {
        name: 'Critère d\'évolution spontanée',
        latex: 'Q_{r,i} < K \\implies \\text{Sens direct (1)} \\quad | \\quad Q_{r,i} > K \\implies \\text{Sens inverse (2)}',
        units: 'Si $Q_{r,i} = K$, système à l\'équilibre',
      },
      {
        name: 'Moyen mnémotechnique officiel',
        latex: '\\text{Anode} \\leftrightarrow \\text{Oxydation (voyelles)} \\quad | \\quad \\text{Cathode} \\leftrightarrow \\text{Réduction (consonnes)}',
        units: 'Polarité : Anode $(-)$ et Cathode $(+)$ pour une pile',
      },
      {
        name: 'Quantité d\'électricité débitée',
        latex: 'Q = I \\cdot \\Delta t = n(e^-) \\cdot F',
        units: '$Q$ en Coulombs ($C$), $I$ en $A$, $\\Delta t$ en $s$, $F = 96500\\ C\\cdot mol^{-1}$',
      },
      {
        name: 'Masse déposée sur une électrode',
        latex: 'm = n \\cdot M = \\frac{n(e^-)}{z} M = \\frac{I \\cdot \\Delta t}{z \\cdot F} M',
        units: '$z$ nombre d\'électrons échangés par ion',
      },
    ],
    nationalChecklist: [
      'Déterminer le pôle positif et le pôle négatif de la pile à partir des équations ou du courant.',
      'Dresser le tableau d\'avancement de la réaction de fonctionnement de la pile.',
      'Relier la quantité d\'électrons $n(e^-)$ à l\'avancement $x$ ($n(e^-) = z \\cdot x$).',
      'Calculer la capacité maximale $Q_{max}$ ou la durée de vie maximale $\\Delta t_{max}$ quand un réactif s\'épuise.',
    ],
    classicPitfalls: [
      'Oublier de convertir la durée $\\Delta t$ en SECONDES (heures $\\times 3600$, minutes $\\times 60$) dans $Q = I \\cdot \\Delta t$ !',
      'Confondre la polarité en pile (Anode négative, Cathode positive) et en électrolyse (Anode reliée au pôle $+$ du générateur).',
    ],
    suggestedPrompt: 'Si Driss, comment calculer la durée de vie maximale d\'une pile sans se tromper sur $n(e^-)$ et le réactif limitant ?',
  },
  {
    id: 'chimie-organique-esters',
    title: 'Chimie Organique : Estérification, Hydrolyse & Saponification',
    subject: 'Chimie',
    domain: 'Chimie Organique',
    weightInExam: '2.0 à 2.5 pts',
    summary: 'Contrôle de l\'évolution des systèmes chimiques : réaction d\'estérification (acide carboxylique + alcool $\\rightleftharpoons$ ester + eau) et hydrolyse d\'un ester. Caractéristiques (lente, athermique, limitée). Amélioration du rendement (excès d\'un réactif, élimination de l\'eau). Estérification rapide et totale par anhydride d\'acide. Saponification (hydrolyse basique).',
    keyFormulas: [
      {
        name: 'Équation d\'estérification',
        latex: 'R-COOH + R\'-OH \\rightleftharpoons R-COO-R\' + H_2O',
        units: 'Caractéristiques : Lente, Athermique, Limitée',
      },
      {
        name: 'Rendement de la réaction',
        latex: 'r = \\frac{n_{\\text{exp}}(\\text{ester})}{n_{\\text{th}}(\\text{ester})} = \\frac{x_f}{x_{max}}',
        units: 'Mélange équimolaire : Alcool $I^\\circ \\implies r \\approx 67\\%$, Alcool $II^\\circ \\implies r \\approx 60\\%$, Alcool $III^\\circ \\implies r \\approx 5\\%$',
      },
      {
        name: 'Constante d\'équilibre de l\'estérification',
        latex: 'K = \\frac{[\\text{ester}]_{eq} [\\text{eau}]_{eq}}{[\\text{acide}]_{eq} [\\text{alcool}]_{eq}} = \\frac{x_f^2}{(n_0 - x_f)^2} = 4 \\quad (\\text{pour alcool } I^\\circ)',
        units: 'ATTENTION : L\'eau est un produit et figure dans $K$ !',
      },
      {
        name: 'Synthèse par anhydride d\'acide',
        latex: '(R-CO)_2O + R\'-OH \\longrightarrow R-COO-R\' + R-COOH',
        units: 'Réaction RAPIDE et TOTALE ($r = 100\\%$)',
      },
      {
        name: 'Saponification (Hydrolyse basique)',
        latex: 'R-COO-R\' + HO^- \\longrightarrow R-COO^- + R\'-OH',
        units: 'Réaction LENTE mais TOTALE (fabrication de savon)',
      },
    ],
    nationalChecklist: [
      'Nommer correctement les composés selon la nomenclature IUPAC (acide ...oïque, alcan-x-ol, ...oate de ...yle, anhydride ...oïque).',
      'Identifier la classe de l\'alcool (primaire, secondaire, tertiaire) et en déduire le rendement limite.',
      'Citer les méthodes pour augmenter le rendement (utiliser un réactif en excès, éliminer l\'eau par appareil de Dean-Stark, utiliser un anhydride d\'acide).',
      'Citer les méthodes pour augmenter la vitesse sans changer l\'état final (chauffage à reflux, ajout d\'un catalyseur comme $H_2SO_4$).',
    ],
    classicPitfalls: [
      'GROS PIÈGE DU NATIONAL : Dans l\'estérification, l\'EAU N\'EST PAS LE SOLVANT ! Elle intervient comme réactif/produit et DOIT figurer dans le quotient $K$ !',
      'Confondre un facteur cinétique (chauffage, catalyseur qui augmentent seulement la vitesse) et une méthode qui augmente le RENDEMENT.',
    ],
    suggestedPrompt: 'Prof, quelle est la différence entre améliorer la cinétique et améliorer le rendement d\'une estérification ?',
  },
];
