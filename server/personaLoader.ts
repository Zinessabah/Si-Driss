import fs from 'fs';
import path from 'path';
import { ROOT_DIR } from './config';

// -----------------------------------------------------------------------------
// 1. SOUL.md & SKILLS LOADER (LECTURE SEULE CÔTÉ SERVEUR)
// -----------------------------------------------------------------------------

interface SkillCatalogEntry {
  id: string;
  fileName: string;
  branches: ('PC' | 'SM')[];
  pattern: RegExp;
}

const SKILL_CATALOG: SkillCatalogEntry[] = [
  {
    id: 'ondes-optique',
    fileName: 'ondes-optique.md',
    branches: ['PC', 'SM'],
    pattern: /\b(onde|ondes|diffraction|retard|longueur\s*d['’]onde|celerite|ultrason|laser|fente|dispersion|prisme|refraction|lambda|oscilloscope|s_?h)\b/i,
  },
  {
    id: 'nucleaire',
    fileName: 'nucleaire.md',
    branches: ['PC', 'SM'],
    pattern: /\b(nucleaire|radioactiv|decroissance|demi[- ]vie|soddy|alpha|beta|isotope|noyau|defaut\s*de\s*masse|liaison|aston|fission|fusion|datation|carbone\s*14|becquerel)\b/i,
  },
  {
    id: 'electricite-rc-rl-rlc',
    fileName: 'electricite-rc-rl-rlc.md',
    branches: ['PC', 'SM'],
    pattern: /\b(rc|rl|rlc|condensateur|bobine|inductance|capacite|charge|decharge|tau|constante\s*de\s*temps|pseudo[- ]periode|amorti|entretien|joule|energie\s*electrique|energie\s*magnetique)\b/i,
  },
  {
    id: 'modulation-am',
    fileName: 'modulation-am.md',
    branches: ['PC', 'SM'],
    pattern: /\b(modulation|demodulation|porteuse|enveloppe|trapeze|surmodulation|taux\s*de\s*modulation|am|detecteur|passe[- ]bas|passe[- ]haut)\b/i,
  },
  {
    id: 'sm-rlc-force-champ-e',
    fileName: 'sm-rlc-force-champ-e.md',
    branches: ['SM'], // STRICTEMENT SM : jamais chargé pour PC
    pattern: /\b(impedance|force|forc[eé]e|sinusoidal|gbf|resonance|bande\s*passante|facteur\s*de\s*qualite|surtension|dephasage|champ\s*electrique|electrostatique|deflexion)\b/i,
  },
  {
    id: 'mecanique-newton-euler',
    fileName: 'mecanique-newton-euler.md',
    branches: ['PC', 'SM'],
    pattern: /\b(newton|referentiel|galileen|chute|euler|frottement|vitesse\s*limite|projectile|satellite|kepler|lorentz|rotation|inertie|rfd|non[- ]glissement|pendule|torsion|ressort|bohr)\b/i,
  },
  {
    id: 'chimie-cinetique-titrage-piles',
    fileName: 'chimie-cinetique-titrage-piles.md',
    branches: ['PC', 'SM'],
    pattern: /\b(chimie|cinetique|vitesse\s*volumique|demi[- ]reaction|kohlrausch|conductim|ph|pka|acide|base|titrage|dosage|equivalence|quotient|ester|hydrolyse|saponification|anhydride|pile|electrolyse|faraday)\b/i,
  },
];

let cachedSoul: string | null = null;
const cachedSkills = new Map<string, string>();

const FALLBACK_SOUL = `Tu es Si Driss, professeur rigoureux et bienveillant de Physique-Chimie pour le 2ème Bac marocain (BIOF).
Applique strictement le protocole en 4 étapes du barème national (Justification, Expression littérale, Conversions SI & AN, Contrôle & résultat en gras), n'invente jamais aucune donnée manquante, et utilise LaTeX ($...$, $$...$$).`;

export function getSoulContent(): string {
  if (cachedSoul !== null) return cachedSoul;
  try {
    const soulPath = path.resolve(ROOT_DIR, 'server/persona/SOUL.md');
    if (fs.existsSync(soulPath)) {
      cachedSoul = fs.readFileSync(soulPath, 'utf-8').trim();
      return cachedSoul;
    }
  } catch (err) {
    console.warn('[PersonaLoader] Lecture SOUL.md impossible, repli intégré:', err);
  }
  cachedSoul = FALLBACK_SOUL;
  return cachedSoul;
}

function loadSkillByFile(fileName: string): string {
  const cached = cachedSkills.get(fileName);
  if (cached !== undefined) return cached;
  try {
    const skillsRoot = path.resolve(ROOT_DIR, 'server/skills');
    const resolved = path.resolve(skillsRoot, fileName);
    if (!resolved.startsWith(skillsRoot + path.sep)) return '';
    if (fs.existsSync(resolved)) {
      const content = fs.readFileSync(resolved, 'utf-8').trim();
      cachedSkills.set(fileName, content);
      return content;
    }
  } catch (err) {
    console.warn(`[PersonaLoader] Lecture skill ${fileName} impossible:`, err);
  }
  return '';
}

/**
 * Sélectionne au plus 2 fiches Skill côté serveur selon la question normalisée et la filière.
 * Le client ne peut jamais demander ni injecter de chemin de fichier Skill.
 */
export function selectRelevantSkills(query: string, branch: 'PC' | 'SM'): string[] {
  const normalized = (query || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (!normalized) return [];

  const loaded: string[] = [];
  for (const entry of SKILL_CATALOG) {
    if (!entry.branches.includes(branch)) continue;
    if (entry.pattern.test(normalized)) {
      const content = loadSkillByFile(entry.fileName);
      if (content) {
        loaded.push(content);
        if (loaded.length >= 2) break;
      }
    }
  }
  return loaded;
}

// -----------------------------------------------------------------------------
// 2. USER.MD & MEMORY.MD — VALIDATION FERMÉE PAR LISTE BLANCHE (ZÉRO TEXTE LIBRE)
// -----------------------------------------------------------------------------

export type StudentGoalId = 'reussir_bac' | 'mention_bien' | 'mention_tb' | 'concours_postbac';
export type StudentStyleId = 'pas_a_pas' | 'synthese_rapide' | 'exemples_national' | 'analogies';
export type StudentLangId = 'francais_strict' | 'francais_darija_repere';
export type ChapterStatusId = 'a_revoir' | 'en_cours' | 'maitrise';

export interface ValidatedStudentProfile {
  goal: StudentGoalId;
  style: StudentStyleId;
  language: StudentLangId;
}

export interface ValidatedChapterState {
  chapterId: string;
  status: ChapterStatusId;
}

export interface ValidatedStudentMemory {
  chapterStates: ValidatedChapterState[];
  activePitfalls: string[];
}

const GOAL_PROMPTS: Record<StudentGoalId, string> = {
  reussir_bac: 'Objectif visé : réussir le Baccalauréat sereinement en consolidant les bases indispensables.',
  mention_bien: 'Objectif visé : Mention Bien (14–16/20), viser une rédaction propre et rigoureuse.',
  mention_tb: 'Objectif visé : Mention Très Bien (17–20/20), exiger une précision absolue, aucune tolérance sur les unités ou chiffres significatifs.',
  concours_postbac: 'Objectif visé : préparation Bac + concours (ENSA/Médecine/CPGE), approfondir le sens physique et les astuces rapides après la méthode officielle.',
};

const STYLE_PROMPTS: Record<StudentStyleId, string> = {
  pas_a_pas: 'Style préféré : explications détaillées étape par étape sans sauter d’intermédiaire algébrique.',
  synthese_rapide: 'Style préféré : explications directes, structurées et synthétiques allant à l’essentiel.',
  exemples_national: 'Style préféré : illustrer systématiquement avec des exemples concrets et barèmes d’Examens Nationaux.',
  analogies: 'Style préféré : utiliser des analogies physiques intuitives avant la formalisation mathématique.',
};

const LANGUAGE_PROMPTS: Record<StudentLangId, string> = {
  francais_strict: 'Langue : français scientifique strict exclusivement.',
  francais_darija_repere: 'Langue : français scientifique rigoureux ponctué de brefs encouragements pédagogiques marocains.',
};

const CHAPTER_LABELS: Record<string, { label: string; branches: ('PC' | 'SM')[] }> = {
  'ondes-mecaniques': { label: 'Ondes mécaniques progressives et périodiques', branches: ['PC', 'SM'] },
  'ondes-lumineuses': { label: 'Propagation des ondes lumineuses (Diffraction & Réfraction)', branches: ['PC', 'SM'] },
  'decroissance-radioactive': { label: 'Décroissance radioactive & Datation', branches: ['PC', 'SM'] },
  'noyaux-masse-energie': { label: 'Noyaux, Masse et Énergie', branches: ['PC', 'SM'] },
  'dipole-rc': { label: 'Dipôle RC', branches: ['PC', 'SM'] },
  'dipole-rl': { label: 'Dipôle RL', branches: ['PC', 'SM'] },
  'oscillations-rlc': { label: 'Oscillations libres RLC', branches: ['PC', 'SM'] },
  'modulation-am': { label: 'Modulation et Démodulation AM', branches: ['PC', 'SM'] },
  'oscillations-electriques-forcees-rlc': { label: 'Oscillations électriques forcées RLC (SM)', branches: ['SM'] },
  'lois-newton-chute': { label: 'Lois de Newton & Chute avec frottement', branches: ['PC', 'SM'] },
  'mouvements-plans': { label: 'Mouvements plans (Projectiles, Satellites, Particules)', branches: ['PC', 'SM'] },
  'oscillateurs-mecaniques': { label: 'Systèmes mécaniques oscillants', branches: ['PC', 'SM'] },
  'rotation-solide-axe-fixe': { label: 'Rotation autour d’un axe fixe', branches: ['PC', 'SM'] },
  'oscillations-mecaniques-forcees': { label: 'Oscillations mécaniques forcées & Résonance', branches: ['PC', 'SM'] },
  'atome-bohr': { label: 'Atome et Mécanique de Newton (Bohr)', branches: ['PC', 'SM'] },
  'cinetique-chimique': { label: 'Cinétique chimique & Facteurs cinétiques', branches: ['PC', 'SM'] },
  'acide-base-equilibre': { label: 'Acides, Bases & Équilibre chimique', branches: ['PC', 'SM'] },
  'piles-electrolyse': { label: 'Piles électrochimiques & Électrolyse', branches: ['PC', 'SM'] },
  'chimie-organique-esters': { label: 'Estérification, Hydrolyse & Saponification', branches: ['PC', 'SM'] },
};

const PITFALL_LABELS: Record<string, { label: string; branches: ('PC' | 'SM')[] }> = {
  'trap-1': { label: 'Omission du système et du référentiel terrestre supposé galiléen', branches: ['PC', 'SM'] },
  'trap-2': { label: 'Oubli de la loi d’additivité des tensions en convention récepteur', branches: ['PC', 'SM'] },
  'trap-3': { label: 'Oubli de H2O dans le quotient de réaction en estérification sans solvant', branches: ['PC', 'SM'] },
  'trap-4': { label: 'Confusion mol/L vs mol/m³ dans la loi de Kohlrausch (conductimétrie)', branches: ['PC', 'SM'] },
  'trap-5': { label: 'Confusion entre période d’énergie (T/2) et pseudo-période des tensions (T) en RLC', branches: ['PC', 'SM'] },
  'trap-6': { label: 'Erreur L/D au lieu de L/(2D) pour le demi-écart angulaire de diffraction', branches: ['PC', 'SM'] },
  'trap-7': { label: 'Condition de détection d’enveloppe AM (Tp << RC < Ts)', branches: ['PC'] },
  'trap-8': { label: 'Passage direct au calcul numérique sans expression littérale préalable', branches: ['PC', 'SM'] },
  'trap-sm-1': { label: 'Oubli de la relation cinématique a = R * theta_seconde (rotation SM)', branches: ['SM'] },
  'trap-sm-2': { label: 'Erreur I = I0/2 au lieu de I0/racine(2) pour la bande passante à -3 dB (SM)', branches: ['SM'] },
};

const VALID_CHAPTER_STATUSES = new Set<ChapterStatusId>(['a_revoir', 'en_cours', 'maitrise']);

/**
 * Valide strictement le profil élève (enums fermés uniquement, zéro texte libre).
 */
export function sanitizeStudentProfile(raw: unknown): ValidatedStudentProfile | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const obj = raw as Record<string, unknown>;

  const goal = typeof obj.goal === 'string' && obj.goal in GOAL_PROMPTS
    ? (obj.goal as StudentGoalId)
    : undefined;
  const style = typeof obj.style === 'string' && obj.style in STYLE_PROMPTS
    ? (obj.style as StudentStyleId)
    : undefined;
  const language = typeof obj.language === 'string' && obj.language in LANGUAGE_PROMPTS
    ? (obj.language as StudentLangId)
    : undefined;

  if (!goal && !style && !language) return undefined;
  return {
    goal: goal || 'mention_bien',
    style: style || 'pas_a_pas',
    language: language || 'francais_darija_repere',
  };
}

/**
 * Valide strictement la mémoire pédagogique (uniquement des IDs fermés autorisés pour la filière).
 */
export function sanitizeStudentMemory(
  raw: unknown,
  branch: 'PC' | 'SM'
): ValidatedStudentMemory | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const obj = raw as Record<string, unknown>;

  const chapterStates: ValidatedChapterState[] = [];
  const seenChapters = new Set<string>();
  if (Array.isArray(obj.chapterStates)) {
    for (const item of obj.chapterStates.slice(0, 25)) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const chId = typeof rec.chapterId === 'string' ? rec.chapterId : '';
      const status = typeof rec.status === 'string' ? (rec.status as ChapterStatusId) : undefined;
      const meta = CHAPTER_LABELS[chId];
      if (!meta || !meta.branches.includes(branch)) continue;
      if (!status || !VALID_CHAPTER_STATUSES.has(status)) continue;
      if (seenChapters.has(chId)) continue;
      seenChapters.add(chId);
      chapterStates.push({ chapterId: chId, status });
    }
  }

  const activePitfalls: string[] = [];
  const seenPitfalls = new Set<string>();
  if (Array.isArray(obj.activePitfalls)) {
    for (const id of obj.activePitfalls.slice(0, 15)) {
      if (typeof id !== 'string') continue;
      const meta = PITFALL_LABELS[id];
      if (!meta || !meta.branches.includes(branch)) continue;
      if (seenPitfalls.has(id)) continue;
      seenPitfalls.add(id);
      activePitfalls.push(id);
    }
  }

  if (chapterStates.length === 0 && activePitfalls.length === 0) return undefined;
  return { chapterStates, activePitfalls };
}

/**
 * Génère uniquement côté serveur des consignes pédagogiques à partir des IDs validés.
 * Aucun caractère saisi librement par le client n'est jamais interpolé ici.
 */
export function formatValidatedStudentDirectives(
  profile?: ValidatedStudentProfile,
  memory?: ValidatedStudentMemory
): string {
  const lines: string[] = [];

  if (profile) {
    lines.push(GOAL_PROMPTS[profile.goal]);
    lines.push(STYLE_PROMPTS[profile.style]);
    lines.push(LANGUAGE_PROMPTS[profile.language]);
  }

  if (memory) {
    const toReview = memory.chapterStates
      .filter((c) => c.status === 'a_revoir')
      .map((c) => CHAPTER_LABELS[c.chapterId].label);
    const inProgress = memory.chapterStates
      .filter((c) => c.status === 'en_cours')
      .map((c) => CHAPTER_LABELS[c.chapterId].label);
    const mastered = memory.chapterStates
      .filter((c) => c.status === 'maitrise')
      .map((c) => CHAPTER_LABELS[c.chapterId].label);

    if (toReview.length > 0) {
      lines.push(`Chapitres signalés à consolider : ${toReview.join(', ')}.`);
    }
    if (inProgress.length > 0) {
      lines.push(`Chapitres actuellement en cours de révision : ${inProgress.join(', ')}.`);
    }
    if (mastered.length > 0) {
      lines.push(`Chapitres déjà maîtrisés par l’élève : ${mastered.join(', ')}.`);
    }

    if (memory.activePitfalls.length > 0) {
      const pitfallTexts = memory.activePitfalls.map((id) => PITFALL_LABELS[id].label);
      lines.push(`Points de vigilance à surveiller particulièrement chez cet élève : ${pitfallTexts.join(' ; ')}.`);
    }
  }

  if (lines.length === 0) return '';
  return `ADAPTATION PÉDAGOGIQUE AU PROFIL ÉLÈVE (PARAMÈTRES PRÉDÉFINIS VALIDÉS) :\n- ${lines.join('\n- ')}`;
}

/**
 * Durcissement du champ historique `context` venant du client :
 * type strict, troncature <= 800 caractères et neutralisation des marqueurs système.
 */
export function sanitizePassiveContext(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const cleaned = raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/={3,}/g, ' ')
    .replace(/<\/?(?:system|assistant|instruction|prompt)[^>]*>/gi, '')
    .replace(/\[(CORRIG[EÉ]|SYSTEM|ADMIN|INSTRUCTION)[^\]]*\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 800);
}

