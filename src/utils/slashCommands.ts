export type SlashCommandId =
  | 'cours'
  | 'examen'
  | 'exercice'
  | 'cadre'
  | 'courbe'
  | 'schema'
  | 'mindmap'
  | 'piege'
  | 'profil'
  | 'memoire'
  | 'aide';

export interface SlashCommandDef {
  id: SlashCommandId;
  command: string;
  usage: string;
  description: string;
  aliases: string[];
  badgeColor: string;
  immediate?: boolean;
  docCategories?: Array<'cours' | 'examens' | 'series' | 'cadres'>;
  topicSuggestions?: { label: string; value: string; smOnly?: boolean; pcOnly?: boolean }[];
}

export const SLASH_COMMANDS: SlashCommandDef[] = [
  {
    id: 'cours',
    command: '/cours',
    usage: '/cours <chapitre ou document>',
    description: 'Afficher le PDF officiel du cours et expliquer les notions clés',
    aliases: ['/affiche cours', '/affiche le cours', '/afficher cours'],
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    docCategories: ['cours'],
    topicSuggestions: [
      { label: 'Lois de Newton (Manuel S2)', value: 'lois de Newton' },
      { label: "Chute d'un corps solide (Manuel S2)", value: "chute d'un corps solide" },
      { label: "Modulation d'amplitude AM (Manuel S1)", value: "modulation d'amplitude" },
      { label: 'Dipôle RL (Manuel S1)', value: 'dipôle RL' },
      { label: 'Circuit RLC libre (Manuel S1)', value: 'RLC libre' },
      { label: 'Titrage acido-basique (Manuel S1)', value: 'réactions acido-basiques' },
    ],
  },
  {
    id: 'examen',
    command: '/examen',
    usage: '/examen <année / session / thème>',
    description: 'Afficher un sujet officiel du Bac National (2008–2026) — solution sur demande',
    aliases: ['/affiche examen', '/affiche sujet', '/annale'],
    badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    docCategories: ['examens'],
    topicSuggestions: [
      { label: 'National 2025 — Session Normale', value: '2025 SN' },
      { label: 'National 2024 — Session Normale', value: '2024 SN' },
      { label: 'National 2024 — Rattrapage', value: '2024 SR' },
      { label: 'Exercice Ondes du National', value: 'ondes' },
      { label: 'Exercice Nucléaire du National', value: 'nucléaire' },
      { label: 'Exercice Électricité du National', value: 'électricité' },
    ],
  },
  {
    id: 'exercice',
    command: '/exercice',
    usage: '/exercice <série ou thème>',
    description: "Afficher une série d'exercices officielle ou un sujet du National",
    aliases: ['/affiche exercice', '/serie'],
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    docCategories: ['series', 'examens'],
  },
  {
    id: 'courbe',
    command: '/courbe',
    usage: '/courbe <grandeur ou phénomène>',
    description: 'Tracer une courbe interactive SVG (RC, RL, RLC, titrage, chute...)',
    aliases: ['/affiche courbe', '/tracer'],
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    topicSuggestions: [
      { label: 'Charge du condensateur u_C(t)', value: 'charge du condensateur RC' },
      { label: 'Oscillations RLC amorties', value: 'oscillations RLC amorties' },
      { label: 'Titrage pH-métrique acide faible / base forte', value: 'titrage pH-métrique' },
      { label: 'Décroissance radioactive N(t)', value: 'décroissance radioactive N(t)' },
      { label: 'Vitesse de chute verticale v(t)', value: 'chute verticale avec frottement' },
      { label: 'Résonance d\'intensité I(N)', value: 'résonance RLC forcé', smOnly: true },
    ],
  },
  {
    id: 'schema',
    command: '/schema',
    usage: '/schema <montage ou système>',
    description: 'Dessiner un schéma vectoriel annoté (circuit, forces, diffraction)',
    aliases: ['/affiche schema'],
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    topicSuggestions: [
      { label: 'Montage charge/décharge dipôle RC', value: 'montage dipôle RC convention récepteur' },
      { label: 'Bilan des forces sur plan incliné', value: 'bilan des forces sur un plan incliné' },
      { label: 'Dispositif de diffraction laser', value: 'diffraction par une fente laser' },
    ],
  },
  {
    id: 'mindmap',
    command: '/mindmap',
    usage: '/mindmap <chapitre>',
    description: 'Générer une carte mentale structurée du chapitre',
    aliases: ['/carte'],
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    topicSuggestions: [
      { label: 'Ondes mécaniques & lumineuses', value: 'Ondes mécaniques et lumineuses' },
      { label: 'Transformations nucléaires', value: 'Transformations nucléaires' },
      { label: 'Dipôles RC, RL et RLC', value: 'Électricité RC RL RLC' },
      { label: 'Acides, bases et titrages', value: 'Acides bases et titrage pH-métrique' },
    ],
  },
  {
    id: 'piege',
    command: '/piege',
    usage: '/piege <chapitre>',
    description: "Te tester sur un piège fréquent le jour de l'Examen National",
    aliases: ['/trap'],
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    topicSuggestions: [
      { label: 'Pièges Ondes & Diffraction', value: 'ondes et diffraction' },
      { label: 'Pièges RC / RL / RLC', value: 'dipôles RC RL RLC' },
      { label: 'Pièges Mécanique & Newton', value: 'lois de Newton et chute' },
      { label: 'Pièges Chimie (taux d’avancement, K, quotient)', value: 'équilibre chimique et titrage' },
    ],
  },
  {
    id: 'cadre',
    command: '/cadre',
    usage: '/cadre <notion ou chapitre>',
    description: 'Consulter le Cadre de Référence officiel du Ministère',
    aliases: ['/reference'],
    badgeColor: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
    docCategories: ['cadres'],
  },
  {
    id: 'profil',
    command: '/profil',
    usage: '/profil',
    description: 'Configurer votre profil USER.md (objectif Bac, style, langue)',
    aliases: ['/user'],
    badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    immediate: true,
  },
  {
    id: 'memoire',
    command: '/memoire',
    usage: '/memoire',
    description: 'Gérer votre MEMORY.md local (chapitres maîtrisés & pièges suivis)',
    aliases: ['/memory'],
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    immediate: true,
  },
  {
    id: 'aide',
    command: '/aide',
    usage: '/aide',
    description: 'Afficher toutes les commandes / disponibles dans Si Driss',
    aliases: ['/help', '/commandes'],
    badgeColor: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    immediate: true,
  },
];

export interface ParsedClientSlashCommand {
  def: SlashCommandDef;
  matchedPrefix: string;
  arg: string;
}

function stripOuterQuotes(s: string): string {
  const trimmed = s.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2)
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/**
 * Parse une saisie utilisateur commençant par `/` (commandes courtes ou alias `/affiche ...`).
 */
export function parseClientSlashCommand(rawText: string): ParsedClientSlashCommand | null {
  const trimmed = (rawText || '').trim();
  if (!trimmed.startsWith('/')) return null;

  const lowerNorm = trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  // Tester d'abord les alias multi-mots les plus longs, puis les commandes courtes
  const candidates: { def: SlashCommandDef; prefix: string }[] = [];
  for (const def of SLASH_COMMANDS) {
    candidates.push({ def, prefix: def.command });
    for (const alias of def.aliases) {
      candidates.push({
        def,
        prefix: alias.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(),
      });
    }
  }
  candidates.sort((a, b) => b.prefix.length - a.prefix.length);

  for (const { def, prefix } of candidates) {
    if (lowerNorm === prefix || lowerNorm.startsWith(`${prefix} `)) {
      const rest = trimmed.slice(prefix.length).trim();
      return {
        def,
        matchedPrefix: trimmed.slice(0, prefix.length),
        arg: stripOuterQuotes(rest),
      };
    }
  }

  return null;
}

export function formatSlashHelpMarkdown(branch: 'PC' | 'SM'): string {
  const lines = SLASH_COMMANDS.map(
    (c) => `- **\`${c.usage}\`** — ${c.description}`
  ).join('\n');

  return `### Commandes rapides \`/\` — Si Driss (2BAC ${branch})

Tu peux utiliser ces raccourcis directement dans la barre de message (et taper \`/\` pour afficher l'autocomplétion) :

${lines}

**Exemples pratiques :**
- \`/cours Dipole RC\` ou \`/affiche cours 'onde1'\`
- \`/examen 2024 SR\` ou \`/affiche exercice ondes\`
- \`/courbe charge du condensateur RC\`
- \`/piege dipôles RC RL\`

*(Tu peux toujours écrire tes questions naturellement sans \`/\` !)*`;
}

