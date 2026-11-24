export interface TrapItem {
  id: string;
  category: 'Mécanique' | 'Électricité' | 'Chimie' | 'Ondes & Nucléaire' | 'Rédaction Générale';
  title: string;
  branches?: ('PC' | 'SM')[];
  penaltyEstimate: string; // e.g. "-0.25 pt"
  trapDescription: string;
  badDraft: string;
  correctDraft: string;
  siDrissTip: string;
}

export const NATIONAL_PITFALLS: TrapItem[] = [
  {
    id: 'trap-1',
    category: 'Mécanique',
    title: 'Omission du "Référentiel Terrestre supposé Galiléen"',
    penaltyEstimate: '-0.25 pt à chaque problème de mécanique',
    trapDescription: 'Beaucoup d\'élèves écrivent directement "D\'après la 2ème loi de Newton : $\\sum \\vec{F} = m\\vec{a}$" sans énoncer le système et le référentiel d\'étude.',
    badDraft: 'On applique la 2ème loi de Newton : P + f = m.a',
    correctDraft: '1. Système étudié : {solide S de masse m}\n2. Référentiel : Terrestre, supposé galiléen\n3. Bilan des forces : Le poids P et la force de frottement f\n4. D\'après la 2ème loi de Newton : $\\sum \\vec{F}_{ext} = m \\vec{a}_G$',
    siDrissTip: 'Lah yerdi 3lik, cette phrase introductive est un réflexe automatique ! 0.25 pt gratuit ne se refuse jamais dans un National serré.',
  },
  {
    id: 'trap-2',
    category: 'Électricité',
    title: 'Sauter la loi d\'additivité des tensions avant l\'équation différentielle',
    penaltyEstimate: '-0.25 pt à -0.5 pt',
    trapDescription: 'Écrire l\'équation différentielle directement de mémoire sans poser la maille avec le fléchage récepteur et la loi d\'additivité.',
    badDraft: 'L\'équation différentielle est : $u_C + RC \\frac{du_C}{dt} = E$',
    correctDraft: 'En convention récepteur : $u_R(t) + u_C(t) = E$\nOr d\'après la loi d\'Ohm : $u_R = R \\cdot i$\nEt la relation du condensateur : $i = \\frac{dq}{dt} = C \\frac{du_C}{dt}$\nOn obtient : $u_C + R C \\frac{du_C}{dt} = E$',
    siDrissTip: 'Le correcteur note la déduction logique de la physique, pas la mémoire brute ! Explicite la loi d\'additivité systématiquement.',
  },
  {
    id: 'trap-3',
    category: 'Chimie',
    title: 'L\'eau dans le quotient de réaction de l\'estérification',
    penaltyEstimate: '-0.5 pt (fausse tout le problème d\'organique)',
    trapDescription: 'En solution aqueuse, l\'eau est le solvant donc son activité vaut 1. MAIS dans l\'estérification sans solvant, l\'eau est un PRODUIT de réaction et doit obligatoirement figurer dans $Q_r$ et $K$ !',
    badDraft: '$K = \\frac{[ester]_{eq}}{[acide]_{eq}[alcool]_{eq}}$',
    correctDraft: '$K = \\frac{[ester]_{eq} \\cdot [eau]_{eq}}{[acide]_{eq} \\cdot [alcool]_{eq}} = \\frac{n_{eq}(ester) \\cdot n_{eq}(eau)}{n_{eq}(acide) \\cdot n_{eq}(alcool)}$',
    siDrissTip: '3andak had l-piège fatal ! Dans l\'estérification, l\'eau n\'est pas un spectateur ni un solvant, c\'est un produit à part entière.',
  },
  {
    id: 'trap-4',
    category: 'Chimie',
    title: 'Unités dans la loi de Kohlrausch (Conductimétrie)',
    penaltyEstimate: '-0.5 pt sur le calcul de la vitesse ou de l\'avancement',
    trapDescription: 'Dans $\\sigma = \\sum \\lambda_i [X_i]$, si $\\lambda$ est en $S\\cdot m^2\\cdot mol^{-1}$ et $\\sigma$ en $S\\cdot m^{-1}$, la concentration $[X_i]$ DOIT être en $mol\\cdot m^{-3}$ et NON en $mol\\cdot L^{-1}$ !',
    badDraft: 'On remplace directement $[H_3O^+] = 10^{-pH} = 10^{-3.2}\\text{ mol/L}$ dans $\\sigma = \\lambda [H_3O^+]$',
    correctDraft: '$[H_3O^+] = 10^{-pH}\\text{ mol}\\cdot\\text{L}^{-1} = 10^{-pH} \\times 10^3\\text{ mol}\\cdot\\text{m}^{-3}$\nDonc $[H_3O^+] = 10^{3 - pH}\\text{ mol}\\cdot\\text{m}^{-3}$',
    siDrissTip: 'Rappel vital : $1\\text{ m}^3 = 1000\\text{ L}$. Donc $1\\text{ mol}\\cdot\\text{L}^{-1} = 1000\\text{ mol}\\cdot\\text{m}^{-3}$. Multiplie toujours par $10^3$ !',
  },
  {
    id: 'trap-5',
    category: 'Électricité',
    title: 'Période des courbes d\'énergie dans le circuit RLC',
    penaltyEstimate: '-0.5 pt sur l\'exploitation de l\'oscillogramme',
    trapDescription: 'Confondre la pseudo-période des oscillations de la tension $u_C(t)$ (notée $T$) et la période temporelle des échanges d\'énergie $\\mathcal{T}_{\\text{énergie}}$.',
    badDraft: 'Sur la courbe d\'énergie $E_e(t)$, la période est $T = 4\\text{ ms}$, donc $T_0 = 4\\text{ ms}$',
    correctDraft: 'L\'énergie magnétique ou électrique oscille deux fois plus vite : $\\mathcal{T}_{\\text{énergie}} = \\frac{T}{2}$.\nDonc la pseudo-période des tensions vaut $T = 2 \\times \\mathcal{T}_{\\text{énergie}} = 2 \\times 4\\text{ ms} = 8\\text{ ms}$.',
    siDrissTip: 'Comme l\'énergie dépend de $u_C^2$ ou de $i^2$, elle s\'annule deux fois au cours d\'une période d\'oscillation ! Retiens : $\\mathcal{T}_{énergie} = T/2$.',
  },
  {
    id: 'trap-6',
    category: 'Ondes & Nucléaire',
    title: 'Demi-angle de diffraction $\\theta$ et largeur de la tache centrale',
    penaltyEstimate: '-0.25 pt à -0.5 pt',
    trapDescription: 'Écrire $\\tan\\theta = \\frac{L}{D}$ au lieu de $\\frac{L}{2D}$. $L$ est la largeur COMPLÈTE de la tache centrale, alors que $\\theta$ correspond au DEMI-écart angulaire.',
    badDraft: 'Pour les petits angles : $\\theta \\approx \\frac{L}{D} = \\frac{\\lambda}{a}$',
    correctDraft: '$\\theta$ est le demi-écart angulaire : $\\tan \\theta \\approx \\theta = \\frac{L/2}{D} = \\frac{L}{2D}$.\nComme $\\theta = \\frac{\\lambda}{a}$, on obtient : $\\frac{L}{2D} = \\frac{\\lambda}{a} \\implies L = \\frac{2 \\lambda D}{a}$.',
    siDrissTip: 'Fais toujours un petit schéma clair sur ta feuille de brouillon avec la fente, l\'écran et le triangle rectangle d\'angle $\\theta$.',
  },
  {
    id: 'trap-7',
    category: 'Électricité',
    title: 'Condition de détection d\'enveloppe en modulation AM',
    branches: ['PC'],
    penaltyEstimate: '-0.5 pt sur la question spécifique PC',
    trapDescription: 'Oublier la double inégalité imposée sur la constante de temps $\\tau = RC$ du filtre passe-bas détecteur d\'enveloppe.',
    badDraft: 'Il faut simplement $\\tau = RC < T_s$',
    correctDraft: 'La constante de temps $\\tau = RC$ doit vérifier : $T_p \\ll \\tau < T_s \\iff \\frac{1}{F_p} \\ll RC < \\frac{1}{f_s}$.\nSi $\\tau \\le T_p$, l\'onde porteuse HF n\'est pas éliminée.\nSi $\\tau \\ge T_s$, la décharge est trop lente et la tension ne suit plus l\'enveloppe BF.',
    siDrissTip: 'C\'est la question fétiche des jurys PC ! $T_p \\ll \\tau < T_s$ avec la justification physique des deux cas limites.',
  },
  {
    id: 'trap-8',
    category: 'Rédaction Générale',
    title: 'Application numérique sans formule littérale',
    penaltyEstimate: '-50% des points de la question',
    trapDescription: 'Remplacer immédiatement par les valeurs numériques sans avoir préalablement isolé la grandeur recherchée sous forme littérale.',
    badDraft: 'm = (20 * 9.8 * (1 - 900*4.19e-6/20e-3)) / 1.60 = 0.099',
    correctDraft: 'Expression littérale : $k = \\frac{m \\cdot A}{v_{lim}}$\nApplication numérique avec les unités SI : $k = \\frac{20.0 \\times 10^{-3} \\times 7.95}{1.60} = 9.94 \\times 10^{-2}\\text{ kg}\\cdot\\text{s}^{-1}$',
    siDrissTip: 'La Règle d\'Or absolue : Formule littérale d\'abord, substitution numérique avec conversion SI ensuite, résultat encadré avec son unité et ses CS !',
  },
  {
    id: 'trap-sm-1',
    category: 'Mécanique',
    title: 'Condition de non-glissement en rotation (Spécifique SM)',
    branches: ['SM'],
    penaltyEstimate: '-0.5 pt sur le couplage translation-rotation',
    trapDescription: 'Oublier la relation fondamentale cinématique $a = R \\cdot \\ddot{\\theta}$ reliant l\'accélération linéaire du solide suspendu et l\'accélération angulaire de la poulie.',
    badDraft: 'On applique la RFD sans relier theta_seconde à a',
    correctDraft: 'Par condition de non-glissement du fil sur la poulie de rayon $R$ : $v(t) = R \\cdot \\dot{\\theta}(t) \\implies a(t) = R \\cdot \\ddot{\\theta}(t)$.',
    siDrissTip: 'Pour les Sciences Maths : Ce lien cinématique est le verrou qui permet d\'éliminer la tension du fil entre les deux équations !',
  },
  {
    id: 'trap-sm-2',
    category: 'Électricité',
    title: 'Largeur de bande passante à -3 dB en résonance forcé (Spécifique SM)',
    branches: ['SM'],
    penaltyEstimate: '-0.5 pt sur la résonance RLC',
    trapDescription: 'Définir la bande passante avec $I = I_0 / 2$ au lieu de $I = I_0 / \\sqrt{2} \\approx 0.707 I_0$. C\'est la puissance qui est divisée par 2 ($P = P_{max}/2$), donc l\'intensité efficace est divisée par $\\sqrt{2}$.',
    badDraft: 'La bande passante correspond à I = I_0 / 2',
    correctDraft: 'La bande passante à $-3\\text{ dB}$ est l\'intervalle de fréquences $[N_1, N_2]$ pour lequel : $I \\ge \\frac{I_0}{\\sqrt{2}} \\iff P \\ge \\frac{P_{max}}{2}$. Sa largeur est $\\Delta N = N_2 - N_1 = \\frac{N_0}{Q}$.',
    siDrissTip: 'Attention piège classique du National SM ! Division par $\\sqrt{2} \\approx 1.414$ pour l\'intensité, et par 2 pour la puissance.',
  },
];
