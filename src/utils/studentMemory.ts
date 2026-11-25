import { CURRICULUM } from '../data/curriculum';
import { NATIONAL_PITFALLS } from '../data/pitfalls';

export type StudentGoalId = 'reussir_bac' | 'mention_bien' | 'mention_tb' | 'concours_postbac';
export type StudentStyleId = 'pas_a_pas' | 'synthese_rapide' | 'exemples_national' | 'analogies';
export type StudentLangId = 'francais_strict' | 'francais_darija_repere';
export type ChapterStatusId = 'a_revoir' | 'en_cours' | 'maitrise';

export interface StudentProfile {
  goal: StudentGoalId;
  style: StudentStyleId;
  language: StudentLangId;
}

export interface ChapterStateEntry {
  chapterId: string;
  status: ChapterStatusId;
}

export interface StudentMemory {
  chapterStates: ChapterStateEntry[];
  activePitfalls: string[];
}

export const STUDENT_GOAL_OPTIONS: { id: StudentGoalId; label: string; desc: string }[] = [
  { id: 'reussir_bac', label: 'Réussir le Bac', desc: 'Consolider les bases et automatismes essentiels' },
  { id: 'mention_bien', label: 'Mention Bien (14–16)', desc: 'Rédaction propre, rigoureuse et méthode complète' },
  { id: 'mention_tb', label: 'Mention Très Bien (17–20)', desc: 'Exigence maximale sur unités, CS et justifications' },
  { id: 'concours_postbac', label: 'Bac + Concours', desc: 'ENSA, Médecine, CPGE — sens physique approfondi' },
];

export const STUDENT_STYLE_OPTIONS: { id: StudentStyleId; label: string; desc: string }[] = [
  { id: 'pas_a_pas', label: 'Étape par étape', desc: 'Détail algébrique complet sans sauter d’étape' },
  { id: 'synthese_rapide', label: 'Synthèse directe', desc: 'Réponses concises et structurées à l’essentiel' },
  { id: 'exemples_national', label: 'Barème National', desc: 'Appui constant sur les sujets et barèmes officiels' },
  { id: 'analogies', label: 'Avec analogies', desc: 'Intuition physique avant la mise en équation' },
];

export const STUDENT_LANG_OPTIONS: { id: StudentLangId; label: string; desc: string }[] = [
  { id: 'francais_darija_repere', label: 'Français + repères Si Driss', desc: 'Français scientifique avec encouragements marocains' },
  { id: 'francais_strict', label: 'Français strict uniquement', desc: 'Rédaction académique formelle 100 % en français' },
];

export const DEFAULT_STUDENT_PROFILE: StudentProfile = {
  goal: 'mention_bien',
  style: 'pas_a_pas',
  language: 'francais_darija_repere',
};

export const DEFAULT_STUDENT_MEMORY: StudentMemory = {
  chapterStates: [],
  activePitfalls: [],
};

const PROFILE_STORAGE_KEY = 'sidriss_user_profile_v1';
const MEMORY_STORAGE_KEY = 'sidriss_student_memory_v1';
export const STUDENT_CONFIG_EVENT = 'sidriss_student_config_changed';

const VALID_GOALS = new Set<StudentGoalId>(STUDENT_GOAL_OPTIONS.map((o) => o.id));
const VALID_STYLES = new Set<StudentStyleId>(STUDENT_STYLE_OPTIONS.map((o) => o.id));
const VALID_LANGS = new Set<StudentLangId>(STUDENT_LANG_OPTIONS.map((o) => o.id));
const VALID_STATUSES = new Set<ChapterStatusId>(['a_revoir', 'en_cours', 'maitrise']);
const VALID_CHAPTER_IDS = new Set(CURRICULUM.map((c) => c.id));
const VALID_PITFALL_IDS = new Set(NATIONAL_PITFALLS.map((p) => p.id));

export function loadStudentProfile(): StudentProfile {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STUDENT_PROFILE };
    const parsed = JSON.parse(raw);
    return {
      goal: VALID_GOALS.has(parsed?.goal) ? parsed.goal : DEFAULT_STUDENT_PROFILE.goal,
      style: VALID_STYLES.has(parsed?.style) ? parsed.style : DEFAULT_STUDENT_PROFILE.style,
      language: VALID_LANGS.has(parsed?.language) ? parsed.language : DEFAULT_STUDENT_PROFILE.language,
    };
  } catch {
    return { ...DEFAULT_STUDENT_PROFILE };
  }
}

export function saveStudentProfile(profile: StudentProfile): StudentProfile {
  const safe: StudentProfile = {
    goal: VALID_GOALS.has(profile.goal) ? profile.goal : DEFAULT_STUDENT_PROFILE.goal,
    style: VALID_STYLES.has(profile.style) ? profile.style : DEFAULT_STUDENT_PROFILE.style,
    language: VALID_LANGS.has(profile.language) ? profile.language : DEFAULT_STUDENT_PROFILE.language,
  };
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(safe));
    window.dispatchEvent(new Event(STUDENT_CONFIG_EVENT));
  } catch {}
  return safe;
}

export function loadStudentMemory(branch?: 'PC' | 'SM'): StudentMemory {
  try {
    const raw = localStorage.getItem(MEMORY_STORAGE_KEY);
    if (!raw) return { chapterStates: [], activePitfalls: [] };
    const parsed = JSON.parse(raw);

    const chapterStates: ChapterStateEntry[] = [];
    const seenCh = new Set<string>();
    if (Array.isArray(parsed?.chapterStates)) {
      for (const item of parsed.chapterStates) {
        if (!item || typeof item !== 'object') continue;
        if (!VALID_CHAPTER_IDS.has(item.chapterId)) continue;
        if (!VALID_STATUSES.has(item.status)) continue;
        if (branch) {
          const ch = CURRICULUM.find((c) => c.id === item.chapterId);
          if (ch?.branches && !ch.branches.includes(branch)) continue;
        }
        if (seenCh.has(item.chapterId)) continue;
        seenCh.add(item.chapterId);
        chapterStates.push({ chapterId: item.chapterId, status: item.status });
      }
    }

    const activePitfalls: string[] = [];
    const seenTrap = new Set<string>();
    if (Array.isArray(parsed?.activePitfalls)) {
      for (const id of parsed.activePitfalls) {
        if (typeof id !== 'string' || !VALID_PITFALL_IDS.has(id)) continue;
        if (branch) {
          const trap = NATIONAL_PITFALLS.find((p) => p.id === id);
          if (trap?.branches && !trap.branches.includes(branch)) continue;
        }
        if (seenTrap.has(id)) continue;
        seenTrap.add(id);
        activePitfalls.push(id);
      }
    }

    return { chapterStates, activePitfalls };
  } catch {
    return { chapterStates: [], activePitfalls: [] };
  }
}

export function saveStudentMemory(memory: StudentMemory): StudentMemory {
  const chapterStates: ChapterStateEntry[] = [];
  const seenCh = new Set<string>();
  for (const item of memory.chapterStates || []) {
    if (!VALID_CHAPTER_IDS.has(item.chapterId) || !VALID_STATUSES.has(item.status)) continue;
    if (seenCh.has(item.chapterId)) continue;
    seenCh.add(item.chapterId);
    chapterStates.push({ chapterId: item.chapterId, status: item.status });
  }

  const activePitfalls: string[] = [];
  const seenTrap = new Set<string>();
  for (const id of memory.activePitfalls || []) {
    if (!VALID_PITFALL_IDS.has(id) || seenTrap.has(id)) continue;
    seenTrap.add(id);
    activePitfalls.push(id);
  }

  const safe: StudentMemory = { chapterStates, activePitfalls };
  try {
    localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(safe));
    window.dispatchEvent(new Event(STUDENT_CONFIG_EVENT));
  } catch {}
  return safe;
}

export function setChapterProgressStatus(
  chapterId: string,
  status: ChapterStatusId | null
): StudentMemory {
  if (!VALID_CHAPTER_IDS.has(chapterId)) return loadStudentMemory();
  const current = loadStudentMemory();
  const filtered = current.chapterStates.filter((c) => c.chapterId !== chapterId);
  if (status && VALID_STATUSES.has(status)) {
    filtered.push({ chapterId, status });
  }
  return saveStudentMemory({ ...current, chapterStates: filtered });
}

export function toggleActivePitfall(pitfallId: string): StudentMemory {
  if (!VALID_PITFALL_IDS.has(pitfallId)) return loadStudentMemory();
  const current = loadStudentMemory();
  const exists = current.activePitfalls.includes(pitfallId);
  const next = exists
    ? current.activePitfalls.filter((id) => id !== pitfallId)
    : [...current.activePitfalls, pitfallId];
  return saveStudentMemory({ ...current, activePitfalls: next });
}

export function resetStudentProfileAndMemory(): void {
  saveStudentProfile({ ...DEFAULT_STUDENT_PROFILE });
  saveStudentMemory({ chapterStates: [], activePitfalls: [] });
}

/**
 * Détecte localement le chapitre du programme correspondant au dernier échange
 * pour proposer à l'élève de mémoriser son avancement en 1 clic.
 */
export function detectChapterTagFromText(text: string, branch: 'PC' | 'SM'): string | null {
  const q = (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const patterns: { id: string; re: RegExp; smOnly?: boolean }[] = [
    { id: 'oscillations-electriques-forcees-rlc', re: /\b(impedance|rlc\s*force|bande\s*passante|facteur\s*de\s*qualite|surtension)\b/, smOnly: true },
    { id: 'modulation-am', re: /\b(modulation|demodulation|porteuse|trapeze|taux\s*de\s*modulation)\b/ },
    { id: 'dipole-rc', re: /\b(dipole\s*rc|condensateur|charge.*condensateur|decharge.*condensateur)\b/ },
    { id: 'dipole-rl', re: /\b(dipole\s*rl|bobine|inductance|rupture\s*du\s*courant)\b/ },
    { id: 'oscillations-rlc', re: /\b(rlc|pseudo[- ]periode|entretien\s*d['’]oscillations)\b/ },
    { id: 'ondes-lumineuses', re: /\b(onde.*lumineus|diffraction|laser|prisme|indice\s*de\s*refraction)\b/ },
    { id: 'ondes-mecaniques', re: /\b(onde|ondes|retard\s*temporel|celerite|ultrason)\b/ },
    { id: 'decroissance-radioactive', re: /\b(radioactiv|decroissance|demi[- ]vie|datation|soddy)\b/ },
    { id: 'noyaux-masse-energie', re: /\b(defaut\s*de\s*masse|energie\s*de\s*liaison|aston|fission|fusion)\b/ },
    { id: 'rotation-solide-axe-fixe', re: /\b(rotation|moment\s*d['’]inertie|non[- ]glissement|rfd)\b/ },
    { id: 'lois-newton-chute', re: /\b(newton|chute\s*verticale|frottement|vitesse\s*limite|euler)\b/ },
    { id: 'mouvements-plans', re: /\b(projectile|satellite|kepler|lorentz|champ\s*electrique)\b/ },
    { id: 'oscillateurs-mecaniques', re: /\b(pendule|ressort|torsion|oscillateur\s*mecanique)\b/ },
    { id: 'cinetique-chimique', re: /\b(cinetique|vitesse\s*volumique|demi[- ]reaction|kohlrausch)\b/ },
    { id: 'acide-base-equilibre', re: /\b(titrage|acide|base|pka|equivalence|ph[- ]metrique)\b/ },
    { id: 'piles-electrolyse', re: /\b(pile|electrolyse|faraday|anode|cathode|pont\s*salin)\b/ },
    { id: 'chimie-organique-esters', re: /\b(ester|esterification|hydrolyse|saponification|anhydride)\b/ },
  ];

  for (const p of patterns) {
    if (p.smOnly && branch !== 'SM') continue;
    if (p.re.test(q)) {
      const exists = CURRICULUM.find((c) => c.id === p.id && (!c.branches || c.branches.includes(branch)));
      if (exists) return p.id;
    }
  }
  return null;
}

export function formatUserProfileMarkdown(profile: StudentProfile, branch: 'PC' | 'SM'): string {
  const goal = STUDENT_GOAL_OPTIONS.find((g) => g.id === profile.goal);
  const style = STUDENT_STYLE_OPTIONS.find((s) => s.id === profile.style);
  const lang = STUDENT_LANG_OPTIONS.find((l) => l.id === profile.language);

  return `# USER.md — Profil Élève (2BAC ${branch})

*(Configuration locale par choix prédéfinis — aucune donnée personnelle ni texte libre transmis au serveur)*

- **Filière active** : 2ème Bac ${branch}
- **Objectif** : ${goal?.label || profile.goal} *(${goal?.desc || ''})*
- **Style pédagogique** : ${style?.label || profile.style} *(${style?.desc || ''})*
- **Langue & ton** : ${lang?.label || profile.language}`;
}

export function formatStudentMemoryMarkdown(memory: StudentMemory, branch: 'PC' | 'SM'): string {
  const statusLabel: Record<ChapterStatusId, string> = {
    a_revoir: '🔴 À revoir',
    en_cours: '🟡 En cours',
    maitrise: '🟢 Maîtrisé',
  };

  const chapterLines = memory.chapterStates
    .map((cs) => {
      const ch = CURRICULUM.find((c) => c.id === cs.chapterId);
      if (!ch || (ch.branches && !ch.branches.includes(branch))) return null;
      return `- ${statusLabel[cs.status]} — **${ch.title}** (\`${ch.id}\`)`;
    })
    .filter(Boolean);

  const trapLines = memory.activePitfalls
    .map((id) => {
      const tr = NATIONAL_PITFALLS.find((t) => t.id === id);
      if (!tr || (tr.branches && !tr.branches.includes(branch))) return null;
      return `- ⚠️ **${tr.title}** (\`${tr.id}\`)`;
    })
    .filter(Boolean);

  return `# MEMORY.md — Mémoire de Révision (2BAC ${branch})

*(Stockée localement dans votre navigateur — tags de chapitres & pièges officiels uniquement)*

## Progression par chapitre
${chapterLines.length > 0 ? chapterLines.join('\n') : '_Aucun chapitre tagué pour le moment._'}

## Points de vigilance suivis par Si Driss
${trapLines.length > 0 ? trapLines.join('\n') : '_Aucun piège spécifique activé pour le moment._'}`;
}

