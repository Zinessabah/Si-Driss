export interface NationalQuestion {
  id: string;
  number: string;
  points: number;
  text: string;
  subQuestions?: string[];
  socraticHint: string;
  expectedStructure: {
    systemAndFrame?: string;
    literalFormula: string;
    unitAndValue: string;
  };
  sampleAnswer: string;
}

export interface NationalExercise {
  id: string;
  title: string;
  session: string;
  domain: 'Physique' | 'Chimie';
  chapter: string;
  totalPoints: number;
  recommendedDuration: string; // e.g. "45 min"
  statementIntro: string;
  givenData: { label: string; value: string; unit: string }[];
  diagramDescription?: string;
  questions: NationalQuestion[];
  professorTrapAlert: string;
}

export const NATIONAL_EXERCISES: NationalExercise[] = [
  {
    id: 'nat-meca-chute-projectiles',
    title: 'Mécanique : Chute verticale dans l\'huile & Saut d\'un motard',
    session: 'Inspiré Session Normale 2023 (PC BIOF)',
    domain: 'Physique',
    chapter: 'Lois de Newton & Chute avec frottement',
    totalPoints: 5.5,
    recommendedDuration: '50 min',
    statementIntro: `On étudie le mouvement vertical d'une bille en acier de masse $m = 20.0\\text{ g}$ et de rayon $r = 1.00\\text{ cm}$ abandonnée sans vitesse initiale dans une éprouvette remplie d'huile visqueuse. La bille subit son poids $\\vec{P}$, la poussée d'Archimède $\\vec{F}_A$ et une force de frottement fluide $\\vec{f} = -k \\cdot v \\cdot \\vec{j}$. L'axe vertical $(Oz)$ est orienté vers le bas.`,
    givenData: [
      { label: 'Masse de la bille m', value: '20.0', unit: 'g = 20.0 \\times 10^{-3}\\text{ kg}' },
      { label: 'Masse volumique de l\'huile rho', value: '900', unit: '\\text{kg}\\cdot \\text{m}^{-3}' },
      { label: 'Intensité de pesanteur g', value: '9.80', unit: '\\text{m}\\cdot \\text{s}^{-2}' },
      { label: 'Volume de la bille V', value: '4.19 \\times 10^{-6}', unit: '\\text{m}^3' },
    ],
    professorTrapAlert: 'Attention impardonnable : Si tu oublies de définir le système étudié et de préciser "référentiel terrestre supposé galiléen" au tout début, le correcteur national te coupe immédiatement 0.25 pt !',
    questions: [
      {
        id: 'q1',
        number: '1.1',
        points: 1.0,
        text: 'En appliquant la deuxième loi de Newton dans le référentiel terrestre supposé galiléen, établir l\'équation différentielle vérifiée par la vitesse $v(t)$ du centre d\'inertie de la bille sous la forme : $$\\frac{dv}{dt} + \\frac{1}{\\tau} v = A$$ Préciser les expressions de $A$ et de $\\tau$ en fonction de $m, g, V, \\rho$ et $k$.',
        socraticHint: 'Avant toute équation, quel est ton système étudié ? Quelles sont les 3 forces qui s\'exercent sur la bille ? Selon l\'axe vertical orienté vers le bas, quels sont les signes respectifs des projections de ces trois forces ?',
        expectedStructure: {
          systemAndFrame: 'Système : {Bille de masse m}. Référentiel : Terrestre, supposé galiléen. Bilan des forces : Poids P (vers le bas), Poussée d\'Archimède FA (vers le haut), Frottement fluide f (vers le haut).',
          literalFormula: 'P - F_A - f = m \\frac{dv}{dt} \\implies mg - \\rho V g - kv = m \\frac{dv}{dt}',
          unitAndValue: 'dv/dt + (k/m) v = g(1 - (rho*V)/m) avec A = g(1 - (rho*V)/m) et tau = m/k',
        },
        sampleAnswer: `1. Système étudié : {Bille d'acier de masse m}
2. Référentiel d'étude : Terrestre supposé galiléen, muni de l'axe vertical (Oz) descendant de vecteur unitaire $\\vec{k}$.
3. Bilan des forces extérieures appliquées :
   - Le poids de la bille : $\\vec{P} = m \\cdot g \\cdot \\vec{k}$
   - La poussée d'Archimède : $\\vec{F}_A = -\\rho \\cdot V \\cdot g \\cdot \\vec{k}$
   - La force de frottement fluide : $\\vec{f} = -k \\cdot v \\cdot \\vec{k}$
4. Application de la 2ème loi de Newton :
   $$\\sum \\vec{F}_{ext} = m \\cdot \\vec{a}_G \\iff \\vec{P} + \\vec{F}_A + \\vec{f} = m \\cdot \\frac{d\\vec{v}}{dt}$$
5. Projection sur l'axe $(Oz)$ descendant :
   $$P - F_A - f = m \\frac{dv}{dt} \\iff m g - \\rho V g - k v = m \\frac{dv}{dt}$$
   En divisant par $m$ :
   $$\\frac{dv}{dt} + \\frac{k}{m} v = g\\left(1 - \\frac{\\rho V}{m}\\right)$$
   Par identification avec $\\frac{dv}{dt} + \\frac{1}{\\tau} v = A$ :
   $$A = g\\left(1 - \\frac{\\rho V}{m}\\right) \\quad \\text{et} \\quad \\tau = \\frac{m}{k}$$`,
      },
      {
        id: 'q2',
        number: '1.2',
        points: 0.75,
        text: 'Déduire l\'expression de la vitesse limite $v_{lim}$ en fonction de $A$ et $\\tau$. Sachant que la courbe expérimentale donne $v_{lim} = 1.60\\text{ m}\\cdot\\text{s}^{-1}$ et $A = 7.95\\text{ m}\\cdot\\text{s}^{-2}$, calculer la valeur du coefficient de frottement $k$.',
        socraticHint: 'Que devient la dérivée $\\frac{dv}{dt}$ lorsque la bille atteint sa vitesse limite (régime permanent) ? Que vaut alors $v$ dans l\'équation différentielle ?',
        expectedStructure: {
          literalFormula: 'En régime permanent, v = v_lim = constante => dv/dt = 0. Donc 0 + v_lim / tau = A => v_lim = A * tau = A * (m / k). D\'où k = (m * A) / v_lim.',
          unitAndValue: 'k = (20.0e-3 * 7.95) / 1.60 = 0.0994 kg/s (ou N.s/m).',
        },
        sampleAnswer: `En régime permanent ($t \\to \\infty$), la vitesse devient constante égale à sa valeur limite $v_{lim}$.
Donc : $$\\frac{dv}{dt} = 0$$
L'équation différentielle devient :
$$0 + \\frac{1}{\\tau} v_{lim} = A \\implies v_{lim} = A \\cdot \\tau = A \\cdot \\frac{m}{k}$$
On en déduit l'expression littérale du coefficient $k$ :
$$k = \\frac{m \\cdot A}{v_{lim}}$$
Application numérique (avec les unités SI : $m = 20.0\\times 10^{-3}\\text{ kg}$) :
$$k = \\frac{20.0\\times 10^{-3}\\times 7.95}{1.60} = 9.94 \\times 10^{-2}\\text{ kg}\\cdot\\text{s}^{-1} \\quad (\\text{ou } \\text{N}\\cdot\\text{s}\\cdot\\text{m}^{-1})$$`,
      },
      {
        id: 'q3',
        number: '1.3',
        points: 1.0,
        text: 'La méthode d\'Euler avec un pas $\\Delta t = 0.020\\text{ s}$ donne à l\'instant $t_i$ une vitesse $v_i = 0.85\\text{ m}\\cdot\\text{s}^{-1}$. Calculer l\'accélération $a_i$ à cet instant, puis estimer la vitesse $v_{i+1}$ à l\'instant $t_{i+1} = t_i + \\Delta t$.',
        socraticHint: 'Quelles sont les deux équations fondamentales de l\'algorithme d\'Euler ? Comment $a_i$ est-elle reliée à $v_i$ via l\'équation différentielle, et comment $v_{i+1}$ se déduit-il de $a_i$ et $\\Delta t$ ?',
        expectedStructure: {
          literalFormula: 'a_i = A - (k/m) * v_i = A - (v_i / tau) puis v_{i+1} = v_i + a_i * Delta t',
          unitAndValue: 'a_i = 7.95 - (0.85 / 0.201) = 3.72 m/s^2; v_{i+1} = 0.85 + 3.72 * 0.020 = 0.92 m/s.',
        },
        sampleAnswer: `1. Calcul de l'accélération $a_i$ à l'instant $t_i$ :
D'après l'équation différentielle :
$$a_i = \\left(\\frac{dv}{dt}\\right)_i = A - \\frac{1}{\\tau} v_i = A - \\frac{k}{m} v_i$$
Or $\\frac{1}{\\tau} = \\frac{A}{v_{lim}} = \\frac{7.95}{1.60} = 4.97\\text{ s}^{-1}$.
$$a_i = 7.95 - 4.97 \\times 0.85 = 7.95 - 4.22 = 3.73\\text{ m}\\cdot\\text{s}^{-2}$$

2. Calcul de la vitesse $v_{i+1}$ selon la méthode d'Euler :
$$v_{i+1} = v_i + a_i \\cdot \\Delta t$$
Application numérique :
$$v_{i+1} = 0.85 + 3.73 \\times 0.020 = 0.85 + 0.0746 = 0.92\\text{ m}\\cdot\\text{s}^{-1}$$`,
      },
    ],
  },
  {
    id: 'nat-elec-rlc-am',
    title: 'Électricité : Circuit RLC série & Modulation d\'amplitude AM',
    session: 'Inspiré Session Normale 2022 (PC BIOF)',
    domain: 'Physique',
    chapter: 'Circuit RLC série & Modulation AM',
    totalPoints: 5.0,
    recommendedDuration: '45 min',
    statementIntro: `Un circuit comprend un condensateur de capacité $C = 2.0\\,\\mu\\text{F}$ préalablement chargé sous une tension $E = 6.0\\text{ V}$, relié en série à une bobine d'inductance $L$ et de résistance interne $r = 10\\,\\Omega$, et un conducteur ohmique de résistance variable $R$. À $t = 0$, on ferme le circuit. On observe des oscillations pseudo-périodiques sur l'oscilloscope.`,
    givenData: [
      { label: 'Capacité C', value: '2.0', unit: '\\mu\\text{F} = 2.0 \\times 10^{-6}\\text{ F}' },
      { label: 'Tension initiale E', value: '6.0', unit: '\\text{V}' },
      { label: 'Résistance de la bobine r', value: '10', unit: '\\Omega' },
      { label: 'Pseudo-période mesurée T', value: '2.81', unit: '\\text{ms} = 2.81 \\times 10^{-3}\\text{ s}' },
    ],
    professorTrapAlert: 'Piège classique de la modulation AM : Pour qu\'il n\'y ait pas d\'inversion d\'enveloppe (surmodulation), la tension d\'offset $U_0$ doit être strictement supérieure à l\'amplitude du signal $S_m$, ce qui équivaut à $m < 1$ !',
    questions: [
      {
        id: 'q-elec-1',
        number: '2.1',
        points: 1.0,
        text: 'En appliquant la loi d\'additivité des tensions, établir l\'équation différentielle vérifiée par la tension $u_C(t)$ aux bornes du condensateur.',
        socraticHint: 'Quelles sont les tensions dans la maille ? Quel est le lien entre $i(t)$ et $u_C(t)$ ? Que vaut la tension $u_L$ aux bornes de la bobine réelle ?',
        expectedStructure: {
          literalFormula: 'u_C + u_L + u_R = 0 avec u_L = L di/dt + r i et u_R = R i, et i = C du_C/dt. Donc d^2u_C/dt^2 + ((R+r)/L) du_C/dt + (1/LC) u_C = 0.',
          unitAndValue: 'Équation du 2nd ordre sans second membre.',
        },
        sampleAnswer: `1. En convention récepteur pour tous les dipôles passifs :
Loi d'additivité des tensions :
$$u_C(t) + u_L(t) + u_R(t) = 0$$
2. Expressions des tensions :
$$u_R = R \\cdot i$$
$$u_L = L \\frac{di}{dt} + r \\cdot i$$
3. Relation intensité-tension pour le condensateur :
$$i(t) = \\frac{dq}{dt} = C \\frac{du_C}{dt}$$
$$\\frac{di}{dt} = C \\frac{d^2u_C}{dt^2}$$
4. En remplaçant dans la loi d'additivité :
$$u_C + L \\left(C \\frac{d^2u_C}{dt^2}\\right) + (R + r) \\left(C \\frac{du_C}{dt}\\right) = 0$$
En divisant toute l'équation par $LC$ :
$$\\frac{d^2 u_C}{dt^2} + \\frac{R + r}{L} \\frac{du_C}{dt} + \\frac{1}{LC} u_C = 0$$`,
      },
      {
        id: 'q-elec-2',
        number: '2.2',
        points: 1.0,
        text: 'En assimilant la pseudo-période $T$ à la période propre $T_0$, déterminer la valeur de l\'inductance $L$ de la bobine. Prendre $\\pi^2 = 10$.',
        socraticHint: 'Quelle est la relation entre $T_0$, $L$ et $C$ ? Isole littéralement $L$ avant de faire l\'application numérique !',
        expectedStructure: {
          literalFormula: 'T approx T_0 = 2*pi*sqrt(L*C) => T^2 = 4*pi^2*L*C => L = T^2 / (4*pi^2*C)',
          unitAndValue: 'L = (2.81e-3)^2 / (4 * 10 * 2.0e-6) = 7.90e-6 / 8.0e-5 = 0.0988 H approx 0.10 H = 100 mH.',
        },
        sampleAnswer: `Pour un faible amortissement, la pseudo-période $T$ est pratiquement égale à la période propre $T_0$ :
$$T \\approx T_0 = 2\\pi \\sqrt{LC}$$
En élevant au carré :
$$T^2 = 4 \\pi^2 L C$$
On isole l'inductance $L$ sous forme d'expression littérale :
$$L = \\frac{T^2}{4 \\pi^2 C}$$
Application numérique (avec $T = 2.81 \\times 10^{-3}\\text{ s}$, $C = 2.0 \\times 10^{-6}\\text{ F}$ et $\\pi^2 = 10$) :
$$L = \\frac{(2.81 \\times 10^{-3})^2}{4 \\times 10 \\times 2.0 \\times 10^{-6}} = \\frac{7.896 \\times 10^{-6}}{8.0 \\times 10^{-5}} \\approx 0.0987\\text{ H} \\approx 98.7\\text{ mH}$$`,
      },
      {
        id: 'q-elec-3',
        number: '2.3',
        points: 1.0,
        text: 'Modulation AM : Un oscillogramme du signal modulé en amplitude donne $U_{max} = 4.2\\text{ V}$ et $U_{min} = 1.4\\text{ V}$. Calculer le taux de modulation $m$. La modulation est-elle de bonne qualité ? Justifier.',
        socraticHint: 'Quelle est la relation qui relie $m$ aux valeurs de crête $U_{max}$ et de creux $U_{min}$ de l\'enveloppe ? Quelle est la condition sur $m$ pour éviter l\'inversion de phase ?',
        expectedStructure: {
          literalFormula: 'm = (U_max - U_min) / (U_max + U_min)',
          unitAndValue: 'm = (4.2 - 1.4) / (4.2 + 1.4) = 2.8 / 5.6 = 0.50. Comme m = 0.50 < 1, la modulation est de bonne qualité sans surmodulation.',
        },
        sampleAnswer: `1. Expression littérale du taux de modulation $m$ à partir des extremums de la tension modulée :
$$m = \\frac{U_{max} - U_{min}}{U_{max} + U_{min}}$$
2. Application numérique :
$$m = \\frac{4.2 - 1.4}{4.2 + 1.4} = \\frac{2.8}{5.6} = 0.50$$
3. Conclusion et justification :
Puisque $m = 0.50 < 1$, il n'y a pas d'inversion d'enveloppe (pas de surmodulation).
La modulation est donc de très bonne qualité.`,
      },
    ],
  },
  {
    id: 'nat-chimie-dosage-ka',
    title: 'Chimie : Titrage de l\'acide éthanoïque & Détermination du pKa',
    session: 'Inspiré Session Rattrapage 2024 (PC BIOF)',
    domain: 'Chimie',
    chapter: 'Réactions acido-basiques & Dosage',
    totalPoints: 7.0,
    recommendedDuration: '55 min',
    statementIntro: `On dose un volume $V_A = 20.0\\text{ mL}$ d'une solution aqueuse d'acide éthanoïque $CH_3COOH$ de concentration molaire apportée $C_A$ inconnue par une solution aqueuse d'hydroxyde de sodium $(Na^+_{(aq)} + HO^-_{(aq)})$ de concentration $C_B = 1.00 \\times 10^{-1}\\text{ mol}\\cdot\\text{L}^{-1}$. Le suivi pH-métrique donne le volume équivalent $V_{bE} = 15.0\\text{ mL}$ et $pH_E = 8.75$.`,
    givenData: [
      { label: 'Volume acide V_A', value: '20.0', unit: '\\text{mL} = 20.0 \\times 10^{-3}\\text{ L}' },
      { label: 'Concentration base C_B', value: '0.100', unit: '\\text{mol}\\cdot\\text{L}^{-1}' },
      { label: 'Volume équivalent V_bE', value: '15.0', unit: '\\text{mL}' },
      { label: 'pH à l\'équivalence', value: '8.75', unit: 'sans unité' },
      { label: 'Produit ionique de l\'eau Ke', value: '1.00 \\times 10^{-14}', unit: '\\text{à } 25^\\circ\\text{C}' },
    ],
    professorTrapAlert: 'Règle d\'or du National en chimie : Ne saute JAMAIS l\'équation du titrage avec simple flèche (réaction totale). Et au point de demi-équivalence ($V_b = V_{bE}/2$), rappelle que $[AH] = [A^-]$, ce qui justifie $pH = pK_A$ !',
    questions: [
      {
        id: 'q-ch-1',
        number: '1.1',
        points: 0.75,
        text: 'Écrire l\'équation de la réaction du dosage. Quelles sont ses caractéristiques obligatoires ?',
        socraticHint: 'Quels sont les deux couples acido-basiques en présence ? L\'hydroxyde de sodium est-il une base forte ? Quel symbole de flèche utilise-t-on pour un dosage ?',
        expectedStructure: {
          literalFormula: 'CH_3COOH_(aq) + HO^-_(aq) -> CH_3COO^-_(aq) + H_2O_(l)',
          unitAndValue: 'Réaction rapide, totale (quasi-totale) et univoque.',
        },
        sampleAnswer: `1. Équation chimique du titrage :
$$CH_3COOH_{(aq)} + HO^-_{(aq)} \\longrightarrow CH_3COO^-_{(aq)} + H_2O_{(l)}$$
2. Caractéristiques essentielles de la réaction de dosage :
Elle doit être :
- Rapide
- Totale (ou quasi-totale, flèche unique $\\longrightarrow$)
- Unique (pas de réactions parasites compétitives).`,
      },
      {
        id: 'q-ch-2',
        number: '1.2',
        points: 1.0,
        text: 'Définir l\'équivalence acido-basique et en déduire la valeur numérique de la concentration $C_A$ de l\'acide éthanoïque.',
        socraticHint: 'Que signifie l\'équivalence en termes de quantités de matière des réactifs ? Pose la formule littérale avant d\'effectuer le calcul.',
        expectedStructure: {
          literalFormula: 'À l\'équivalence, n_initial(acide) = n_versé(base) <=> C_A * V_A = C_B * V_bE => C_A = (C_B * V_bE) / V_A',
          unitAndValue: 'C_A = (0.100 * 15.0) / 20.0 = 0.075 mol/L = 7.50 * 10^-2 mol.L^-1.',
        },
        sampleAnswer: `1. Définition de l'équivalence :
L'équivalence acido-basique est l'état du système où les réactifs titrant ($HO^-$) et titré ($CH_3COOH$) ont été mélangés dans les proportions stœchiométriques de l'équation bilan. Les deux réactifs sont alors entièrement consommés.

2. Relation à l'équivalence :
$$n_i(CH_3COOH) = n_E(HO^-) \\iff C_A \\cdot V_A = C_B \\cdot V_{bE}$$
3. Expression littérale :
$$C_A = \\frac{C_B \\cdot V_{bE}}{V_A}$$
4. Application numérique :
$$C_A = \\frac{0.100 \\times 15.0}{20.0} = 7.50 \\times 10^{-2}\\text{ mol}\\cdot\\text{L}^{-1}$$`,
      },
      {
        id: 'q-ch-3',
        number: '1.3',
        points: 1.25,
        text: 'À l\'ajout d\'un volume $V_b = 7.5\\text{ mL}$, le pH mesuré vaut $4.8$. Montrer qu\'à ce stade particulier, $[CH_3COOH] = [CH_3COO^-]$ et déduire la valeur du $pK_A$ du couple $CH_3COOH / CH_3COO^-$.',
        socraticHint: 'Que représente $V_b = 7.5\\text{ mL}$ par rapport à $V_{bE} = 15.0\\text{ mL}$ ? Quel est le nom de ce point remarquable ? Que donne la formule d\'Henderson-Hasselbalch lorsque $[A^-] = [AH]$ ?',
        expectedStructure: {
          literalFormula: 'V_b = V_bE / 2 correspond à la demi-équivalence. À cet instant, la moitié de l\'acide a été transformée en base conjuguée : [AH] = [A^-]. Comme pH = pK_A + log([A^-]/[AH]) => pH = pK_A + log(1) = pK_A.',
          unitAndValue: 'pK_A = 4.8.',
        },
        sampleAnswer: `1. Constat :
Le volume versé $V_b = 7.5\\text{ mL} = \\frac{V_{bE}}{2}$. Ce point correspond au point de demi-équivalence.

2. Démonstration :
D'après le tableau d'avancement avant l'équivalence :
- Quantité d'acide restant : $n(CH_3COOH) = C_A \\cdot V_A - x$
- Quantité d'ions acétate formés : $n(CH_3COO^-) = x$
À la demi-équivalence, $x = \\frac{x_E}{2} = \\frac{C_A \\cdot V_A}{2}$.
Par conséquent :
$$n(CH_3COOH) = C_A \\cdot V_A - \\frac{C_A \\cdot V_A}{2} = \\frac{C_A \\cdot V_A}{2}$$
$$n(CH_3COO^-) = \\frac{C_A \\cdot V_A}{2}$$
Les deux espèces sont dans le même volume total $V_T = V_A + V_b$, donc :
$$[CH_3COOH] = [CH_3COO^-]$$

3. Déduction du $pK_A$ :
D'après la relation d'Henderson-Hasselbalch :
$$pH = pK_A + \\log\\left(\\frac{[CH_3COO^-]}{[CH_3COOH]}\\right)$$
Comme le rapport des concentrations vaut 1 et $\\log(1) = 0$ :
$$pH = pK_A + 0 \\implies pK_A = pH = 4.8$$`,
      },
    ],
  },
  {
    id: 'nat-elec-rc-charge-decharge',
    title: 'Électricité : Dipôle RC - Charge, constante de temps et énergie emmagasinée',
    session: 'Inspiré Session Normale 2023 (PC BIOF)',
    domain: 'Physique',
    chapter: 'Dipôle RC',
    totalPoints: 5.0,
    recommendedDuration: '45 min',
    statementIntro: `Un circuit électrique série comprend un générateur idéal de tension continue de force électromotrice $E = 6.0\\text{ V}$, un conducteur ohmique de résistance $R = 1.0\\text{ k}\\Omega$, un condensateur de capacité $C$ initialement déchargé et un interrupteur $K$. À $t = 0$, on ferme l'interrupteur $K$. L'acquisition informatique permet de tracer l'évolution de la tension $u_C(t)$ aux bornes du condensateur.`,
    givenData: [
      { label: 'Force électromotrice E', value: '6.0', unit: '\\text{V}' },
      { label: 'Résistance du conducteur R', value: '1000', unit: '\\Omega = 1.0\\text{ k}\\Omega' },
      { label: 'Constante de temps mesurée tau', value: '20', unit: '\\text{ms} = 2.0 \\times 10^{-2}\\text{ s}' },
    ],
    professorTrapAlert: 'Attention à l\'analyse dimensionnelle de $\\tau = RC$ : N\'écris pas seulement le résultat par cœur ! Tu dois dériver de $u_R = R i$ et $i = C \\frac{du_C}{dt}$ pour prouver rigoureusement que $[R][C] = [T]$.',
    questions: [
      {
        id: 'q-rc-1',
        number: '1.1',
        points: 1.0,
        text: 'En précisant la convention récepteur, établir l\'équation différentielle vérifiée par la tension $u_C(t)$ lors de la charge du condensateur.',
        socraticHint: 'Quelle est la loi fondamentale des mailles ? Exprime la tension $u_R$ aux bornes du conducteur ohmique en fonction de $u_C$ via $i = C \\frac{du_C}{dt}$.',
        expectedStructure: {
          literalFormula: 'u_R + u_C = E avec u_R = R * i et i = C du_C/dt => R*C du_C/dt + u_C = E',
          unitAndValue: 'Equation du 1er ordre avec second membre constant.',
        },
        sampleAnswer: `1. En convention récepteur pour le condensateur et le conducteur ohmique :
Loi d'additivité des tensions :
$$u_R(t) + u_C(t) = E$$
2. Loi d'Ohm pour le résistor :
$$u_R(t) = R \\cdot i(t)$$
3. Relation intensité-tension du condensateur :
$$i(t) = \\frac{dq}{dt} = C \\frac{du_C}{dt}$$
4. En reportant dans la loi d'additivité :
$$R \\cdot C \\frac{du_C}{dt} + u_C(t) = E$$`,
      },
      {
        id: 'q-rc-2',
        number: '1.2',
        points: 1.25,
        text: 'Par analyse dimensionnelle, montrer que le produit $\\tau = RC$ est homogène à un temps. Déduire la valeur de la capacité $C$ du condensateur sachant que $\\tau = 20\\text{ ms}$.',
        socraticHint: 'Que vaut $[R]$ en fonction de $[U]$ et $[I]$ ? Que vaut $[C]$ en fonction de $[I]$, $[T]$ et $[U]$ ? Fais le produit $[R] \\times [C]$.',
        expectedStructure: {
          literalFormula: '[R] = [U]/[I] et [C] = [I][T]/[U] => [RC] = [T]. C = tau / R.',
          unitAndValue: 'C = 20e-3 / 1000 = 2.0e-5 F = 20 microFarads.',
        },
        sampleAnswer: `1. Analyse dimensionnelle de $\\tau = R \\cdot C$ :
- D'après la loi d'Ohm $u = R \\cdot i$ : $[R] = \\frac{[U]}{[I]}$
- D'après la relation $i = C \\frac{du}{dt}$ : $[C] = \\frac{[I] \\cdot [T]}{[U]}$
En effectuant le produit :
$$[\\tau] = [R] \\cdot [C] = \\frac{[U]}{[I]} \\times \\frac{[I] \\cdot [T]}{[U]} = [T]$$
Donc $\\tau$ a bien la dimension d'un temps (son unité SI est la seconde $\\text{s}$).

2. Calcul de la capacité $C$ :
$$C = \\frac{\\tau}{R} = \\frac{20 \\times 10^{-3}\\text{ s}}{1000\\,\\Omega} = 2.0 \\times 10^{-5}\\text{ F} = 20\\,\\mu\\text{F}$$`,
      },
      {
        id: 'q-rc-3',
        number: '1.3',
        points: 1.0,
        text: 'Calculer l\'énergie électrique maximale $E_{e,max}$ emmagasinée par le condensateur en régime permanent.',
        socraticHint: 'Quelle est la formule littérale de l\'énergie électrique emmagasinée dans un condensateur ? Que vaut la tension à ses bornes en régime permanent ?',
        expectedStructure: {
          literalFormula: 'E_e = 1/2 * C * E^2',
          unitAndValue: 'E_e = 0.5 * 20e-6 * (6.0)^2 = 3.6e-4 Joules = 0.36 mJ.',
        },
        sampleAnswer: `En régime permanent ($t \\ge 5\\tau$), la tension aux bornes du condensateur atteint sa valeur maximale $u_C = E = 6.0\\text{ V}$.
L'expression de l'énergie électrique emmagasinée est :
$$E_{e,max} = \\frac{1}{2} C E^2$$
Application numérique :
$$E_{e,max} = \\frac{1}{2} \\times (20 \\times 10^{-6}\\text{ F}) \\times (6.0\\text{ V})^2 = 3.6 \\times 10^{-4}\\text{ J} = 0.36\\text{ mJ}$$`,
      },
    ],
  },
  {
    id: 'nat-nucl-c14-datation',
    title: 'Nucléaire : Décroissance radioactive du Carbone 14 & Datation archéologique',
    session: 'Inspiré Session Normale 2021 (PC BIOF)',
    domain: 'Physique',
    chapter: 'Décroissance radioactive & Datation',
    totalPoints: 4.5,
    recommendedDuration: '40 min',
    statementIntro: `Le carbone 14 ($^{14}_6\\text{C}$) est un isotope radioactif de période radioactive (demi-vie) $t_{1/2} = 5730\\text{ ans}$. Dans un organisme vivant, la proportion de carbone 14 reste constante. À sa mort, les échanges avec le milieu extérieur cessent et le carbone 14 se désintègre en azote 14 ($^{14}_7\\text{N}$) par émission $\\beta^-$. On mesure dans un fragment de charbon de bois archéologique une activité $A(t)$ égale à $25\\%$ de l'activité $A_0$ d'un échantillon actuel de même masse.`,
    givenData: [
      { label: 'Demi-vie t_1/2', value: '5730', unit: '\\text{ans}' },
      { label: 'Rapport d\'activité A(t)/A_0', value: '0.25', unit: 'sans unité' },
    ],
    professorTrapAlert: 'Pour la loi de désintégration, exprime toujours $t$ en fonction de $t_{1/2}$ et non d\'une valeur arrondie de $\\lambda$, pour éviter l\'accumulation d\'erreurs d\'arrondi !',
    questions: [
      {
        id: 'q-nucl-1',
        number: '1.1',
        points: 1.0,
        text: 'Écrire l\'équation de la désintégration du carbone 14 en précisant les lois de conservation utilisées.',
        socraticHint: 'Quelles sont les deux lois de conservation de Soddy (nombre de charge $Z$ et nombre de masse $A$) ? Quelle est la particule émise lors d\'une désintégration $\\beta^-$ ?',
        expectedStructure: {
          literalFormula: '^{14}_6 C -> ^{14}_7 N + ^0_{-1} e',
          unitAndValue: 'Lois de Soddy : conservation de A (14 = 14 + 0) et de Z (6 = 7 - 1).',
        },
        sampleAnswer: `Équation de la réaction nucléaire de désintégration :
$$^{14}_{6}\\text{C} \\longrightarrow ^{14}_{7}\\text{N} + ^{0}_{-1}\\text{e}$$
D'après les lois de conservation de Soddy :
- Conservation du nombre total de nucléons (nombre de masse $A$) : $14 = 14 + 0$
- Conservation de la charge électrique totale (nombre de charge $Z$) : $6 = 7 + (-1) = 6$
La particule émise est un électron $^{0}_{-1}\\text{e}$ (rayonnement $\\beta^-$).`,
      },
      {
        id: 'q-nucl-2',
        number: '1.2',
        points: 1.25,
        text: 'Donner la définition de la demi-vie radioactive $t_{1/2}$ et établir la relation entre $t_{1/2}$ et la constante radioactive $\\lambda$.',
        socraticHint: 'Que vaut le nombre de noyaux restants $N(t)$ à l\'instant $t = t_{1/2}$ en fonction du nombre initial $N_0$ ? Applique la loi $N(t) = N_0 e^{-\\lambda t}$.',
        expectedStructure: {
          literalFormula: 'N(t_1/2) = N_0/2 => e^(-lambda * t_1/2) = 1/2 => lambda = ln(2)/t_1/2',
          unitAndValue: 't_1/2 = ln(2) / lambda.',
        },
        sampleAnswer: `1. Définition officielle :
La demi-vie $t_{1/2}$ est la durée au bout de laquelle la moitié des noyaux radioactifs initialement présents dans l'échantillon se sont désintégrés.

2. Établissement de la relation :
À $t = t_{1/2}$, $N(t_{1/2}) = \\frac{N_0}{2}$.
D'après la loi de décroissance radioactive $N(t) = N_0 e^{-\\lambda t}$ :
$$\\frac{N_0}{2} = N_0 e^{-\\lambda t_{1/2}} \\iff e^{-\\lambda t_{1/2}} = \\frac{1}{2}$$
En prenant le logarithme népérien des deux membres :
$$-\\lambda t_{1/2} = \\ln\\left(\\frac{1}{2}\\right) = -\\ln 2$$
D'où l'expression littérale :
$$t_{1/2} = \\frac{\\ln 2}{\\lambda} \\iff \\lambda = \\frac{\\ln 2}{t_{1/2}}$$`,
      },
      {
        id: 'q-nucl-3',
        number: '1.3',
        points: 1.25,
        text: 'Déterminer l\'âge $t$ du fragment de charbon de bois.',
        socraticHint: 'Comment l\'activité $A(t)$ est-elle reliée au temps ? Rappelle que $A(t) = A_0 e^{-\\lambda t}$. Remarque que $0.25 = (1/2)^2$ !',
        expectedStructure: {
          literalFormula: 'A(t)/A_0 = e^(-lambda*t) => t = -ln(A/A_0) / lambda = ln(A_0/A) * t_1/2 / ln(2). Ou t = 2 * t_1/2.',
          unitAndValue: 't = 2 * 5730 = 11460 ans.',
        },
        sampleAnswer: `Loi d'évolution de l'activité au cours du temps :
$$A(t) = A_0 e^{-\\lambda t} \\iff \\frac{A(t)}{A_0} = e^{-\\lambda t}$$
Méthode directe :
On sait que $\\frac{A(t)}{A_0} = 0.25 = \\frac{1}{4} = \\left(\\frac{1}{2}\\right)^2$.
Chaque durée égale à $t_{1/2}$ divise l'activité par 2 :
- À $t = t_{1/2}$, $A = \\frac{A_0}{2}$
- À $t = 2 t_{1/2}$, $A = \\frac{A_0}{4} = 0.25 A_0$
Donc :
$$t = 2 \\times t_{1/2} = 2 \\times 5730\\text{ ans} = 11\\,460\\text{ ans}$$

Vérification littérale générale :
$$t = -\\frac{\\ln\\left(\\frac{A(t)}{A_0}\\right)}{\\lambda} = -\\frac{\\ln(0.25)}{\\frac{\\ln 2}{t_{1/2}}} = \\frac{\\ln 4}{\\ln 2} \\times 5730 = 2 \\times 5730 = 11\\,460\\text{ ans}$$
Le bois archéologique est âgé d'environ **11 460 ans**.`,
      },
    ],
  },
  {
    id: 'nat-ondes-diffraction-laser',
    title: 'Ondes : Diffraction de la lumière par une fente fine & Mesure de longueur d\'onde',
    session: 'Inspiré Session Normale 2022 (PC BIOF)',
    domain: 'Physique',
    chapter: 'Diffraction de la lumière',
    totalPoints: 4.0,
    recommendedDuration: '35 min',
    statementIntro: `On réalise la diffraction d'un faisceau laser rouge monochromatique de longueur d'onde dans le vide $\\lambda$ à travers une fente rectiligne verticale de largeur $a$. On observe sur un écran situé à la distance $D = 2.00\\text{ m}$ de la fente une figure formée de taches lumineuses horizontales. La largeur de la tache centrale de diffraction est $L = 2.50\\text{ cm}$.`,
    givenData: [
      { label: 'Distance fente-écran D', value: '2.00', unit: '\\text{m}' },
      { label: 'Largeur tache centrale L', value: '2.50', unit: '\\text{cm} = 2.50 \\times 10^{-2}\\text{ m}' },
      { label: 'Longueur d\'onde laser lambda', value: '632.8', unit: '\\text{nm} = 6.328 \\times 10^{-7}\\text{ m}' },
    ],
    professorTrapAlert: 'Piège classique : La tache centrale a une largeur angulaire égale à $2\\theta$, donc $\\tan(\\theta) \\approx \\theta = \\frac{L/2}{D} = \\frac{L}{2D}$. Ne divise jamais directement par $D$ sans le facteur 2 !',
    questions: [
      {
        id: 'q-ondes-1',
        number: '1.1',
        points: 0.75,
        text: 'Quel aspect de la lumière est mis en évidence par le phénomène de diffraction ?',
        socraticHint: 'La lumière se comporte-t-elle comme un ensemble de corpuscules ou comme une onde lors de ce phénomène ?',
        expectedStructure: {
          literalFormula: 'Aspect ondulatoire de la lumière.',
          unitAndValue: 'La diffraction prouve la nature ondulatoire.',
        },
        sampleAnswer: `Le phénomène de diffraction met en évidence l'**aspect ondulatoire** de la lumière (la lumière est une onde électromagnétique).`,
      },
      {
        id: 'q-ondes-2',
        number: '1.2',
        points: 1.25,
        text: 'Établir l\'expression littérale de la largeur $L$ de la tache centrale en fonction de $\\lambda$, $D$ et $a$.',
        socraticHint: 'Quelle est la relation entre l\'écart angulaire $\\theta$, $\\lambda$ et $a$ ? Et pour de petits angles, comment exprime-t-on $\\theta$ en fonction de la largeur $L$ et de la distance $D$ ?',
        expectedStructure: {
          literalFormula: 'theta = lambda / a et theta approx tan(theta) = (L/2)/D = L / (2D) => L = (2 * lambda * D) / a',
          unitAndValue: 'L en mètres.',
        },
        sampleAnswer: `1. Écart angulaire de diffraction :
$$\\theta = \\frac{\\lambda}{a}$$
avec $\\theta$ en radians ($\\text{rad}$), $\\lambda$ en mètres ($\\text{m}$) et $a$ en mètres ($\\text{m}$).

2. Relation géométrique :
Dans le triangle rectangle formé par le milieu de la fente et la demi-tache centrale :
$$\\tan\\theta = \\frac{\\frac{L}{2}}{D} = \\frac{L}{2D}$$
Pour les petits angles ($\\theta \\ll 1\\text{ rad}$) : $\\tan\\theta \\approx \\theta$.
D'où :
$$\\theta \\approx \\frac{L}{2D}$$

3. En égalisant les deux expressions :
$$\\frac{\\lambda}{a} = \\frac{L}{2D} \\iff L = \\frac{2 \\lambda D}{a}$$`,
      },
      {
        id: 'q-ondes-3',
        number: '1.3',
        points: 1.0,
        text: 'Calculer la largeur $a$ de la fente.',
        socraticHint: 'Isole littéralement $a$ à partir de $L = \\frac{2\\lambda D}{a}$, puis convertis $L$ et $\\lambda$ en unités SI.',
        expectedStructure: {
          literalFormula: 'a = (2 * lambda * D) / L',
          unitAndValue: 'a = (2 * 632.8e-9 * 2.00) / (2.50e-2) = 1.01e-4 m = 0.101 mm.',
        },
        sampleAnswer: `Expression littérale de la largeur $a$ de la fente :
$$a = \\frac{2 \\lambda D}{L}$$
Application numérique (avec les unités SI) :
- $\\lambda = 632.8\\text{ nm} = 6.328 \\times 10^{-7}\\text{ m}$
- $D = 2.00\\text{ m}$
- $L = 2.50\\text{ cm} = 2.50 \\times 10^{-2}\\text{ m}$

$$a = \\frac{2 \\times 6.328 \\times 10^{-7} \\times 2.00}{2.50 \\times 10^{-2}} = \\frac{2.5312 \\times 10^{-6}}{2.50 \\times 10^{-2}} \\approx 1.01 \\times 10^{-4}\\text{ m} = 0.101\\text{ mm} = 101\\,\\mu\\text{m}$$`,
      },
    ],
  },
];

