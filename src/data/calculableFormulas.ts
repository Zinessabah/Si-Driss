export interface FormulaVariable {
  symbol: string;
  label: string;
  unit: string;
  defaultVal: number;
  placeholder?: string;
  step?: number;
  min?: number;
  options?: { label: string; factor: number }[]; // optional unit choices, e.g. Ω vs kΩ
}

export interface CalculableFormula {
  id: string;
  name: string;
  domain: 'Ondes' | 'Nucléaire' | 'Électricité' | 'Mécanique' | 'Chimie';
  branches?: ('PC' | 'SM')[];
  latex: string;
  targetSymbol: string;
  targetUnit: string;
  description: string;
  examNote?: string;
  variables: FormulaVariable[];
  compute: (inputs: Record<string, number>) => {
    value: number;
    formatted: string;
    scientific: string;
    unit: string;
    substitutionLatex: string;
  };
}

export const CALCULABLE_FORMULAS: CalculableFormula[] = [
  // --- ONDES ---
  {
    id: 'ondes-celerite',
    name: "Célérité d'une onde (v = d / Δt)",
    domain: 'Ondes',
    latex: 'v = \\frac{d}{\\Delta t}',
    targetSymbol: 'v',
    targetUnit: 'm/s',
    description: "Vitesse de propagation de la perturbation sur une distance d pendant la durée Δt.",
    examNote: "Vérifiez que d est bien en mètres et Δt en secondes.",
    variables: [
      { symbol: 'd', label: 'Distance parcourue (d)', unit: 'm', defaultVal: 1.2, step: 0.1, min: 0.0001 },
      { symbol: 'dt', label: 'Durée ou retard (Δt)', unit: 's', defaultVal: 0.04, step: 0.005, min: 0.000001 }
    ],
    compute: (inputs) => {
      const v = inputs.d / inputs.dt;
      return {
        value: v,
        formatted: `${v >= 100 ? v.toFixed(1) : v.toFixed(3)} m·s⁻¹`,
        scientific: `${v.toExponential(2).replace('e+', ' \\times 10^{').replace('e-', ' \\times 10^{-')}}\\text{ m}\\cdot\\text{s}^{-1}`,
        unit: 'm·s⁻¹',
        substitutionLatex: `v = \\frac{${inputs.d}}{${inputs.dt}} = ${v >= 100 ? v.toFixed(1) : v.toFixed(3)}\\text{ m}\\cdot\\text{s}^{-1}`
      };
    }
  },
  {
    id: 'ondes-longueur-onde',
    name: 'Longueur d’onde (λ = v / N)',
    domain: 'Ondes',
    latex: '\\lambda = \\frac{v}{N} = v \\cdot T',
    targetSymbol: '\\lambda',
    targetUnit: 'm',
    description: 'Périodicité spatiale en fonction de la célérité v et de la fréquence N.',
    examNote: 'Au National, convertir souvent le résultat en cm ou mm.',
    variables: [
      { symbol: 'v', label: 'Célérité (v)', unit: 'm/s', defaultVal: 20, step: 1, min: 0.001 },
      { symbol: 'N', label: 'Fréquence (N)', unit: 'Hz', defaultVal: 50, step: 5, min: 0.1 }
    ],
    compute: (inputs) => {
      const lambda = inputs.v / inputs.N;
      const lambdaCm = (lambda * 100).toFixed(2);
      return {
        value: lambda,
        formatted: `${lambda.toFixed(4)} m (${lambdaCm} cm)`,
        scientific: `${lambda.toExponential(2).replace('e+', ' \\times 10^{').replace('e-', ' \\times 10^{-')}}\\text{ m}`,
        unit: 'm',
        substitutionLatex: `\\lambda = \\frac{${inputs.v}}{${inputs.N}} = ${lambda.toFixed(4)}\\text{ m} = ${lambdaCm}\\text{ cm}`
      };
    }
  },
  {
    id: 'ondes-diffraction-fente',
    name: 'Écart angulaire de diffraction (θ = λ / a)',
    domain: 'Ondes',
    latex: '\\theta = \\frac{\\lambda}{a} = \\frac{L}{2D}',
    targetSymbol: '\\theta',
    targetUnit: 'rad',
    description: "Écart angulaire pour une fente ou fil de largeur a éclairé par un faisceau laser de longueur d'onde λ.",
    examNote: "Attention aux ordres de grandeur : λ est en nm (10⁻⁹ m) et a en μm (10⁻⁶ m).",
    variables: [
      { symbol: 'lambda_nm', label: 'Longueur d’onde laser (λ)', unit: 'nm', defaultVal: 632.8, step: 10, min: 100 },
      { symbol: 'a_um', label: 'Largeur de la fente/fil (a)', unit: 'µm', defaultVal: 80, step: 5, min: 1 }
    ],
    compute: (inputs) => {
      const lamM = inputs.lambda_nm * 1e-9;
      const aM = inputs.a_um * 1e-6;
      const theta = lamM / aM;
      return {
        value: theta,
        formatted: `${(theta * 1000).toFixed(3)} mrad (${theta.toExponential(2)} rad)`,
        scientific: `${theta.toExponential(2).replace('e+', ' \\times 10^{').replace('e-', ' \\times 10^{-')}}\\text{ rad}`,
        unit: 'rad',
        substitutionLatex: `\\theta = \\frac{${inputs.lambda_nm} \\cdot 10^{-9}}{${inputs.a_um} \\cdot 10^{-6}} = ${(theta * 1000).toFixed(2)} \\cdot 10^{-3}\\text{ rad}`
      };
    }
  },

  // --- NUCLÉAIRE ---
  {
    id: 'nucleaire-demi-vie',
    name: 'Constante radioactive & Demi-vie (t₁/₂ = ln(2) / λ)',
    domain: 'Nucléaire',
    latex: 't_{1/2} = \\frac{\\ln(2)}{\\lambda} \\quad \\iff \\quad \\lambda = \\frac{\\ln(2)}{t_{1/2}}',
    targetSymbol: 't_{1/2}',
    targetUnit: 'jours / ans / s',
    description: 'Calcul de la demi-vie t1/2 à partir de la constante radioactive λ.',
    examNote: 'Vérifiez la concordance d’unité entre λ et t1/2 (ex: jours⁻¹ vs jours).',
    variables: [
      { symbol: 'lambda', label: 'Constante radioactive (λ)', unit: 's⁻¹', defaultVal: 1.42e-11, step: 1e-12, min: 1e-25 }
    ],
    compute: (inputs) => {
      const tHalfSec = Math.LN2 / inputs.lambda;
      const years = tHalfSec / (365.25 * 86400);
      const days = tHalfSec / 86400;
      let displayTime = '';
      if (years >= 1) {
        displayTime = `${years >= 100 ? years.toFixed(0) : years.toFixed(2)} ans`;
      } else if (days >= 1) {
        displayTime = `${days.toFixed(2)} jours`;
      } else {
        displayTime = `${tHalfSec.toFixed(1)} s`;
      }
      return {
        value: tHalfSec,
        formatted: displayTime,
        scientific: `${tHalfSec.toExponential(2).replace('e+', ' \\times 10^{').replace('e-', ' \\times 10^{-')}}\\text{ s}`,
        unit: 's',
        substitutionLatex: `t_{1/2} = \\frac{\\ln(2)}{${inputs.lambda.toExponential(2)}} = ${tHalfSec.toExponential(2)}\\text{ s} \\approx ${displayTime}`
      };
    }
  },
  {
    id: 'nucleaire-decroissance',
    name: 'Loi de décroissance radioactive (N(t) = N₀ · e^(-λt))',
    domain: 'Nucléaire',
    latex: 'N(t) = N_0 \\cdot e^{-\\lambda t}',
    targetSymbol: 'N(t)',
    targetUnit: 'noyaux',
    description: 'Nombre de noyaux radioactifs restants à l’instant t.',
    examNote: 'Le produit λ · t doit être sans dimension.',
    variables: [
      { symbol: 'N0', label: 'Nombre initial (N₀)', unit: 'noyaux', defaultVal: 1e20, step: 1e19, min: 1 },
      { symbol: 'lambda', label: 'Constante radioactive (λ)', unit: 'an⁻¹ ou s⁻¹', defaultVal: 0.12, step: 0.01, min: 0.000001 },
      { symbol: 't', label: 'Durée écoulée (t)', unit: 'même unité que 1/λ', defaultVal: 5, step: 0.5, min: 0 }
    ],
    compute: (inputs) => {
      const n = inputs.N0 * Math.exp(-inputs.lambda * inputs.t);
      const percentLeft = ((n / inputs.N0) * 100).toFixed(2);
      return {
        value: n,
        formatted: `${n.toExponential(3)} noyaux (${percentLeft}% restant)`,
        scientific: `${n.toExponential(2).replace('e+', ' \\times 10^{').replace('e-', ' \\times 10^{-')}}\\text{ noyaux}`,
        unit: 'noyaux',
        substitutionLatex: `N(${inputs.t}) = ${inputs.N0.toExponential(1)} \\cdot e^{-${inputs.lambda} \\times ${inputs.t}} = ${n.toExponential(2)} \\text{ (${percentLeft}\\%)}`
      };
    }
  },

  // --- ÉLECTRICITÉ ---
  {
    id: 'electricite-rc-tau',
    name: 'Constante de temps RC (τ = R · C)',
    domain: 'Électricité',
    latex: '\\tau = R \\cdot C',
    targetSymbol: '\\tau',
    targetUnit: 's',
    description: 'Temps caractéristique de charge ou décharge d’un dipôle RC.',
    examNote: 'À t = τ, la tension u_C atteint 63% de sa valeur max (ou 37% en décharge). Régime permanent à 5τ.',
    variables: [
      { symbol: 'R_ohm', label: 'Résistance (R)', unit: 'Ω', defaultVal: 1000, step: 50, min: 0.1 },
      { symbol: 'C_uF', label: 'Capacité (C)', unit: 'µF', defaultVal: 47, step: 1, min: 0.0001 }
    ],
    compute: (inputs) => {
      const r = inputs.R_ohm;
      const c = inputs.C_uF * 1e-6;
      const tau = r * c;
      const tauMs = (tau * 1000).toFixed(3);
      return {
        value: tau,
        formatted: `${tauMs} ms (${tau.toFixed(5)} s)`,
        scientific: `${tau.toExponential(2).replace('e+', ' \\times 10^{').replace('e-', ' \\times 10^{-')}}\\text{ s}`,
        unit: 's',
        substitutionLatex: `\\tau = ${r}\\ \\Omega \\times (${inputs.C_uF} \\cdot 10^{-6}\\text{ F}) = ${tauMs}\\text{ ms}`
      };
    }
  },
  {
    id: 'electricite-rl-tau',
    name: 'Constante de temps RL (τ = L / R_T)',
    domain: 'Électricité',
    latex: '\\tau = \\frac{L}{R + r}',
    targetSymbol: '\\tau',
    targetUnit: 's',
    description: 'Temps caractéristique d’établissement du courant dans une bobine.',
    examNote: 'Ne pas oublier la résistance interne r de la bobine : R_T = R + r !',
    variables: [
      { symbol: 'L_mH', label: 'Inductance bobine (L)', unit: 'mH', defaultVal: 150, step: 10, min: 0.1 },
      { symbol: 'R_ohm', label: 'Résistance conducteur (R)', unit: 'Ω', defaultVal: 40, step: 5, min: 0 },
      { symbol: 'r_ohm', label: 'Résistance interne bobine (r)', unit: 'Ω', defaultVal: 10, step: 1, min: 0 }
    ],
    compute: (inputs) => {
      const l = inputs.L_mH * 1e-3;
      const rt = inputs.R_ohm + inputs.r_ohm;
      const tau = l / rt;
      const tauMs = (tau * 1000).toFixed(3);
      return {
        value: tau,
        formatted: `${tauMs} ms (${tau.toFixed(5)} s)`,
        scientific: `${tau.toExponential(2).replace('e+', ' \\times 10^{').replace('e-', ' \\times 10^{-')}}\\text{ s}`,
        unit: 's',
        substitutionLatex: `\\tau = \\frac{${inputs.L_mH} \\cdot 10^{-3}}{${inputs.R_ohm} + ${inputs.r_ohm}} = \\frac{${(l).toFixed(4)}}{${rt}} = ${tauMs}\\text{ ms}`
      };
    }
  },
  {
    id: 'electricite-rlc-t0',
    name: 'Période propre RLC (T₀ = 2π√(LC))',
    domain: 'Électricité',
    latex: 'T_0 = 2\\pi \\sqrt{L \\cdot C} \\quad \\text{et} \\quad N_0 = \\frac{1}{T_0}',
    targetSymbol: 'T_0',
    targetUnit: 's',
    description: 'Période propre des oscillations libres dans un circuit LC ou RLC peu amorti.',
    examNote: 'En pseudo-périodique pour R faible, la pseudo-période T ≈ T₀.',
    variables: [
      { symbol: 'L_mH', label: 'Inductance (L)', unit: 'mH', defaultVal: 50, step: 5, min: 0.1 },
      { symbol: 'C_uF', label: 'Capacité (C)', unit: 'µF', defaultVal: 10, step: 1, min: 0.001 }
    ],
    compute: (inputs) => {
      const l = inputs.L_mH * 1e-3;
      const c = inputs.C_uF * 1e-6;
      const t0 = 2 * Math.PI * Math.sqrt(l * c);
      const f0 = 1 / t0;
      const t0Ms = (t0 * 1000).toFixed(3);
      return {
        value: t0,
        formatted: `${t0Ms} ms (Fréquence N₀ = ${f0.toFixed(1)} Hz)`,
        scientific: `${t0.toExponential(2).replace('e+', ' \\times 10^{').replace('e-', ' \\times 10^{-')}}\\text{ s}`,
        unit: 's',
        substitutionLatex: `T_0 = 2\\pi \\sqrt{(${inputs.L_mH}\\cdot 10^{-3}) \\times (${inputs.C_uF}\\cdot 10^{-6})} = ${t0Ms}\\text{ ms}`
      };
    }
  },
  {
    id: 'electricite-am-taux',
    name: 'Taux de modulation AM (m = (U_max - U_min) / (U_max + U_min))',
    domain: 'Électricité',
    branches: ['PC'],
    latex: 'm = \\frac{U_{max} - U_{min}}{U_{max} + U_{min}}',
    targetSymbol: 'm',
    targetUnit: 'sans unité',
    description: 'Taux de modulation d’amplitude mesuré sur un oscillogramme.',
    examNote: 'La modulation est bonne si m < 1 et Fp >> fs.',
    variables: [
      { symbol: 'Umax', label: 'Tension max (U_max)', unit: 'V', defaultVal: 4.8, step: 0.2, min: 0.1 },
      { symbol: 'Umin', label: 'Tension min (U_min)', unit: 'V', defaultVal: 1.6, step: 0.2, min: 0 }
    ],
    compute: (inputs) => {
      const m = (inputs.Umax - inputs.Umin) / (inputs.Umax + inputs.Umin);
      const isGood = m < 1;
      return {
        value: m,
        formatted: `m = ${m.toFixed(3)} ${isGood ? '✅ Bonne modulation (m < 1)' : '⚠️ Surmodulation (m ≥ 1)'}`,
        scientific: `${m.toFixed(3)}`,
        unit: '',
        substitutionLatex: `m = \\frac{${inputs.Umax} - ${inputs.Umin}}{${inputs.Umax} + ${inputs.Umin}} = \\frac{${(inputs.Umax - inputs.Umin).toFixed(2)}}{${(inputs.Umax + inputs.Umin).toFixed(2)}} = ${m.toFixed(3)}`
      };
    }
  },

  // --- CHIMIE ---
  {
    id: 'chimie-ph-h3o',
    name: 'Calcul du pH et de [H₃O⁺]',
    domain: 'Chimie',
    latex: 'pH = -\\log[H_3O^+] \\quad \\iff \\quad [H_3O^+] = 10^{-pH}',
    targetSymbol: 'pH',
    targetUnit: '',
    description: 'Relation entre le pH d’une solution aqueuse et la concentration molaire en ions hydronium.',
    examNote: '2 chiffres après la virgule pour le pH au Bac.',
    variables: [
      { symbol: 'h3o_mM', label: 'Concentration [H₃O⁺]', unit: 'mmol/L', defaultVal: 2.5, step: 0.1, min: 1e-12 }
    ],
    compute: (inputs) => {
      const cMolL = inputs.h3o_mM * 1e-3;
      const ph = -Math.log10(cMolL);
      return {
        value: ph,
        formatted: `pH = ${ph.toFixed(2)}`,
        scientific: `${ph.toFixed(2)}`,
        unit: '',
        substitutionLatex: `pH = -\\log(${cMolL.toExponential(2)}) = ${ph.toFixed(2)}`
      };
    }
  },
  {
    id: 'chimie-tau-avancement',
    name: 'Taux d’avancement final (τ = x_f / x_max)',
    domain: 'Chimie',
    latex: '\\tau = \\frac{x_f}{x_{max}}',
    targetSymbol: '\\tau',
    targetUnit: '%',
    description: 'Taux d’avancement d’une réaction chimique à l’état d’équilibre.',
    examNote: 'Si τ = 1 (ou 100%), réaction totale. Si τ < 1, réaction limitée (équilibre dynamique).',
    variables: [
      { symbol: 'xf_umol', label: 'Avancement final (x_f)', unit: 'µmol', defaultVal: 82, step: 5, min: 0 },
      { symbol: 'xmax_umol', label: 'Avancement max théorique (x_max)', unit: 'µmol', defaultVal: 500, step: 10, min: 0.001 }
    ],
    compute: (inputs) => {
      const tau = inputs.xf_umol / inputs.xmax_umol;
      const tauPct = (tau * 100).toFixed(2);
      const isTotal = tau >= 0.999;
      return {
        value: tau,
        formatted: `τ = ${tau.toFixed(4)} (${tauPct}%) - ${isTotal ? 'Réaction Totale' : 'Réaction Limitée'}`,
        scientific: `${tau.toFixed(3)}`,
        unit: '%',
        substitutionLatex: `\\tau = \\frac{${inputs.xf_umol}\\ \\mu\\text{mol}}{${inputs.xmax_umol}\\ \\mu\\text{mol}} = ${tau.toFixed(4)} = ${tauPct}\\%`
      };
    }
  },
  {
    id: 'chimie-henderson-ph',
    name: 'Formule de Henderson-Hasselbalch (pH = pKa + log([A⁻]/[AH]))',
    domain: 'Chimie',
    latex: 'pH = pK_a + \\log\\left(\\frac{[A^-]_{eq}}{[AH]_{eq}}\\right)',
    targetSymbol: 'pH',
    targetUnit: '',
    description: 'Calcul du pH d’une solution contenant un couple acide/base faible conjugué.',
    examNote: 'À la demi-équivalence d’un titrage acido-basique, [A⁻] = [AH] donc pH = pKa.',
    variables: [
      { symbol: 'pKa', label: 'Constante d’acidité (pK_a)', unit: '', defaultVal: 4.82, step: 0.1, min: 0 },
      { symbol: 'baseConc', label: 'Concentration base [A⁻]', unit: 'mol/L', defaultVal: 0.02, step: 0.005, min: 0.00001 },
      { symbol: 'acidConc', label: 'Concentration acide [AH]', unit: 'mol/L', defaultVal: 0.01, step: 0.005, min: 0.00001 }
    ],
    compute: (inputs) => {
      const ratio = inputs.baseConc / inputs.acidConc;
      const logRatio = Math.log10(ratio);
      const ph = inputs.pKa + logRatio;
      return {
        value: ph,
        formatted: `pH = ${ph.toFixed(2)} (Rapport [Base]/[Acide] = ${ratio.toFixed(2)})`,
        scientific: `${ph.toFixed(2)}`,
        unit: '',
        substitutionLatex: `pH = ${inputs.pKa} + \\log\\left(\\frac{${inputs.baseConc}}{${inputs.acidConc}}\\right) = ${inputs.pKa} + ${logRatio >= 0 ? '+' : ''}${logRatio.toFixed(2)} = ${ph.toFixed(2)}`
      };
    }
  },

  // --- MÉCANIQUE ---
  {
    id: 'meca-poids-chute',
    name: 'Vitesse limite de chute verticale avec frottement fluide (v_lim)',
    domain: 'Mécanique',
    latex: 'v_{lim} = \\frac{m \\cdot g}{k} \\quad \\text{(frottement linéaire } f = k \\cdot v\\text{)}',
    targetSymbol: 'v_{lim}',
    targetUnit: 'm/s',
    description: 'Vitesse stationnaire atteinte lorsque le poids compense la force de frottement fluide.',
    examNote: 'Dérivée dv/dt = 0 en régime permanent.',
    variables: [
      { symbol: 'm_g', label: 'Masse solide (m)', unit: 'g', defaultVal: 200, step: 10, min: 1 },
      { symbol: 'g', label: 'Intensité de pesanteur (g)', unit: 'm/s²', defaultVal: 9.8, step: 0.1, min: 1 },
      { symbol: 'k', label: 'Coefficient frottement (k)', unit: 'kg/s', defaultVal: 0.8, step: 0.05, min: 0.001 }
    ],
    compute: (inputs) => {
      const mKg = inputs.m_g * 1e-3;
      const vlim = (mKg * inputs.g) / inputs.k;
      return {
        value: vlim,
        formatted: `${vlim.toFixed(2)} m·s⁻¹ (${(vlim * 3.6).toFixed(1)} km/h)`,
        scientific: `${vlim.toExponential(2).replace('e+', ' \\times 10^{').replace('e-', ' \\times 10^{-')}}\\text{ m}\\cdot\\text{s}^{-1}`,
        unit: 'm·s⁻¹',
        substitutionLatex: `v_{lim} = \\frac{${mKg.toFixed(3)}\\text{ kg} \\times ${inputs.g}}{${inputs.k}} = ${vlim.toFixed(2)}\\text{ m}\\cdot\\text{s}^{-1}`
      };
    }
  },
  {
    id: 'meca-energie-cinetique',
    name: 'Énergie cinétique (Ec = 1/2 · m · v²)',
    domain: 'Mécanique',
    latex: 'E_c = \\frac{1}{2} m v^2',
    targetSymbol: 'E_c',
    targetUnit: 'J',
    description: 'Énergie liée au mouvement de translation d’un solide.',
    examNote: 'Convertir impérativement la masse m en kilogrammes (kg) et la vitesse en m/s.',
    variables: [
      { symbol: 'm_kg', label: 'Masse (m)', unit: 'kg', defaultVal: 0.45, step: 0.05, min: 0.001 },
      { symbol: 'v', label: 'Vitesse (v)', unit: 'm/s', defaultVal: 8.5, step: 0.5, min: 0 }
    ],
    compute: (inputs) => {
      const ec = 0.5 * inputs.m_kg * Math.pow(inputs.v, 2);
      return {
        value: ec,
        formatted: `${ec.toFixed(3)} Joules (J)`,
        scientific: `${ec.toExponential(2).replace('e+', ' \\times 10^{').replace('e-', ' \\times 10^{-')}}\\text{ J}`,
        unit: 'J',
        substitutionLatex: `E_c = \\frac{1}{2} \\times ${inputs.m_kg} \\times (${inputs.v})^2 = ${ec.toFixed(3)}\\text{ J}`
      };
    }
  }
];
