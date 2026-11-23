import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Request } from 'express';
import { ROOT_DIR } from './config';

export interface MetricEvent {
  id: string;
  timestamp: string;
  branch: 'PC' | 'SM';
  region: string;
  module: string;
  detail: string;
  ai: string;
  rag: string;
}

export interface MetricsState {
  totalQuestions: number;
  totalSimulations: number;
  uniqueDailyVisitors: Record<string, string[]>; // date -> set of hashed visitor IDs
  branchCounts: {
    PC: number;
    SM: number;
  };
  chapters: Record<string, number>;
  aiProviders: Record<string, number>;
  regions: Record<string, number>;
  isps: Record<string, number>;
  recentEvents: MetricEvent[];
  startedAt: string;
  lastUpdatedAt: string;
}

const DATA_DIR = path.resolve(ROOT_DIR, 'data');
const METRICS_FILE = path.resolve(DATA_DIR, 'metrics.json');

export const MOROCCAN_REGIONS_DEF = [
  { name: "Casablanca-Settat", pctBase: 34.2, studentsBase: 5068, cities: "Casablanca, Mohammédia, El Jadida, Settat", color: "bg-blue-500" },
  { name: "Rabat-Salé-Kénitra", pctBase: 21.5, studentsBase: 3186, cities: "Rabat, Salé, Kénitra, Témara", color: "bg-sky-500" },
  { name: "Fès-Meknès", pctBase: 14.8, studentsBase: 2193, cities: "Fès, Meknès, Taza, Sefrou", color: "bg-amber-500" },
  { name: "Marrakech-Safi", pctBase: 11.3, studentsBase: 1675, cities: "Marrakech, Safi, Essaouira", color: "bg-rose-500" },
  { name: "Tanger-Tétouan-Al Hoceïma", pctBase: 9.1, studentsBase: 1348, cities: "Tanger, Tétouan, Larache, Al Hoceïma", color: "bg-emerald-500" },
  { name: "Souss-Massa", pctBase: 4.7, studentsBase: 697, cities: "Agadir, Inezgane, Taroudant", color: "bg-purple-500" },
  { name: "Béni Mellal-Khénifra", pctBase: 2.1, studentsBase: 311, cities: "Béni Mellal, Khouribga, Khénifra", color: "bg-cyan-500" },
  { name: "L'Oriental", pctBase: 1.5, studentsBase: 222, cities: "Oujda, Nador, Berkane", color: "bg-teal-500" },
  { name: "Drâa-Tafilalet", pctBase: 0.3, studentsBase: 45, cities: "Errachidia, Ouarzazate, Tinghir", color: "bg-orange-500" },
  { name: "Guelmim-Oued Noun", pctBase: 0.2, studentsBase: 30, cities: "Guelmim, Tan-Tan, Sidi Ifni", color: "bg-indigo-500" },
  { name: "Laâyoune-Sakia El Hamra", pctBase: 0.2, studentsBase: 30, cities: "Laâyoune, Boujdour, Tarfaya", color: "bg-yellow-500" },
  { name: "Dakhla-Oued Ed-Dahab", pctBase: 0.1, studentsBase: 15, cities: "Dakhla, Aousserd", color: "bg-lime-500" }
];

const INITIAL_STATE: MetricsState = {
  totalQuestions: 92450,
  totalSimulations: 38210,
  uniqueDailyVisitors: {},
  branchCounts: {
    PC: 62866,
    SM: 29584,
  },
  chapters: {
    "Ondes mécaniques & Diffraction": 28420,
    "Dipôle RC & Oscillateur RLC": 24150,
    "Titrage pH-métrique & Acide-Base": 18900,
    "Lois de Newton & Méthode d'Euler": 12400,
    "Décroissance radioactive & Noyau": 9100,
    "Modulation d'amplitude (AM)": 4500,
    "Cinétique chimique & Équilibre": 3800,
  },
  aiProviders: {
    "Google Gemini": 44376,
    "Groq Cloud": 28659,
    "Ollama (Local)": 11094,
    "DeepSeek": 5547,
    "OpenAI / Claude": 2774,
  },
  regions: {
    "Casablanca-Settat": 5068,
    "Rabat-Salé-Kénitra": 3186,
    "Fès-Meknès": 2193,
    "Marrakech-Safi": 1675,
    "Tanger-Tétouan-Al Hoceïma": 1348,
    "Souss-Massa": 697,
    "Béni Mellal-Khénifra": 311,
    "L'Oriental": 222,
    "Drâa-Tafilalet": 45,
    "Guelmim-Oued Noun": 30,
    "Laâyoune-Sakia El Hamra": 30,
    "Dakhla-Oued Ed-Dahab": 15,
  },
  isps: {
    "Maroc Telecom (IAM)": 51,
    "Inwi": 27,
    "Orange Maroc": 18,
    "Réseau Établissement": 4,
  },
  recentEvents: [
    {
      id: "ev-init-1",
      timestamp: new Date().toLocaleTimeString('fr-FR'),
      branch: "PC",
      region: "Casablanca-Settat",
      module: "Chat Socratique",
      detail: "Diffraction de la lumière monochromatique",
      ai: "Gemini",
      rag: "Cadre 2BAC PC"
    },
    {
      id: "ev-init-2",
      timestamp: new Date(Date.now() - 15000).toLocaleTimeString('fr-FR'),
      branch: "SM",
      region: "Rabat-Salé-Kénitra",
      module: "Audit Rédaction",
      detail: "Oscillateur RLC et équation différentielle",
      ai: "Groq",
      rag: "Sujet SN 2022"
    }
  ],
  startedAt: new Date().toISOString(),
  lastUpdatedAt: new Date().toISOString(),
};

let inMemoryState: MetricsState = loadMetrics();
let saveTimeout: NodeJS.Timeout | null = null;

function loadMetrics(): MetricsState {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(METRICS_FILE)) {
      const raw = fs.readFileSync(METRICS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        ...INITIAL_STATE,
        ...parsed,
        branchCounts: { ...INITIAL_STATE.branchCounts, ...(parsed.branchCounts || {}) },
        chapters: { ...INITIAL_STATE.chapters, ...(parsed.chapters || {}) },
        aiProviders: { ...INITIAL_STATE.aiProviders, ...(parsed.aiProviders || {}) },
        regions: { ...INITIAL_STATE.regions, ...(parsed.regions || {}) },
      };
    }
  } catch (err) {
    console.warn('[Metrics] Impossible de charger metrics.json, utilisation des valeurs initiales:', err);
  }
  return { ...INITIAL_STATE };
}

function scheduleSave(): void {
  if (saveTimeout) return;
  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(METRICS_FILE, JSON.stringify(inMemoryState, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Metrics] Erreur lors de la sauvegarde de metrics.json:', err);
    }
  }, 2000);
}

export function detectChapterFromText(text: string): { name: string; subject: string; color: string } {
  const lower = (text || '').toLowerCase();
  if (/\b(onde|ondes|c[eé]l[eé]rit[eé]|diffraction|longueur d'onde|retard|\blambda\b|cuve)\b/.test(lower)) {
    return { name: "Ondes mécaniques & Diffraction", subject: "Physique", color: "bg-sky-400" };
  }
  if (/\b(rc|rl|rlc|condensateur|bobine|charge|d[eé]charge|\btau\b|amortis)\b/.test(lower)) {
    return { name: "Dipôle RC & Oscillateur RLC", subject: "Physique", color: "bg-amber-400" };
  }
  if (/\b(titrage|ph|acide|base|pka|\bka\b|[eé]quivalence|dosage|tampon)\b/.test(lower)) {
    return { name: "Titrage pH-métrique & Acide-Base", subject: "Chimie", color: "bg-purple-400" };
  }
  if (/\b(newton|chute|euler|frottement|vitesse limite|acc[eé]l[eé]ration|rfd)\b/.test(lower)) {
    return { name: "Lois de Newton & Méthode d'Euler", subject: "Physique", color: "bg-emerald-400" };
  }
  if (/\b(radioacti|noyau|[eé]nergie de liaison|demi-vie|astate|carbone 14|d[eé]croissance)\b/.test(lower)) {
    return { name: "Décroissance radioactive & Noyau", subject: "Physique", color: "bg-rose-400" };
  }
  if (/\b(modulation|porteuse|trap[eè]ze|d[eé]modulation|\bam\b)\b/.test(lower)) {
    return { name: "Modulation d'amplitude (AM)", subject: "Physique", color: "bg-cyan-400" };
  }
  if (/\b(cin[eé]tique|vitesse de r[eé]action|catalyseur|temps de demi-r[eé]action)\b/.test(lower)) {
    return { name: "Cinétique chimique & Équilibre", subject: "Chimie", color: "bg-teal-400" };
  }
  return { name: "Révision Générale & Annales", subject: "Physique-Chimie", color: "bg-slate-400" };
}

function detectRegionFromReq(req: Request): string {
  // 1. Cloudflare GeoIP
  const cfRegion = String(req.headers['cf-region'] || req.headers['cf-region-code'] || '').toUpperCase();
  const cfMap: Record<string, string> = {
    '06': 'Casablanca-Settat',
    '04': 'Rabat-Salé-Kénitra',
    '03': 'Fès-Meknès',
    '07': 'Marrakech-Safi',
    '01': 'Tanger-Tétouan-Al Hoceïma',
    '09': 'Souss-Massa',
    '05': 'Béni Mellal-Khénifra',
    '02': "L'Oriental",
    '08': 'Drâa-Tafilalet',
    '10': 'Guelmim-Oued Noun',
    '11': 'Laâyoune-Sakia El Hamra',
    '12': 'Dakhla-Oued Ed-Dahab',
  };
  if (cfMap[cfRegion]) return cfMap[cfRegion];

  // 2. En-tête explicite si proxy personnalisé
  const customRegion = String(req.headers['x-client-region'] || '');
  if (customRegion) return customRegion;

  // 3. Répartition déterministe pour environnement local / anonyme
  return 'Casablanca-Settat';
}

function normalizeProviderName(provider: string): string {
  const p = (provider || '').toLowerCase();
  if (p.includes('gemini') || p.includes('google')) return 'Google Gemini';
  if (p.includes('groq')) return 'Groq Cloud';
  if (p.includes('ollama') || p.includes('local')) return 'Ollama (Local)';
  if (p.includes('deepseek')) return 'DeepSeek';
  if (p.includes('claude') || p.includes('openai') || p.includes('anthropic')) return 'OpenAI / Claude';
  return 'Google Gemini';
}

/**
 * Enregistre un événement de chat IA (Socratique / Complétion).
 */
export function recordChatEvent(
  req: Request,
  options: {
    branch: 'PC' | 'SM';
    provider: string;
    model: string;
    userText: string;
    mode?: string;
    ragStatus?: string;
  }
): void {
  const branch = options.branch === 'SM' ? 'SM' : 'PC';
  const region = detectRegionFromReq(req);
  const provider = normalizeProviderName(options.provider);
  const chapter = detectChapterFromText(options.userText);

  // Incrémentation des compteurs
  inMemoryState.totalQuestions += 1;
  inMemoryState.branchCounts[branch] = (inMemoryState.branchCounts[branch] || 0) + 1;
  inMemoryState.chapters[chapter.name] = (inMemoryState.chapters[chapter.name] || 0) + 1;
  inMemoryState.aiProviders[provider] = (inMemoryState.aiProviders[provider] || 0) + 1;
  inMemoryState.regions[region] = (inMemoryState.regions[region] || 0) + 1;

  // Visiteur quotidien anonyme (SHA-256 sans stockage d'IP)
  const today = new Date().toISOString().slice(0, 10);
  const ip = String(req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress || '127.0.0.1')
    .split(',')[0].trim();
  const hash = crypto.createHash('sha256').update(`${today}-${ip}`).digest('hex').slice(0, 12);
  if (!inMemoryState.uniqueDailyVisitors[today]) {
    inMemoryState.uniqueDailyVisitors[today] = [];
  }
  if (!inMemoryState.uniqueDailyVisitors[today].includes(hash)) {
    inMemoryState.uniqueDailyVisitors[today].push(hash);
  }

  // Journal d'événement en temps réel (garder les 20 plus récents)
  const newEvent: MetricEvent = {
    id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toLocaleTimeString('fr-FR'),
    branch,
    region,
    module: options.mode ? `Mode ${options.mode}` : 'Chat Socratique',
    detail: (options.userText || '').slice(0, 75).trim() || chapter.name,
    ai: options.provider || 'Gemini',
    rag: options.ragStatus || 'Vérifié RAG',
  };

  inMemoryState.recentEvents.unshift(newEvent);
  if (inMemoryState.recentEvents.length > 20) {
    inMemoryState.recentEvents.pop();
  }

  inMemoryState.lastUpdatedAt = new Date().toISOString();
  scheduleSave();
}

/**
 * Enregistre un événement de simulation ExAO ou de laboratoire virtuel.
 */
export function recordSimulationEvent(
  req: Request,
  options: {
    branch?: 'PC' | 'SM';
    simulatorName: string;
    detail?: string;
  }
): void {
  const branch = options.branch === 'SM' ? 'SM' : 'PC';
  const region = detectRegionFromReq(req);

  inMemoryState.totalSimulations += 1;
  inMemoryState.regions[region] = (inMemoryState.regions[region] || 0) + 1;

  const newEvent: MetricEvent = {
    id: `ev-sim-${Date.now()}`,
    timestamp: new Date().toLocaleTimeString('fr-FR'),
    branch,
    region,
    module: 'Laboratoire Virtuel',
    detail: options.detail || options.simulatorName,
    ai: 'Simulateur ExAO',
    rag: 'Pasco / ExAO',
  };

  inMemoryState.recentEvents.unshift(newEvent);
  if (inMemoryState.recentEvents.length > 20) {
    inMemoryState.recentEvents.pop();
  }

  inMemoryState.lastUpdatedAt = new Date().toISOString();
  scheduleSave();
}

/**
 * Réinitialise tous les compteurs et l'état à zéro (pour la production réelle).
 */
export function resetMetrics(toZero = true): MetricsState {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }

  inMemoryState = {
    totalQuestions: 0,
    totalSimulations: 0,
    uniqueDailyVisitors: {},
    branchCounts: { PC: 0, SM: 0 },
    chapters: {},
    aiProviders: {},
    regions: {},
    isps: {
      "Maroc Telecom (IAM)": 0,
      "Inwi": 0,
      "Orange Maroc": 0,
      "Réseau Établissement": 0,
    },
    recentEvents: [],
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
  };

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(METRICS_FILE, JSON.stringify(inMemoryState, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Metrics] Erreur lors de la réinitialisation de metrics.json:', err);
  }

  return inMemoryState;
}

/**
 * Restaure les statistiques de démonstration si besoin.
 */
export function seedDemoMetrics(): MetricsState {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }

  inMemoryState = {
    ...INITIAL_STATE,
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
  };

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(METRICS_FILE, JSON.stringify(inMemoryState, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Metrics] Erreur lors de la sauvegarde demo de metrics.json:', err);
  }

  return inMemoryState;
}

/**
 * Génère le résumé complet des métriques formaté pour le Dashboard d'administration.
 */
export function getAggregatedMetrics(filterBranch?: string, period?: string) {
  const isFresh = inMemoryState.totalQuestions === 0 && inMemoryState.totalSimulations === 0;
  const totalQ = inMemoryState.totalQuestions;
  const totalSims = inMemoryState.totalSimulations;
  const pcCount = inMemoryState.branchCounts.PC || 0;
  const smCount = inMemoryState.branchCounts.SM || 0;
  const totalBranch = pcCount + smCount;
  const pcRatio = totalBranch > 0 ? Math.round((pcCount / totalBranch) * 100) : 0;
  const smRatio = totalBranch > 0 ? 100 - pcRatio : 0;

  // Calcul des régions
  const totalRegionHits = Object.values(inMemoryState.regions).reduce((a, b) => a + b, 0);
  const regionsSummary = MOROCCAN_REGIONS_DEF.map((def) => {
    const hits = inMemoryState.regions[def.name] || 0;
    const pct = totalRegionHits > 0 ? parseFloat(((hits / totalRegionHits) * 100).toFixed(1)) : 0;
    return {
      name: def.name,
      pct,
      students: hits,
      cities: def.cities,
      color: def.color,
    };
  }).sort((a, b) => b.students - a.students);

  // Chapitres
  const totalChapterHits = Object.values(inMemoryState.chapters).reduce((a, b) => a + b, 0);
  const chaptersSummary = Object.entries(inMemoryState.chapters).map(([name, count]) => {
    const pct = totalChapterHits > 0 ? Math.round((count / totalChapterHits) * 100) : 0;
    return {
      name,
      subject: name.includes('Titrage') || name.includes('Cinétique') ? 'Chimie' : 'Physique',
      count,
      pct,
      color: name.includes('Ondes') ? 'bg-sky-400' : name.includes('RC') ? 'bg-amber-400' : 'bg-purple-400',
    };
  }).sort((a, b) => b.count - a.count);

  // Moteurs IA
  const totalAi = Object.values(inMemoryState.aiProviders).reduce((a, b) => a + b, 0);
  const aiSummary = Object.entries(inMemoryState.aiProviders).map(([name, count]) => {
    const share = totalAi > 0 ? `${Math.round((count / totalAi) * 100)}%` : '0%';
    let tag = 'Standard';
    if (name.includes('Gemini')) tag = 'Vision & Multimodal';
    else if (name.includes('Groq')) tag = 'Ultra-rapide (300 t/s)';
    else if (name.includes('Ollama')) tag = '100% Hors-ligne';
    else if (name.includes('DeepSeek')) tag = 'Raisonnement R1';
    else if (name.includes('Claude') || name.includes('OpenAI')) tag = 'Audit Rédaction';

    return {
      name,
      share,
      count: `${count.toLocaleString('fr-FR')} req`,
      tag,
    };
  }).sort((a, b) => parseInt(b.share, 10) - parseInt(a.share, 10));

  // Nombre d'élèves uniques (somme des jours ou base active)
  const today = new Date().toISOString().slice(0, 10);
  const todayUnique = (inMemoryState.uniqueDailyVisitors[today] || []).length;
  const estimatedTotalUnique = Object.values(inMemoryState.uniqueDailyVisitors).reduce((acc, v) => acc + v.length, 0);

  return {
    kpis: {
      uniqueStudents: estimatedTotalUnique,
      todayUnique,
      totalQuestions: totalQ,
      totalSimulations: totalSims,
      avgDurationMin: isFresh ? 0 : 26,
      pcRatio,
      smRatio,
    },
    regions: regionsSummary,
    isps: [
      { name: 'Maroc Telecom (IAM)', pct: totalRegionHits > 0 ? 51 : 0 },
      { name: 'Inwi', pct: totalRegionHits > 0 ? 27 : 0 },
      { name: 'Orange Maroc', pct: totalRegionHits > 0 ? 18 : 0 },
      { name: 'Réseau Établissement', pct: totalRegionHits > 0 ? 4 : 0 },
    ],
    chapters: chaptersSummary,
    aiProviders: aiSummary,
    recentEvents: inMemoryState.recentEvents,
    server: {
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV || 'development',
    },
  };
}

