import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PDFParse } from 'pdf-parse';
import { DOCS_DIR } from './config';
import {
  SCIENTIFIC_VISION_MARKER,
  extractScannedPdfFullContent,
  extractVisualDataFromPdfDetailed,
  isLikelyGeminiKey,
} from './visionExtractor';

interface CachedDocSection {
  raw: string;
  lower: string;
  arabicNorm: string;
}

export type DocumentBranch = 'PC' | 'SM' | 'ALL';

export type DocumentCategory = 'examens' | 'series' | 'corriges' | 'cours' | 'cadres' | 'autre';

interface CachedDoc {
  name: string;
  relativePath: string;
  absolutePath: string;
  branch: DocumentBranch;
  category: DocumentCategory;
  mtime: number;
  sections: CachedDocSection[];
}

export interface OfficialSyncStatus {
  running: boolean;
  phase: 'idle' | 'drive_sync' | 'text_indexing' | 'vision_decoding' | 'completed' | 'partial_rate_limit' | 'error';
  branch: 'PC' | 'SM';
  totalPdfs: number;
  processedPdfs: number;
  decodedCount: number;
  alreadyDecodedCount: number;
  skippedCount: number;
  failedCount: number;
  driveSyncCount: number;
  currentFile: string;
  message: string;
  lastError?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface DiscoveredFile {
  absolutePath: string;
  relativePath: string;
  name: string;
  branch: DocumentBranch;
  category: DocumentCategory;
  mtime: number;
}

let documentsCache: CachedDoc[] = [];
let lastCacheRefreshTime = 0;
let inflightRefresh: Promise<ReturnType<typeof getLocalRagStatus>> | null = null;

/**
 * Normalise le texte arabe (NFKC, suppression tashkeel, tatweel, unification des variantes d'alef, yeh et kaf).
 * Essentiel pour les PDF d'examens nationaux marocains extraits avec des formes de présentation arabes.
 */
export function normalizeArabic(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670]/g, '') // suppression des voyelles brèves / harakat
    .replace(/\u0640/g, '') // suppression du tatweel
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627') // variantes d'alef -> alef simple
    .replace(/[\u0649\u06CC]/g, '\u064A') // alef maksura & farsi yeh -> yeh
    .replace(/\u06A9/g, '\u0643') // farsi keheh -> kaf arabe
    .replace(/\u0629/g, '\u0647'); // teh marbuta -> heh
}

/**
 * Normalise un texte tout en conservant une table d'indices vers la chaîne brute,
 * afin d'éviter tout décalage de découpage causé par la suppression des harakat/tatweel
 * ou l'expansion NFKC des ligatures arabes.
 */
function normalizeArabicWithIndexMap(raw: string): { normalized: string; toRawIndex: number[] } {
  let normalized = '';
  const toRawIndex: number[] = [];
  const clusterRegex = /\P{M}\p{M}*|\p{M}+/gu;
  let m: RegExpExecArray | null;
  while ((m = clusterRegex.exec(raw)) !== null) {
    const rawPos = m.index;
    const normCluster = normalizeArabic(m[0]);
    for (let k = 0; k < normCluster.length; k++) {
      normalized += normCluster[k];
      toRawIndex.push(rawPos);
    }
  }
  toRawIndex.push(raw.length);
  return { normalized, toRawIndex };
}

export type ExamTopic = 'ondes' | 'nucleaire' | 'electricite' | 'mecanique' | 'chimie';

export interface ParsedExamQuery {
  isExamQuery: boolean;
  year: number | null;
  session: 'SN' | 'SR' | null;
  topic: ExamTopic | null;
  exerciseNumber: number | null;
}

/**
 * Analyse la requête utilisateur pour identifier les demandes d'examens nationaux (année, session, thème, numéro d'exercice).
 */
export function parseExamQuery(query: string): ParsedExamQuery {
  const q = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  // 1. Détection de l'année (2000 - 2029, incluant 2008-2009)
  const yearMatch = q.match(/\b(20[012]\d)\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

  // 2. Détection de la session (Normale vs Rattrapage)
  let session: 'SN' | 'SR' | null = null;
  if (/\b(normale|session\s*normale|principale|sn)\b/i.test(q)) {
    session = 'SN';
  } else if (/\b(rattrapage|session\s*de\s*rattrapage|sr)\b/i.test(q)) {
    session = 'SR';
  }

  // 3. Détection du thème disciplinaire (sans accents grâce au NFD ci-dessus)
  let topic: ExamTopic | null = null;
  if (/\b(onde|ondes|ultrason|lumineus|sonor|optique|laser|diffraction|propagation|fibre)\b/i.test(q)) {
    topic = 'ondes';
  } else if (/\b(nucleaire|nucleaires|radioactiv|decroissance|astate|polonium|uranium|radium|noyau)\b/i.test(q)) {
    topic = 'nucleaire';
  } else if (/\b(electr|electricite|rlc|circuit|condensateur|bobine|dipole|modulation)\b/i.test(q)) {
    topic = 'electricite';
  } else if (/\b(mecan|mecanique|newton|chute|projectile|satellite|planete|oscillat|pendule)\b/i.test(q)) {
    topic = 'mecanique';
  } else if (/\b(chimie|acide|base|titrage|dosage|ester|pile|electrolyse)\b/i.test(q)) {
    topic = 'chimie';
  }

  // 4. Détection éventuelle du numéro d'exercice (ex: "exercice 2", "ex II")
  let exerciseNumber: number | null = null;
  const exNumMatch = q.match(/\b(?:exercice|exercise|ex)\s*(?:n[°o]?\s*)?(1|2|3|4|5|iv|iii|ii|i|v)\b/i);
  if (exNumMatch) {
    const token = exNumMatch[1].toLowerCase();
    const romanMap: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5 };
    exerciseNumber = romanMap[token] || parseInt(token, 10) || null;
  }

  // 5. Détection de requêtes de cours, définitions, formules, pièges ou cadre de référence
  const isTheoryOrDefinitionOrTrap = /\b(definition|definir|cadre\s*(?:de)?\s*reference|cours|formule|resume|piege|pieges|c'est\s*quoi|qu'est[- ]ce\s*que|que\s*signifie|sens\s*physique|enonce\s*(?:de\s*la)?\s*loi)\b/i.test(q);

  // Demande explicite d'ouverture d'un sujet, d'une annale ou d'un exercice d'examen officiel du National
  // IMPORTANT : Les termes génériques isolés ("sujet", "epreuve", "exercice") seuls NE DOIVENT PAS suffire,
  // car l'élève les emploie couramment pour son propre devoir ou un exercice uploadé.
  const hasNationalOrExamQualifier = /\b(national|nationaux|officiel|officielle|annale|annales|du\s*bac|d'examen)\b/i.test(q);
  const isExplicitExamPaperRequest =
    (/\b(?:sujet|epreuve|annale|examen)\s+(?:du\s*national|d'examen|du\s*bac|officiel)\b/i.test(q) ||
     /\b(?:exercice\s+(?:du\s*national|du\s*bac|d'examen\s*national))\b/i.test(q) ||
     /\b(?:examen\s+national|bac\s+national|annale\s+du\s+bac)\b/i.test(q) ||
     (/\b(?:affiche|ouvre|montre|consulter|voir|resoudre)\s+(?:le|l'|un)?\s*(?:sujet|epreuve|examen|annale)\b/i.test(q) && hasNationalOrExamQualifier));

  // Une requête est qualifiée d'examen (recherche d'un PDF d'annale officiel) uniquement si :
  // - Elle n'est PAS une requête de définition / théorie / piège / cadre sans année explicite,
  // - ET qu'elle contient SOIT une année d'examen explicite accompagnée d'une qualification d'examen (ex: "National 2015", "SN 2023", "Bac 2026"),
  //   SOIT une demande explicite d'épreuve/sujet/annale nationale (ex: "affiche un exercice des ondes du national").
  const hasExplicitExamYear = Boolean(year && (hasNationalOrExamQualifier || session || /\b(bac|session)\b/i.test(q)));
  const isExamQuery = !isTheoryOrDefinitionOrTrap && (hasExplicitExamYear || isExplicitExamPaperRequest);

  return { isExamQuery, year, session, topic, exerciseNumber };
}

const EXERCISE_HEADING_RE =
  /^\s*(?:EXERCICE|EXERCISE)\s*(?:[1-5]|[I]{1,3}|IV|V)\b|^\s*التمرين\s*(?:الأول|الثاني|الثالث|الرابع|الخامس|[1-5])/im;

const NEXT_SECTION_FOR_TOPIC: Record<ExamTopic, RegExp[]> = {
  chimie: [/التمرين\s*(الثاني|2)/i, /الموج/i, /EXERCICE\s*(?:2|II)\b/i, /EXERCISE\s*(?:2|II|1)\b/i, /Physics\s*\(/i, /Physique\s*\(/i, EXERCISE_HEADING_RE],
  ondes: [/النوو/i, /التمرين\s*(الثالث|3)/i, /الكهرب/i, /EXERCICE\s*(?:3|III)\b/i, /EXERCISE\s*(?:2|3|II|III)\b/i, /Nucl[eé]aire/i, /Nuclear/i, /[EÉ]lectricit[eé]/i, /Electricity/i, EXERCISE_HEADING_RE],
  nucleaire: [/التمرين\s*(الثالث|3|الرابع|4)/i, /الكهرب/i, /EXERCICE\s*(?:3|4|III|IV)\b/i, /EXERCISE\s*(?:3|4|III|IV)\b/i, /[EÉ]lectricit[eé]/i, /Electricity/i, EXERCISE_HEADING_RE],
  electricite: [/التمرين\s*(الرابع|4|الخامس|5)/i, /الميكانيك/i, /EXERCICE\s*(?:4|5|IV|V)\b/i, /EXERCISE\s*(?:3|4|5|III|IV|V)\b/i, /M[eé]canique/i, /Mechanics/i, EXERCISE_HEADING_RE],
  mecanique: [/===+\s*TRANSCRIPTION\s*VISUELLE/i, /^\s*FIN\s*(?:DE\s*L['’]ÉPREUVE|DU\s*SUJET)?\s*$/im, EXERCISE_HEADING_RE],
};

const TOPIC_VISION_PATTERNS: Record<ExamTopic, RegExp[]> = {
  ondes: [/\bonde/i, /lumineus/i, /fibre/i, /diffraction/i, /laser/i],
  nucleaire: [/nucl[eé]aire/i, /radioactiv/i, /d[eé]croissance/i, /astate/i, /noyau/i],
  electricite: [/rc/i, /rl/i, /rlc/i, /[eé]lectricit[eé]/i, /modulation/i, /condensateur/i],
  mecanique: [/m[eé]canique/i, /golf/i, /satellite/i, /oscillateur/i, /chute/i, /pendule/i],
  chimie: [/chimie/i, /acide/i, /base/i, /ester/i, /titrage/i, /pile/i],
};

export interface OfficialSourceRef {
  name: string;
  relativePath: string;
  branch: DocumentBranch;
  category?: DocumentCategory;
  year?: number | null;
  session?: 'SN' | 'SR' | null;
  topic?: ExamTopic | null;
  pages: number[];
  totalPages: number;
  isPdf: boolean;
}

interface PageMarker {
  page: number;
  total: number;
  index: number;
}

function extractPageMarkers(bodyContent: string): PageMarker[] {
  const markers: PageMarker[] = [];
  const re = /^--\s*(\d+)\s+of\s+(\d+)\s*--$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bodyContent)) !== null) {
    const page = parseInt(m[1], 10);
    const total = parseInt(m[2], 10);
    if (Number.isFinite(page) && page >= 1) {
      markers.push({ page, total: Number.isFinite(total) ? total : page, index: m.index });
    }
  }
  return markers;
}

function offsetToPage(offset: number, markers: PageMarker[]): number {
  for (const marker of markers) {
    if (offset <= marker.index) {
      return marker.page;
    }
  }
  return markers.length > 0 ? markers[markers.length - 1].page : 1;
}

function computeExamPageRange(
  bodyContent: string,
  rawStart: number,
  rawEnd: number,
  matchedSection: boolean,
  topic: ExamTopic | null
): { pages: number[]; totalPages: number } {
  const markers = extractPageMarkers(bodyContent);
  if (markers.length === 0) {
    return { pages: [1], totalPages: 1 };
  }

  const totalPages = Math.max(markers.length, ...markers.map((m) => m.total));

  if (!matchedSection) {
    const cleanBodyLen = bodyContent.replace(/^--\s*\d+\s+of\s+\d+\s*--$/gm, '').trim().length;
    if (cleanBodyLen < 150 && topic && totalPages >= 3) {
      const heuristicByTopic: Record<ExamTopic, number> = {
        chimie: 1,
        ondes: Math.min(2, totalPages),
        nucleaire: Math.min(3, totalPages),
        electricite: Math.min(4, totalPages),
        mecanique: Math.max(1, totalPages - 1),
      };
      return { pages: [heuristicByTopic[topic]], totalPages };
    }
    return { pages: [1], totalPages };
  }

  const startPage = Math.max(1, Math.min(totalPages, offsetToPage(rawStart, markers)));
  const safeEndOffset = Math.max(rawStart, rawEnd - 1);
  const endPage = Math.max(startPage, Math.min(totalPages, offsetToPage(safeEndOffset, markers)));
  const pages: number[] = [];
  for (let p = startPage; p <= Math.min(endPage, startPage + 3); p++) {
    pages.push(p);
  }
  return { pages: pages.length > 0 ? pages : [1], totalPages };
}

function findSectionByExerciseNumber(normBody: string, exerciseNumber: number): { start: number; end: number } | null {
  const romanList = ['', 'I', 'II', 'III', 'IV', 'V'];
  const arList = ['', 'الاول', 'الثاني', 'الثالث', 'الرابع', 'الخامس'];
  const roman = romanList[exerciseNumber] || '';
  const arOrd = arList[exerciseNumber] || '';
  const numPattern = roman
    ? `(?:${exerciseNumber}|${roman})`
    : String(exerciseNumber);
  const arPattern = arOrd ? `(?:${arOrd}|${exerciseNumber})` : String(exerciseNumber);

  const targetRe = new RegExp(
    `(?:^\\s*(?:EXERCICE|EXERCISE)\\s*${numPattern}\\b|^\\s*(?:التمرين\\s*${arPattern}|${arPattern}\\s*التمرين)(?:\\s|\\(|$))`,
    'gim'
  );

  let matchIdx = -1;
  for (const m of normBody.matchAll(targetRe)) {
    if (m.index !== undefined && m.index > 950) {
      matchIdx = m.index;
      break;
    } else if (m.index !== undefined && matchIdx === -1) {
      matchIdx = m.index;
    }
  }
  if (matchIdx === -1) return null;

  const after = normBody.slice(matchIdx + 80);
  const arOrdAll = '(?:الاول|الثاني|الثالث|الرابع|الخامس|[1-5])';
  const nextRe = new RegExp(
    `^\\s*(?:EXERCICE|EXERCISE)\\s*(?:[1-5]|[I]{1,3}|IV|V)\\b|^\\s*(?:التمرين\\s*${arOrdAll}|${arOrdAll}\\s*التمرين)(?:\\s|\\(|$)|===+\\s*TRANSCRIPTION\\s*VISUELLE`,
    'im'
  );
  const nextMatch = after.search(nextRe);
  const endIdx = nextMatch !== -1 ? matchIdx + 80 + nextMatch : Math.min(normBody.length, matchIdx + 3500);
  return { start: matchIdx, end: endIdx };
}

/**
 * Extrait précisément l'énoncé d'un exercice et ses données visuelles (graphes/schémas décodés).
 */
export function extractExamExercise(
  rawContent: string,
  topic: ExamTopic | null,
  exerciseNumber: number | null = null
): {
  exerciseText: string;
  visualText: string;
  rawStart: number;
  rawEnd: number;
  matchedSection: boolean;
} {
  let bodyContent = rawContent;
  let visionContent = '';

  const markerIdx = rawContent.indexOf(SCIENTIFIC_VISION_MARKER);
  if (markerIdx !== -1) {
    bodyContent = rawContent.slice(0, markerIdx);
    visionContent = rawContent.slice(markerIdx);
  }

  // 1. Découpage et extraction de la transcription visuelle spécifique au thème
  let visualText = '';
  if (visionContent && topic) {
    const blocks = visionContent.split(/(?=---\s*\[FIGURE\s*\/\s*SCHÉMA\s*DÉCODÉ)/g);
    for (const block of blocks) {
      const matchTopic = TOPIC_VISION_PATTERNS[topic].some((re) => re.test(block));
      if (matchTopic) {
        visualText += block.trim() + '\n\n';
      }
    }
  }
  if (!visualText && visionContent) {
    visualText = visionContent.slice(0, 2500);
  }

  const { normalized: normBody, toRawIndex } = normalizeArabicWithIndexMap(bodyContent);

  if (!topic && exerciseNumber) {
    const byNum = findSectionByExerciseNumber(normBody, exerciseNumber);
    if (byNum) {
      const rawStart = toRawIndex[Math.min(byNum.start, toRawIndex.length - 1)] ?? 0;
      const rawEnd = toRawIndex[Math.min(byNum.end, toRawIndex.length - 1)] ?? bodyContent.length;
      return {
        exerciseText: bodyContent.slice(rawStart, rawEnd).trim(),
        visualText: visualText.trim(),
        rawStart,
        rawEnd,
        matchedSection: true,
      };
    }
  }

  if (!topic) {
    const fallbackEnd = Math.min(bodyContent.length, 3500);
    return {
      exerciseText: bodyContent.slice(0, fallbackEnd),
      visualText: visualText.trim(),
      rawStart: 0,
      rawEnd: fallbackEnd,
      matchedSection: false,
    };
  }

  const topicArPats: Record<ExamTopic, RegExp[]> = {
    ondes: [/الموجات/i, /موج/i],
    nucleaire: [/النوو/i, /التحولات\s*النووية/i],
    electricite: [/الكهرب/i, /ثنائي\s*القطب/i],
    mecanique: [/الميكانيك/i, /نيوتن/i],
    chimie: [/الكيمياء/i, /حمض/i],
  };

  const topicFrPats: Record<ExamTopic, RegExp[]> = {
    ondes: [
      /exercic?e\s*(?:[1-5]|[I]{1,3}|IV|V)?[^\n]{0,60}\b(?:ondes?|waves?|ultrason)/i,
      /\bpropagation\s+d['’]une\s+onde/i,
      /\bondes?\s+(?:lumineuses?|sonores?|ultrasonores?|m[eé]caniques?)/i,
      /\bultrasonic\s+waves?\b/i,
      /\blight\s+waves?\b/i,
    ],
    nucleaire: [
      /exercic?e\s*(?:[1-5]|[I]{1,3}|IV|V)?[^\n]{0,60}\b(?:physique\s+nucl[eé]aire|nucl[eé]aires?|nuclear|radioactiv|d[eé]sint[eé]gration)/i,
      /\bd[eé]croissance\s+radioactive\b/i,
      /\bradioactive\s+decay\b/i,
    ],
    electricite: [
      /exercic?e\s*(?:[1-5]|[I]{1,3}|IV|V)?[^\n]{0,60}\b(?:[eé]lectricit[eé]|electricity|electric\s+system|dip[oô]le|circuit)/i,
      /\br[eé]ponse\s+d['’]un\s+dip/i,
      /\bdischarge\s+of\s+a\s+capacitor\b/i,
    ],
    mecanique: [
      /exercic?e\s*(?:[1-5]|[I]{1,3}|IV|V)?[^\n]{0,60}\b(?:m[eé]canique|mechanics|mouvement)/i,
      /\bmouvement\s+d['’]un\b/i,
      /\bmotion\s+of\s+a\b/i,
    ],
    chimie: [
      /exercic?e\s*(?:[1-5]|[I]{1,3}|IV|V)?[^\n]{0,60}\b(?:chimie|chemistry)/i,
      /\b[eé]tude\s+d['’]une\s+solution\b/i,
      /^(?:chimie|chemistry)\s*\(\s*\d/im,
    ],
  };

  const topicBodyKeywords: Record<ExamTopic, RegExp[]> = {
    ondes: [/\bondes?\b/i, /\bwaves?\b/i, /ultrason/i, /diffraction/i, /c[eé]l[eé]rit[eé]/i, /longueur\s+d['’]onde/i, /wavelength/i],
    nucleaire: [/nucl[eé]aire/i, /\bnuclear\b/i, /radioactiv/i, /d[eé]sint[eé]gration/i, /demi-vie/i, /half-life/i, /isotope/i, /fission|fusion/i, /\bnoyau\b/i],
    electricite: [/[eé]lectric/i, /\belectric/i, /condensateur/i, /capacitor/i, /bobine/i, /inductor/i, /dip[oô]le/i, /\brlc\b/i, /modulation/i],
    mecanique: [/m[eé]canique/i, /mechanics/i, /newton/i, /chute/i, /projectile/i, /pendule|pendulum/i, /satellite/i, /ressort|spring/i],
    chimie: [/chimie/i, /chemistry/i, /acide|acid/i, /titrage|titration/i, /est[eé]rif/i, /pile|battery/i, /[eé]lectrolyse|electrolysis/i, /\bpH\b/],
  };

  let bestStart = -1;
  // Recherche en arabe d'abord (sur normBody)
  for (const re of topicArPats[topic]) {
    const matches = [...normBody.matchAll(new RegExp(re, 'gi'))];
    for (const m of matches) {
      if (m.index !== undefined) {
        // Préférer l'exercice situé après le sommaire (sommaire < 1000 chars)
        if (m.index > 1000) {
          bestStart = m.index;
          break;
        } else if (bestStart === -1) {
          bestStart = m.index;
        }
      }
    }
    if (bestStart > 1000) break;
  }

  // Si non trouvé en arabe, recherche en français/anglais sur normBody en sautant le sommaire
  if (bestStart <= 1000) {
    let frBest = -1;
    for (const re of topicFrPats[topic]) {
      const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
      for (const m of normBody.matchAll(new RegExp(re.source, flags))) {
        if (m.index === undefined) continue;
        if (m.index > 950) {
          frBest = m.index;
          break;
        } else if (frBest === -1) {
          frBest = m.index;
        }
      }
      if (frBest > 950) break;
    }
    if (frBest !== -1) {
      bestStart = frBest;
    }
  }

  // Repli sur le découpage par en-têtes d'exercices (ex: "EXERCICE 2 (2,5 points)" sans sous-titre)
  if (bestStart === -1) {
    const headingRe = /^\s*(?:EXERCICE|EXERCISE)\s*(?:[1-5]|[I]{1,3}|IV|V)\b/gim;
    const headingIndices: number[] = [];
    for (const m of normBody.matchAll(headingRe)) {
      if (m.index !== undefined && m.index > 950) {
        headingIndices.push(m.index);
      }
    }
    let fallbackIdx = -1;
    let fallbackScore = 0;
    for (let i = 0; i < headingIndices.length; i++) {
      const start = headingIndices[i];
      const end = i + 1 < headingIndices.length ? headingIndices[i + 1] : Math.min(normBody.length, start + 2500);
      const slice = normBody.slice(start, Math.min(end, start + 2500));
      let score = 0;
      for (const kw of topicBodyKeywords[topic]) {
        if (kw.test(slice)) score++;
      }
      if (score >= 2) {
        bestStart = start;
        break;
      }
      if (score > fallbackScore) {
        fallbackScore = score;
        fallbackIdx = start;
      }
    }
    if (bestStart === -1 && fallbackIdx !== -1) {
      bestStart = fallbackIdx;
    }
  }

  if (bestStart === -1) {
    const fallbackEnd = Math.min(bodyContent.length, 3500);
    return {
      exerciseText: bodyContent.slice(0, fallbackEnd),
      visualText: visualText.trim(),
      rawStart: 0,
      rawEnd: fallbackEnd,
      matchedSection: false,
    };
  }

  // Reculer pour attraper l'en-tête de l'exercice (ex: "التمرين الثاني", "EXERCICE 2", "Exercise 1")
  const lookbackStart = Math.max(0, bestStart - 350);
  const lookbackChunk = normBody.slice(lookbackStart, bestStart);
  const headerIdx = lookbackChunk.search(/(التمرين|EXERCICE|EXERCISE)/i);
  const normStart = headerIdx !== -1 ? lookbackStart + headerIdx : bestStart;

  // Détection de la fin de l'exercice
  const after = normBody.slice(normStart + 150);
  const stopPatterns = NEXT_SECTION_FOR_TOPIC[topic];
  let stopOffset = -1;
  for (const re of stopPatterns) {
    const m = after.search(re);
    if (m !== -1 && (stopOffset === -1 || m < stopOffset)) {
      stopOffset = m;
    }
  }

  const normEnd = Math.min(
    normBody.length,
    stopOffset !== -1 ? normStart + 150 + stopOffset : normStart + 3500
  );
  const rawStart = toRawIndex[Math.min(normStart, toRawIndex.length - 1)] ?? 0;
  const rawEnd = toRawIndex[Math.min(normEnd, toRawIndex.length - 1)] ?? bodyContent.length;
  const exerciseText = bodyContent.slice(rawStart, rawEnd).trim();

  return {
    exerciseText,
    visualText: visualText.trim(),
    rawStart,
    rawEnd,
    matchedSection: true,
  };
}

/**
 * Détermine la filière d'un document selon son sous-dossier ou son nom.
 * Strictement étanche : PC vs SM (aucun dossier commun pour respecter le niveau d'exigence).
 */
function resolveDocumentBranch(relativePath: string, fileName: string): DocumentBranch {
  const normPath = relativePath.replace(/\\/g, '/').toLowerCase();
  const normName = fileName.toLowerCase();

  // 1. Sous-dossier prioritaire
  if (normPath.startsWith('pc/') || normPath.startsWith('pc\\')) return 'PC';
  if (normPath.startsWith('sm/') || normPath.startsWith('sm\\')) return 'SM';

  // 2. Préfixe ou motif dans le nom de fichier
  const hasPc = normName.includes('pc_') || normName.includes('_pc') || normName.includes('-pc') || normName.includes('pc.');
  const hasSm = normName.includes('sm_') || normName.includes('_sm') || normName.includes('-sm') || normName.includes('sm.');

  if (hasPc && !hasSm) return 'PC';
  if (hasSm && !hasPc) return 'SM';

  return 'ALL';
}

/**
 * Détermine la catégorie d'un document selon son sous-dossier ou son nom.
 * Catégories : 'examens' | 'series' | 'corriges' | 'cours' | 'cadres' | 'autre'
 */
export function resolveDocumentCategory(relativePath: string, fileName: string): DocumentCategory {
  const normPath = relativePath.replace(/\\/g, '/').toLowerCase();
  const normName = fileName.toLowerCase();

  // 1. Corrigés et solutions (dossier corriges/ ou motif corrige/solution)
  if (
    normPath.includes('/corriges/') ||
    normPath.startsWith('corriges/') ||
    /(?:^|[_\-\s])(corrige|solution|reponses)(?:[_\-\s.]|$)/i.test(normName)
  ) {
    return 'corriges';
  }

  // 2. Énoncés de séries d'exercices ou devoirs (dossier enonces/ ou series/)
  if (
    normPath.includes('/enonces/') ||
    normPath.startsWith('enonces/') ||
    normPath.includes('/series/') ||
    normPath.startsWith('series/') ||
    /(?:^|[_\-\s])(serie|enonce|devoir)(?:[_\-\s.]|$)/i.test(normName)
  ) {
    return 'series';
  }

  // 3. Autres sous-dossiers explicites
  if (normPath.includes('/examens/') || normPath.startsWith('examens/')) return 'examens';
  if (normPath.includes('/cours/') || normPath.startsWith('cours/')) return 'cours';
  if (normPath.includes('/cadres/') || normPath.startsWith('cadres/')) return 'cadres';

  // 4. Motifs dans le nom de fichier (fallback)
  if (/cadre[-_ ]?(?:de[-_ ]?)?reference/i.test(normName)) return 'cadres';
  if (/cours/i.test(normName)) return 'cours';
  if (/(?:^|[_\-\s])(20\d\d|sn\d*|sr\d*)/i.test(normName)) return 'examens';

  return 'autre';
}

/**
 * Parcourt récursivement le dossier docs/programme pour découvrir les fichiers des 2 filières.
 */
export function discoverProgrammeFiles(dir: string, baseDir: string = dir): DiscoveredFile[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results: DiscoveredFile[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Ignorer les dossiers cachés
      if (!entry.name.startsWith('.')) {
        results.push(...discoverProgrammeFiles(fullPath, baseDir));
      }
    } else if (entry.isFile()) {
      // Ignorer les sidecars d'extraction, les fichiers cachés et le README racine
      if (entry.name.startsWith('.') || entry.name.endsWith('.extracted.txt')) {
        continue;
      }
      if (dir === baseDir && entry.name.toLowerCase() === 'readme.md') {
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (!['.pdf', '.md', '.txt', '.json'].includes(ext)) {
        continue;
      }

      const relPath = path.relative(baseDir, fullPath);
      const stat = fs.statSync(fullPath);
      const branch = resolveDocumentBranch(relPath, entry.name);
      const category = resolveDocumentCategory(relPath, entry.name);

      results.push({
        absolutePath: fullPath,
        relativePath: relPath,
        name: entry.name,
        branch,
        category,
        mtime: stat.mtimeMs,
      });
    }
  }

  return dir === baseDir ? deduplicateDiscoveredFiles(results) : results;
}

const fileHashCache = new Map<string, { mtime: number; size: number; sha256: string }>();

function getFileSha256Cached(filePath: string, size: number, mtime: number): string {
  const cached = fileHashCache.get(filePath);
  if (cached && cached.size === size && cached.mtime === mtime) {
    return cached.sha256;
  }
  const buf = fs.readFileSync(filePath);
  const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
  fileHashCache.set(filePath, { mtime, size, sha256 });
  return sha256;
}

function getCanonicalScore(doc: DiscoveredFile): number {
  const inSubfolder = doc.relativePath.includes('/') || doc.relativePath.includes('\\') ? 0 : 10;
  const hasAutoPrefix = /^(pc|sm)_/i.test(doc.name) ? 2 : 0;
  return inSubfolder + hasAutoPrefix;
}

/**
 * Déduplique les documents officiels découverts (priorité aux fichiers rangés dans PC/ ou SM/).
 * Ne calcule le hash SHA-256 que lorsqu'au moins deux fichiers partagent la même taille en octets.
 */
function deduplicateDiscoveredFiles(files: DiscoveredFile[]): DiscoveredFile[] {
  const withSizes = files.map((doc) => {
    let size = -1;
    try {
      size = fs.statSync(doc.absolutePath).size;
    } catch {}
    return { doc, size };
  });

  const sizeCounts = new Map<number, number>();
  for (const item of withSizes) {
    if (item.size >= 0) {
      sizeCounts.set(item.size, (sizeCounts.get(item.size) || 0) + 1);
    }
  }

  // Trier par priorité canonique (sous-dossier PC/SM avant racine, nom original avant préfixe auto)
  withSizes.sort(
    (a, b) =>
      getCanonicalScore(a.doc) - getCanonicalScore(b.doc) ||
      a.doc.name.length - b.doc.name.length ||
      a.doc.relativePath.localeCompare(b.doc.relativePath)
  );

  const seenHashes = new Set<string>();
  const kept: DiscoveredFile[] = [];

  for (const { doc, size } of withSizes) {
    if (size >= 0 && (sizeCounts.get(size) || 0) > 1) {
      try {
        const hash = getFileSha256Cached(doc.absolutePath, size, doc.mtime);
        if (seenHashes.has(hash)) {
          continue;
        }
        seenHashes.add(hash);
      } catch {}
    }
    kept.push(doc);
  }

  return kept;
}

/**
 * Vérifie si le fichier texte extrait (.extracted.txt) contient déjà la transcription visuelle des graphes/schémas.
 */
export function hasVisualMarker(pdfPath: string): boolean {
  const txtPath = `${pdfPath}.extracted.txt`;
  if (!fs.existsSync(txtPath)) return false;
  try {
    const text = fs.readFileSync(txtPath, 'utf-8');
    return text.includes(SCIENTIFIC_VISION_MARKER);
  } catch {
    return false;
  }
}

function buildCachedDoc(file: DiscoveredFile, content: string): CachedDoc {
  const rawSections = content.split(/\n#{1,3}\s+|\n\n+/).filter((s) => s.trim().length > 20);
  const sections: CachedDocSection[] = rawSections.map((s) => ({
    raw: s.trim().slice(0, 2500),
    lower: s.toLowerCase(),
    arabicNorm: normalizeArabic(s),
  }));

  return {
    name: file.name,
    relativePath: file.relativePath,
    absolutePath: file.absolutePath,
    branch: file.branch,
    category: file.category,
    mtime: file.mtime,
    sections,
  };
}

function upsertCachedDoc(file: DiscoveredFile, content: string): void {
  if (!content) return;
  const cached = buildCachedDoc(file, content);
  const idx = documentsCache.findIndex((d) => d.relativePath === file.relativePath);
  if (idx >= 0) {
    documentsCache[idx] = cached;
  } else {
    documentsCache.push(cached);
  }
}

function readDocumentFullText(doc: CachedDoc): string {
  try {
    const isPdf = doc.name.toLowerCase().endsWith('.pdf');
    const target = isPdf ? `${doc.absolutePath}.extracted.txt` : doc.absolutePath;
    if (fs.existsSync(target)) {
      return fs.readFileSync(target, 'utf-8');
    }
  } catch (err) {
    console.warn(`[RAG] Lecture complète impossible pour ${doc.name}:`, err);
  }
  return doc.sections.map((s) => s.raw).join('\n\n');
}

/**
 * Rafraîchit l'index RAG en mémoire à partir du stockage local (docs/programme/PC et docs/programme/SM).
 * Extrait le texte brut des PDFs manquants avec mise en cache .extracted.txt.
 * Note : le décodage visuel Gemini est assuré en tâche de fond cadencée via startBackgroundOfficialSync()
 * afin d'éviter les dépassements de délai HTTP (502/503) et les quotas (429).
 */
export async function refreshDocumentsCache(force: boolean = false, _apiKey?: string) {
  if (inflightRefresh && !force) {
    return inflightRefresh;
  }

  const now = Date.now();
  if (!force && now - lastCacheRefreshTime < 4000 && documentsCache.length > 0) {
    return getLocalRagStatus();
  }

  const runRefresh = async () => {
    try {
      if (!fs.existsSync(DOCS_DIR)) return getLocalRagStatus();

      const discovered = discoverProgrammeFiles(DOCS_DIR);
      const updatedCache: CachedDoc[] = [];

      for (const file of discovered) {
        const isPdf = file.name.toLowerCase().endsWith('.pdf');

        const existing = documentsCache.find(
          (d) => d.relativePath === file.relativePath && d.mtime === file.mtime
        );

        // Réutiliser le cache mémoire tant que le fichier et son sidecar n'ont pas changé
        const sidecarFresh = isPdf ? isExtractedTextFresh(file.absolutePath, `${file.absolutePath}.extracted.txt`) : true;
        if (existing && (!isPdf || sidecarFresh)) {
          updatedCache.push(existing);
          continue;
        }

        let content = '';
        if (isPdf) {
          const sidecarPath = `${file.absolutePath}.extracted.txt`;
          content = await getFreshExtractedPdfText(file.absolutePath, sidecarPath);
          // Libérer la boucle événementielle entre chaque PDF pour prévenir les timeouts HTTP 502/503
          await sleep(5);
        } else {
          content = fs.readFileSync(file.absolutePath, 'utf-8');
        }

        if (content) {
          updatedCache.push(buildCachedDoc(file, content));
        }
      }

      documentsCache = updatedCache;
      lastCacheRefreshTime = Date.now();
    } catch (err) {
      console.warn('Erreur rafraîchissement cache RAG local:', err);
    }

    return getLocalRagStatus();
  };

  inflightRefresh = runRefresh().finally(() => {
    inflightRefresh = null;
  });
  return inflightRefresh;
}

/**
 * Recherche contextuelle dans les documents officiels avec ÉTANCHÉITÉ TOTALE entre PC et SM.
 * Aucune fuite d'exercice SM vers PC (ex: pas d'oscillations forcées/impédance Z chez PC).
 * Aucune fuite de document PC vers SM (ex: modulation AM n'apparaît pas chez SM).
 */
export async function searchLocalDocuments(query: string, branch: string = 'PC'): Promise<string> {
  const { contextText } = await searchLocalDocumentsDetailed(query, branch);
  return contextText;
}

/**
 * Recherche contextuelle enrichie : retourne le texte RAG ET la référence PDF officielle
 * (nom de fichier + numéros de pages exactes) pour affichage visuel direct dans le chat.
 */
function extractExamMetaFromFilename(fileName: string): { year: number | null; session: 'SN' | 'SR' | null } {
  const lower = fileName.toLowerCase();
  const yMatch = lower.match(/(20[012]\d)/);
  const year = yMatch ? parseInt(yMatch[1], 10) : null;
  let session: 'SN' | 'SR' | null = null;
  if (/(?:^|[_\-\s])sn(?:\d|[_\-\s.]|$)|normale/.test(lower)) session = 'SN';
  else if (/(?:^|[_\-\s])sr(?:\d|[_\-\s.]|$)|rattrapage/.test(lower)) session = 'SR';
  return { year, session };
}

export type SlashCommandType =
  | 'cours'
  | 'examen'
  | 'exercice'
  | 'cadre'
  | 'courbe'
  | 'schema'
  | 'mindmap'
  | 'piege'
  | 'aide';

export interface ParsedSlashCommand {
  command: SlashCommandType;
  arg: string;
  effectivePrompt: string;
}

function stripWrappingQuotes(value: string): string {
  const t = value.trim();
  if (
    (t.startsWith("'") && t.endsWith("'") && t.length >= 2) ||
    (t.startsWith('"') && t.endsWith('"') && t.length >= 2)
  ) {
    return t.slice(1, -1).trim();
  }
  return t;
}

const SLASH_COMMAND_ALIASES: { prefix: string; command: SlashCommandType }[] = [
  { prefix: '/affiche le cours', command: 'cours' },
  { prefix: '/afficher cours', command: 'cours' },
  { prefix: '/affiche cours', command: 'cours' },
  { prefix: '/affiche examen', command: 'examen' },
  { prefix: '/affiche sujet', command: 'examen' },
  { prefix: '/affiche exercice', command: 'exercice' },
  { prefix: '/affiche courbe', command: 'courbe' },
  { prefix: '/affiche schema', command: 'schema' },
  { prefix: '/commandes', command: 'aide' },
  { prefix: '/mindmap', command: 'mindmap' },
  { prefix: '/exercice', command: 'exercice' },
  { prefix: '/reference', command: 'cadre' },
  { prefix: '/examen', command: 'examen' },
  { prefix: '/annale', command: 'examen' },
  { prefix: '/courbe', command: 'courbe' },
  { prefix: '/schema', command: 'schema' },
  { prefix: '/tracer', command: 'courbe' },
  { prefix: '/cours', command: 'cours' },
  { prefix: '/serie', command: 'exercice' },
  { prefix: '/cadre', command: 'cadre' },
  { prefix: '/carte', command: 'mindmap' },
  { prefix: '/piege', command: 'piege' },
  { prefix: '/trap', command: 'piege' },
  { prefix: '/aide', command: 'aide' },
  { prefix: '/help', command: 'aide' },
];

export function hasExplicitSolveIntent(text: string): boolean {
  const q = (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return /\b(resoudre|resous|solution|corrige|corriger|correction|reponse|reponses|reponds|traite|traiter|calculer|calcule|etablir|etablis|deduire|determiner|determine|demontrer|demontre|fais\s+l['’]exercice)\b/i.test(
    q
  );
}

export function parseSlashCommand(rawText: string): ParsedSlashCommand | null {
  const trimmed = (rawText || '').trim();
  if (!trimmed.startsWith('/')) return null;

  const norm = trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  for (const entry of SLASH_COMMAND_ALIASES) {
    if (norm === entry.prefix || norm.startsWith(`${entry.prefix} `)) {
      const arg = stripWrappingQuotes(trimmed.slice(entry.prefix.length));
      let effectivePrompt = arg || trimmed;
      switch (entry.command) {
        case 'cours':
          effectivePrompt = arg
            ? `Affiche le cours officiel "${arg}" et explique ses notions clés, définitions et formules essentielles.`
            : `Explique les notions clés du cours officiel du programme.`;
          break;
        case 'examen':
          effectivePrompt = arg
            ? `Affiche et corrige méthodiquement le sujet d'examen national : ${arg}.`
            : `Affiche un exercice officiel de l'Examen National du Baccalauréat.`;
          break;
        case 'exercice': {
          const wantsSolve = hasExplicitSolveIntent(arg);
          effectivePrompt = arg
            ? wantsSolve
              ? `Affiche et résous l'exercice ou la série officielle demandé(e) : ${arg}.`
              : `Affiche la série d'exercices officielle sur : ${arg}. Présente brièvement la série et la liste des exercices qu'elle contient, SANS donner aucune solution ni correction tant que l'élève ne le demande pas.`
            : `Propose une série ou un exercice officiel du programme sans donner la solution d'emblée.`;
          break;
        }
        case 'cadre':
          effectivePrompt = arg
            ? `Quelles sont les exigences exactes du Cadre de Référence officiel concernant : ${arg} ?`
            : `Présente les points clés du Cadre de Référence officiel du programme.`;
          break;
        case 'courbe':
          effectivePrompt = arg
            ? `Trace la courbe interactive (\`\`\`curve) pour : ${arg}, et explique son exploitation le jour du Bac.`
            : `Trace une courbe caractéristique du programme en \`\`\`curve et explique son exploitation.`;
          break;
        case 'schema':
          effectivePrompt = arg
            ? `Dessine un schéma clair (\`\`\`svg) pour : ${arg}, avec ses annotations et explications.`
            : `Dessine un schéma physique du programme en \`\`\`svg.`;
          break;
        case 'mindmap':
          effectivePrompt = arg
            ? `Génère une carte mentale (\`\`\`mindmap) complète pour réviser : ${arg}.`
            : `Génère une carte mentale de révision (\`\`\`mindmap).`;
          break;
        case 'piege':
          effectivePrompt = arg
            ? `Pose-moi un piège classique de l'Examen National sur : ${arg}.`
            : `Pose-moi un piège classique de l'Examen National.`;
          break;
        case 'aide':
          effectivePrompt = 'Liste les commandes rapides disponibles dans Si Driss.';
          break;
      }

      return { command: entry.command, arg, effectivePrompt };
    }
  }

  return null;
}

export interface SearchLocalDocumentsOptions {
  hasUserAttachments?: boolean;
  explicitExamRequested?: boolean;
  explicitOfficialRequested?: boolean;
  latestUserText?: string;
  forcedCommand?: SlashCommandType;
  commandArg?: string;
}

const COURSE_STOP_WORDS = new Set([
  'le', 'la', 'les', 'l', 'du', 'de', 'des', 'd', 'un', 'une', 'sur', 'en', 'et', 'ou',
  'a', 'au', 'aux', 'pour', 'avec', 'dans', 'par', 'cours', 'officiel', 'officielle',
  'officiels', 'officielles', 'affiche', 'afficher', 'montre', 'montrer', 'moi', 'ouvre',
  'ouvrir', 'voir', 'consulter', 'donne', 'donner', 'explique', 'expliquer', 'analyse',
  'analyser', 'notions', 'cles', 'resume', 'document', 'pdf', 'filiere', 'pc', 'sm',
  'si', 'driss', 'veux', 'voudrais', 'je', 'me', 'te', 'stp', 'svp', 'manuel',
  'polycopie', 'fiche', 'chapitre', 'lecon', 'lecons', 'svt', 'biof', 'www', 'ma',
]);

function normalizeCourseText(text: string): string {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenMatchesText(token: string, normText: string): boolean {
  if (!token || !normText) return false;
  if (normText.includes(token)) return true;
  if (token.length >= 5 && token.endsWith('s') && normText.includes(token.slice(0, -1))) {
    return true;
  }
  return false;
}

function parseCourseQuery(query: string): {
  isCourseQuery: boolean;
  tokens: string[];
  wantsManuscript: boolean;
  wantsManual: boolean;
  topic: ExamTopic | null;
} {
  const q = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const hasCourseKeyword =
    /\b(cours|lecon|lecons|polycopie|polycop|manuel|fiche\s+de\s+cours|resume\s+du\s+cours)\b/i.test(q);
  const hasNamedCourseIntent =
    /\b(manuscrit|onde\s*[12]|cours\s+de\s+soir|noyaux[\s-]+masse|decroissance\s+radioactive)\b/i.test(q) &&
    /\b(affiche|afficher|montre|montrer|ouvre|ouvrir|voir|consulter|cours|document|analyse|explique|donne|veux)\b/i.test(q);

  const isCourseQuery = hasCourseKeyword || hasNamedCourseIntent;
  const wantsManuscript = /\b(manuscrit|ecrit\s+a\s+la\s+main)\b/i.test(q);
  const wantsManual = /\b(soir|semestre|manuel|complet)\b/i.test(q);
  const topic = parseExamQuery(query).topic;

  const rawTokens = normalizeCourseText(query).split(/\s+/);
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const tok of rawTokens) {
    if (!tok || COURSE_STOP_WORDS.has(tok)) continue;
    if (tok.length < 2 && tok !== '1' && tok !== '2') continue;
    if (!seen.has(tok)) {
      seen.add(tok);
      tokens.push(tok);
    }
  }

  return { isCourseQuery, tokens, wantsManuscript, wantsManual, topic };
}

interface PdfPageSlice {
  page: number;
  text: string;
  normText: string;
  topNormText: string;
}

function splitPdfIntoPages(bodyOnly: string): { pages: PdfPageSlice[]; totalPages: number } {
  const markerRe = /^--\s*(\d+)\s+of\s+(\d+)\s*--$/gm;
  const pages: PdfPageSlice[] = [];
  let prevEnd = 0;
  let totalPages = 1;
  let m: RegExpExecArray | null;

  while ((m = markerRe.exec(bodyOnly)) !== null) {
    const pageNum = parseInt(m[1], 10);
    const total = parseInt(m[2], 10);
    if (Number.isFinite(total) && total > totalPages) totalPages = total;
    const rawSlice = bodyOnly.slice(prevEnd, m.index).trim();
    const topLines = rawSlice.split('\n').filter((l) => l.trim()).slice(0, 6).join(' ');
    pages.push({
      page: Number.isFinite(pageNum) && pageNum >= 1 ? pageNum : pages.length + 1,
      text: rawSlice,
      normText: normalizeCourseText(rawSlice),
      topNormText: normalizeCourseText(topLines),
    });
    prevEnd = m.index + m[0].length;
  }

  if (pages.length === 0) {
    const topLines = bodyOnly.split('\n').filter((l) => l.trim()).slice(0, 6).join(' ');
    pages.push({
      page: 1,
      text: bodyOnly.trim(),
      normText: normalizeCourseText(bodyOnly),
      topNormText: normalizeCourseText(topLines),
    });
  } else {
    totalPages = Math.max(totalPages, pages.length);
  }

  return { pages, totalPages };
}

export function isScannedPdfContent(bodyOnly: string, totalPages: number): boolean {
  const cleanTextLen = bodyOnly.replace(/^--\s*\d+\s+of\s+\d+\s*--$/gm, '').trim().length;
  const avgCharsPerPage = totalPages > 0 ? cleanTextLen / totalPages : cleanTextLen;
  return cleanTextLen < 150 || (totalPages > 1 && avgCharsPerPage < 50);
}

/**
 * Vérifie si un texte extrait de PDF contient un véritable énoncé lisible
 * (et non uniquement des marqueurs de pages vides "-- 1 of N --").
 */
export function hasReadablePdfText(rawText: string): boolean {
  if (!rawText) return false;
  const markerIdx = rawText.indexOf(SCIENTIFIC_VISION_MARKER);
  const bodyOnly = markerIdx !== -1 ? rawText.slice(0, markerIdx) : rawText;
  const { totalPages } = splitPdfIntoPages(bodyOnly);
  return !isScannedPdfContent(bodyOnly, totalPages);
}

/**
 * Résout de manière sécurisée le chemin absolu d'un document officiel dans DOCS_DIR.
 */
export function resolveOfficialPdfPath(relativePath: string): string | null {
  if (!relativePath) return null;
  const root = path.resolve(DOCS_DIR);
  const resolved = path.resolve(root, relativePath);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (!resolved.startsWith(rootWithSep)) return null;
  if (!fs.existsSync(resolved)) return null;
  return resolved;
}

/**
 * Rend une sélection de pages d'un PDF scanné en images PNG (sans outil externe)
 * pour les modèles multimodaux (OpenAI / Anthropic / OpenRouter) ou en secours.
 */
export async function renderPdfPagesAsPngAttachments(
  pdfSource: string | Buffer,
  pageNumbers?: number[],
  maxPages: number = 6
): Promise<{ name: string; type: 'image'; mimeType: 'image/png'; data: string }[]> {
  let parser: PDFParse | null = null;
  try {
    const buf = typeof pdfSource === 'string' ? fs.readFileSync(pdfSource) : pdfSource;
    const baseName = typeof pdfSource === 'string' ? path.basename(pdfSource) : 'document.pdf';
    parser = new PDFParse({ data: buf });
    const partial =
      pageNumbers && pageNumbers.length > 0
        ? Array.from(new Set(pageNumbers.filter((p) => Number.isInteger(p) && p >= 1))).slice(0, maxPages)
        : undefined;
    const shot = await parser.getScreenshot({
      ...(partial && partial.length > 0 ? { partial } : { first: maxPages }),
      scale: 1.35,
      imageDataUrl: true,
      imageBuffer: false,
    });
    const out: { name: string; type: 'image'; mimeType: 'image/png'; data: string }[] = [];
    for (const p of (shot?.pages || []).slice(0, maxPages)) {
      if (p?.dataUrl) {
        out.push({
          name: `${baseName} (p.${p.pageNumber})`,
          type: 'image',
          mimeType: 'image/png',
          data: p.dataUrl,
        });
      }
    }
    return out;
  } catch (err: any) {
    console.warn('[RAG] Échec rendu PNG des pages PDF:', err?.message || err);
    return [];
  } finally {
    if (parser) {
      try {
        await parser.destroy();
      } catch {}
    }
  }
}

function buildCourseExcerptAndPages(
  fullContent: string,
  docName: string,
  tokens: string[],
  topic: ExamTopic | null
): {
  pages: number[];
  totalPages: number;
  excerpt: string;
  visualText: string;
  isScannedPdf: boolean;
  bodyScore: number;
} {
  const markerIdx = fullContent.indexOf(SCIENTIFIC_VISION_MARKER);
  const bodyOnly = markerIdx !== -1 ? fullContent.slice(0, markerIdx) : fullContent;
  const visionContent = markerIdx !== -1 ? fullContent.slice(markerIdx) : '';

  const { pages: pdfPages, totalPages } = splitPdfIntoPages(bodyOnly);
  const isScannedPdf = isScannedPdfContent(bodyOnly, totalPages);

  if (isScannedPdf) {
    return {
      pages: [1],
      totalPages,
      excerpt: bodyOnly.slice(0, 1500).trim(),
      visualText: visionContent.slice(0, 2500).trim(),
      isScannedPdf: true,
      bodyScore: 0,
    };
  }

  const normFileName = normalizeCourseText(path.basename(docName, path.extname(docName)));
  const subtopicTokens = tokens.filter((t) => !tokenMatchesText(t, normFileName));
  const scoringTokens = subtopicTokens.length > 0 ? subtopicTokens : tokens;

  let bestPage = 1;
  let bestPageScore = 0;

  for (const p of pdfPages) {
    let score = 0;
    for (const tok of scoringTokens) {
      if (tokenMatchesText(tok, p.normText)) {
        score += 10;
      }
      if (tokenMatchesText(tok, p.topNormText)) {
        score += 18;
      }
    }
    if (topic && TOPIC_VISION_PATTERNS[topic]?.some((re) => re.test(p.text))) {
      score += 6;
    }

    // Favoriser les pages de début de cours/résumé par rapport aux pages d'exercices dans les manuels
    if (/\b(niveaux|resume|cours)\b/.test(p.topNormText) && score > 0) {
      score += 15;
    }
    if (/\bexercice\s*\d*/.test(p.topNormText) && score > 0) {
      score -= 12;
    }

    // Réduire fortement le poids des pages de sommaire (dotted lines) sur les gros manuels
    const isTocPage =
      p.page <= 3 && (/\bsommaire\b|table\s+des\s+matieres/i.test(p.normText) || /\.{5,}/.test(p.text));
    if (isTocPage) {
      score = score * 0.05;
    }

    if (score > bestPageScore) {
      bestPageScore = score;
      bestPage = p.page;
    }
  }

  // Pour un cours dédié court (<= 15 pages) demandé globalement sans sous-sujet précis, ouvrir à la page 1
  const startPage =
    totalPages <= 15 && subtopicTokens.length === 0
      ? 1
      : bestPageScore > 0
      ? bestPage
      : 1;

  const targetPages: number[] = [];
  for (let p = startPage; p <= Math.min(totalPages, startPage + 3); p++) {
    targetPages.push(p);
  }

  const selectedSlices = pdfPages
    .filter((p) => p.page >= startPage && p.page <= startPage + 3)
    .map((p) => `[Page ${p.page}/${totalPages}]\n${p.text}`);

  const excerpt = (selectedSlices.length > 0 ? selectedSlices.join('\n\n') : bodyOnly).slice(0, 9000).trim();

  return {
    pages: targetPages.length > 0 ? targetPages : [1],
    totalPages,
    excerpt,
    visualText: visionContent.slice(0, 2500).trim(),
    isScannedPdf: false,
    bodyScore: bestPageScore,
  };
}

function buildOfficialCourseResponse(
  doc: CachedDoc,
  branchUpper: 'PC' | 'SM',
  tokens: string[],
  topic: ExamTopic | null,
  exerciseNumber: number | null = null
): { contextText: string; officialSource: OfficialSourceRef; isScannedPdf: boolean } {
  const fullContent = readDocumentFullText(doc);
  const markerIdx = fullContent.indexOf(SCIENTIFIC_VISION_MARKER);
  const bodyOnly = markerIdx !== -1 ? fullContent.slice(0, markerIdx) : fullContent;

  // Si un numéro d'exercice précis est demandé sur une série (ex: "résoudre l'exercice 2 de cette série")
  if (doc.category === 'series' && exerciseNumber) {
    const { exerciseText, visualText, rawStart, rawEnd, matchedSection } = extractExamExercise(
      fullContent,
      null,
      exerciseNumber
    );
    if (matchedSection && exerciseText) {
      const { pages, totalPages } = computeExamPageRange(bodyOnly, rawStart, rawEnd, true, null);
      const isScannedPdf = isScannedPdfContent(bodyOnly, totalPages);
      const officialSource: OfficialSourceRef = {
        name: doc.name,
        relativePath: doc.relativePath,
        branch: doc.branch,
        category: doc.category,
        topic,
        pages,
        totalPages,
        isPdf: true,
      };
      const contextText =
        `[Cadre Officiel 2BAC ${branchUpper} - Série d'Exercices Officielle]\n` +
        `Document officiel : ${doc.name} | Exercice ${exerciseNumber} | Page(s) PDF ciblée(s) : ${pages.join(', ')}/${totalPages}\n\n` +
        `--- ÉNONCÉ DE L'EXERCICE ${exerciseNumber} ---\n${exerciseText}\n\n` +
        (visualText ? `--- DONNÉES VISUELLES & SCHÉMAS DÉCODÉS ---\n${visualText}\n` : '');
      return { contextText, officialSource, isScannedPdf };
    }
  }

  const { pages, totalPages, excerpt, visualText, isScannedPdf } = buildCourseExcerptAndPages(
    fullContent,
    doc.name,
    tokens,
    topic
  );

  const officialSource: OfficialSourceRef = {
    name: doc.name,
    relativePath: doc.relativePath,
    branch: doc.branch,
    category: doc.category,
    topic,
    pages,
    totalPages,
    isPdf: true,
  };

  const scannedNotice = isScannedPdf
    ? '\n[IMPORTANT — PDF MANUSCRIT / SCANNÉ SANS OCR : Ce document officiel ne contient pas de texte extractible ; ses pages officielles sont directement affichées visuellement à l’élève dans la visionneuse PDF au-dessus de ta réponse. Ne jamais inventer le contenu absent : invite l’élève à consulter les pages affichées (< / > et Zoom) ou à joindre une capture d’écran d’une page précise.]\n'
    : '';

  const docTypeLabel =
    doc.category === 'series'
      ? "Série d'Exercices Officielle"
      : doc.category === 'cadres'
      ? 'Cadre de Référence Officiel'
      : 'Cours Officiel du Programme';

  const sectionTitle =
    doc.category === 'series'
      ? "--- EXTRAIT DE LA SÉRIE D'EXERCICES ---"
      : '--- EXTRAIT DU COURS OFFICIEL ---';

  const courseHeader =
    `[Cadre Officiel 2BAC ${branchUpper} - ${docTypeLabel}]\n` +
    `Document officiel : ${doc.name} | Page(s) PDF ciblée(s) : ${pages.join(', ')}/${totalPages}\n` +
    (topic ? `Thème détecté : ${topic.toUpperCase()}\n` : '');

  const contextText =
    `${courseHeader}${scannedNotice}\n${sectionTitle}\n${excerpt}\n\n` +
    (visualText ? `--- DONNÉES VISUELLES & SCHÉMAS DÉCODÉS ---\n${visualText}\n` : '');

  return { contextText, officialSource, isScannedPdf };
}

function findExplicitOfficialPdfByName(
  query: string,
  branchUpper: 'PC' | 'SM',
  forcedCmd?: SlashCommandType
): CachedDoc | null {
  const qLower = query.toLowerCase();
  const qNorm = normalizeCourseText(query);

  let best: CachedDoc | null = null;
  let bestLen = 0;

  for (const doc of documentsCache) {
    if (doc.branch !== 'ALL' && doc.branch !== branchUpper) continue;
    if (!doc.name.toLowerCase().endsWith('.pdf')) continue;
    // Protéger les corrigés confidentiels en mode socratique
    if (doc.category === 'corriges') continue;
    if (forcedCmd === 'cours' && doc.category !== 'cours') continue;
    if (forcedCmd === 'examen' && doc.category !== 'examens') continue;
    if (forcedCmd === 'exercice' && doc.category !== 'series' && doc.category !== 'examens') continue;
    if (forcedCmd === 'cadre' && doc.category !== 'cadres') continue;

    const nameLower = doc.name.toLowerCase();
    const normFull = normalizeCourseText(doc.name);
    const stemNorm = normalizeCourseText(path.basename(doc.name, path.extname(doc.name)));

    const exactMatch = qLower.includes(nameLower) || (normFull.length >= 6 && qNorm.includes(normFull));
    const quotedStemMatch =
      stemNorm.length >= 4 &&
      (qLower.includes(`"${path.basename(doc.name, path.extname(doc.name)).toLowerCase()}"`) ||
        qNorm.includes(`document ${stemNorm}`));

    if (exactMatch || quotedStemMatch) {
      if (doc.name.length > bestLen) {
        best = doc;
        bestLen = doc.name.length;
      }
    }
  }

  return best;
}

function findBestPdfByCategory(
  category: 'cours' | 'series' | 'cadres',
  branchUpper: 'PC' | 'SM',
  tokens: string[],
  topic: ExamTopic | null,
  options?: { wantsManuscript?: boolean; wantsManual?: boolean }
): { doc: CachedDoc; score: number } | null {
  let bestDoc: CachedDoc | null = null;
  let bestScore = 0;

  for (const doc of documentsCache) {
    if (doc.branch !== 'ALL' && doc.branch !== branchUpper) continue;
    if (doc.category !== category) continue;
    if (!doc.name.toLowerCase().endsWith('.pdf')) continue;

    const normFileName = normalizeCourseText(path.basename(doc.name, path.extname(doc.name)));
    const fileTokens = normFileName
      .split(/\s+/)
      .filter((t) => t && !COURSE_STOP_WORDS.has(t) && (t.length >= 2 || t === '1' || t === '2'));

    let score = 0;
    let fileMatches = 0;
    for (const tok of tokens) {
      if (tokenMatchesText(tok, normFileName)) {
        score += 32;
        fileMatches++;
      }
    }
    if (fileTokens.length > 0 && fileMatches > 0) {
      score += Math.round((fileMatches / fileTokens.length) * 25);
    }

    if (category === 'cours') {
      const isManuscriptDoc = normFileName.includes('manuscrit');
      if (isManuscriptDoc) {
        score += options?.wantsManuscript ? 45 : -15;
      }
    }

    const fullContent = readDocumentFullText(doc);
    const markerIdx = fullContent.indexOf(SCIENTIFIC_VISION_MARKER);
    const bodyOnly = markerIdx !== -1 ? fullContent.slice(0, markerIdx) : fullContent;
    const { totalPages } = splitPdfIntoPages(bodyOnly);
    const isDedicated = totalPages <= 20;
    const isManualDoc = /soir|semestre|pc1/i.test(normFileName);

    if (isDedicated && fileMatches > 0) {
      score += 30;
    }
    if (isManualDoc && options?.wantsManual) {
      score += 35;
    }

    const { bodyScore } = buildCourseExcerptAndPages(fullContent, doc.name, tokens, topic);
    if (bodyScore > 0) {
      score += Math.min(45, bodyScore);
      if (isDedicated) {
        score += 15;
      }
    }

    if (tokens.length === 0 && category === 'cadres') {
      score += 30;
    }

    if (doc.branch === branchUpper) {
      score += 3;
    }

    if (score > bestScore) {
      bestScore = score;
      bestDoc = doc;
    }
  }

  if (!bestDoc || bestScore < 20) return null;
  return { doc: bestDoc, score: bestScore };
}

export async function searchLocalDocumentsDetailed(
  query: string,
  branch: string = 'PC',
  options?: SearchLocalDocumentsOptions
): Promise<{ contextText: string; officialSource?: OfficialSourceRef; isScannedPdf?: boolean }> {
  try {
    await refreshDocumentsCache();
    if (!documentsCache.length) return { contextText: '' };

    const branchUpper = (branch || 'PC').toUpperCase() as 'PC' | 'SM';
    const forcedCmd = options?.forcedCommand;
    const cmdArg = (options?.commandArg || '').trim();

    const intentSource = cmdArg || (options?.latestUserText?.trim() ? options.latestUserText : query);
    const parsedFromLatest = parseExamQuery(intentSource);
    const parsed = parsedFromLatest.isExamQuery ? parsedFromLatest : parseExamQuery(query);
    if (forcedCmd === 'examen' || (forcedCmd === 'exercice' && /\b(20[012]\d|sn|sr|national)\b/i.test(intentSource))) {
      parsed.isExamQuery = true;
    }

    const courseFromLatest = parseCourseQuery(intentSource);
    const courseParsed = courseFromLatest.isCourseQuery ? courseFromLatest : parseCourseQuery(query);
    if (forcedCmd === 'cours') {
      courseParsed.isCourseQuery = true;
    }

    const suppressVisualPdf = Boolean(
      forcedCmd && ['courbe', 'schema', 'mindmap', 'piege', 'aide'].includes(forcedCmd)
    );

    // Si l'élève a joint ses propres documents/exercices ou photos et n'a pas explicitement
    // réclamé l'ouverture d'un sujet ou cours officiel, on priorise son énoncé uploadé.
    const shouldSkipOfficialSource =
      suppressVisualPdf ||
      Boolean(
        options?.hasUserAttachments && !options?.explicitExamRequested && !options?.explicitOfficialRequested
      );

    // 0. ROUTE PRIORITAIRE ABSOLUE : NOM DE DOCUMENT OFFICIEL EXPLICITE (ex: bouton "Interroger" ou nom exact .pdf)
    if (!shouldSkipOfficialSource) {
      const explicitDoc =
        findExplicitOfficialPdfByName(intentSource, branchUpper, forcedCmd) ||
        findExplicitOfficialPdfByName(query, branchUpper, forcedCmd);

      if (explicitDoc) {
        const requestedExNum = parsedFromLatest.exerciseNumber ?? parsed.exerciseNumber;
        if (explicitDoc.category === 'cours' || explicitDoc.category === 'series') {
          return buildOfficialCourseResponse(
            explicitDoc,
            branchUpper,
            courseParsed.tokens,
            courseParsed.topic || parsed.topic,
            requestedExNum
          );
        }

        if (explicitDoc.category !== 'examens' || !parsed.isExamQuery) {
          const fullContent = readDocumentFullText(explicitDoc);
          const markerIdx = fullContent.indexOf(SCIENTIFIC_VISION_MARKER);
          const bodyOnly = markerIdx !== -1 ? fullContent.slice(0, markerIdx) : fullContent;
          const { totalPages } = splitPdfIntoPages(bodyOnly);
          const isScannedPdf = isScannedPdfContent(bodyOnly, totalPages);
          const meta = extractExamMetaFromFilename(explicitDoc.name);
          const pages: number[] = [];
          for (let p = 1; p <= Math.min(totalPages, 4); p++) pages.push(p);

          const officialSource: OfficialSourceRef = {
            name: explicitDoc.name,
            relativePath: explicitDoc.relativePath,
            branch: explicitDoc.branch,
            category: explicitDoc.category,
            year: meta.year,
            session: meta.session,
            topic: parsed.topic,
            pages,
            totalPages,
            isPdf: true,
          };

          const contextText =
            `[Cadre Officiel 2BAC ${branchUpper} - Document Officiel : ${explicitDoc.name}]\n` +
            `Page(s) PDF ciblée(s) : ${pages.join(', ')}/${totalPages}\n\n` +
            bodyOnly.slice(0, 8000).trim();

          return { contextText, officialSource, isScannedPdf };
        }
      }
    }

    // 0.5 COMMANDES SLASH CIBLÉES (/cours, /exercice -> série, /cadre)
    if (!shouldSkipOfficialSource && forcedCmd === 'cours') {
      const matched = findBestPdfByCategory('cours', branchUpper, courseParsed.tokens, courseParsed.topic, {
        wantsManuscript: courseParsed.wantsManuscript,
        wantsManual: courseParsed.wantsManual,
      });
      if (matched) {
        return buildOfficialCourseResponse(
          matched.doc,
          branchUpper,
          courseParsed.tokens,
          courseParsed.topic
        );
      }
    }

    if (!shouldSkipOfficialSource && forcedCmd === 'exercice') {
      const requestedExNum = parsedFromLatest.exerciseNumber ?? parsed.exerciseNumber;
      const matchedSeries = findBestPdfByCategory(
        'series',
        branchUpper,
        courseParsed.tokens,
        courseParsed.topic || parsed.topic
      );
      if (matchedSeries && matchedSeries.score >= 25) {
        return buildOfficialCourseResponse(
          matchedSeries.doc,
          branchUpper,
          courseParsed.tokens,
          courseParsed.topic || parsed.topic,
          requestedExNum
        );
      }
      // Repli vers la route des examens si aucune série dédiée ne correspond
      parsed.isExamQuery = true;
    }

    if (!shouldSkipOfficialSource && forcedCmd === 'cadre') {
      const matchedCadre = findBestPdfByCategory(
        'cadres',
        branchUpper,
        courseParsed.tokens,
        courseParsed.topic || parsed.topic
      );
      if (matchedCadre) {
        return buildOfficialCourseResponse(
          matchedCadre.doc,
          branchUpper,
          courseParsed.tokens,
          courseParsed.topic || parsed.topic
        );
      }
    }

    // 1. ROUTE PRIORITAIRE : EXAMEN NATIONAL DU BACCALAURÉAT
    // Si la requête concerne une épreuve nationale (année, session, ou mot-clé examen/national),
    // on identifie le document officiel cible dans la filière de l'élève (PC ou SM)
    if (parsed.isExamQuery && forcedCmd !== 'cours' && !shouldSkipOfficialSource) {
      let bestDoc: CachedDoc | null = null;
      let bestScore = 0;

      for (const doc of documentsCache) {
        // ÉTANCHÉITÉ STRICTE PC vs SM
        if (doc.branch !== 'ALL' && doc.branch !== branchUpper) {
          continue;
        }

        const normName = doc.name.toLowerCase();
        const isPdf = normName.endsWith('.pdf');
        const isExamDoc =
          doc.category === 'examens' ||
          (doc.category !== 'cadres' &&
            doc.category !== 'cours' &&
            doc.category !== 'series' &&
            !/cadre[-_ ]?(?:de[-_ ]?)?reference|cours/i.test(normName) &&
            /(?:^|[_\-\s])(20\d\d|sn\d*|sr\d*)/i.test(normName));

        if (!isExamDoc) {
          continue;
        }

        if (parsed.year) {
          // CORRESPONDANCE STRICTE SUR L'ANNÉE : le fichier DOIT contenir l'année demandée
          if (!normName.includes(String(parsed.year))) {
            continue;
          }

          const meta = extractExamMetaFromFilename(doc.name);
          const text = readDocumentFullText(doc);
          const cleanLen = text.replace(/^--\s*\d+\s+of\s+\d+\s*--$/gm, '').trim().length;
          let docScore = 60; // Score de base pour l'année exacte trouvée
          if (parsed.session && meta.session === parsed.session) {
            docScore += 40;
          } else if (!parsed.session && meta.session === 'SN') {
            docScore += 5;
          }
          if (cleanLen >= 300) docScore += 15;
          if (text.includes(SCIENTIFIC_VISION_MARKER)) docScore += 10;
          if (normName.includes(branchUpper.toLowerCase())) docScore += 10;
          if (isPdf) docScore += 5;

          if (docScore > bestScore) {
            bestScore = docScore;
            bestDoc = doc;
          }
        } else if (isPdf) {
          // Aucune année précisée (ex: "affiche un exercice des ondes du national") :
          // EXIGE impérativement un thème ou un numéro d'exercice demandé,
          // ET vérifie qu'il existe réellement dans le sujet national cible !
          if (!parsed.topic && !parsed.exerciseNumber) {
            continue;
          }

          const meta = extractExamMetaFromFilename(doc.name);
          const text = readDocumentFullText(doc);
          const cleanLen = text.replace(/^--\s*\d+\s+of\s+\d+\s*--$/gm, '').trim().length;
          let docScore = 0;
          let matched = false;

          if (parsed.topic && extractExamExercise(text, parsed.topic).matchedSection) {
            docScore += 60;
            matched = true;
          } else if (parsed.exerciseNumber && extractExamExercise(text, null, parsed.exerciseNumber).matchedSection) {
            docScore += 50;
            matched = true;
          }

          if (!matched) {
            continue; // Si le thème demandé n'existe pas dans ce sujet, on ignore ce document
          }

          if (cleanLen >= 300) docScore += 15;
          if (text.includes(SCIENTIFIC_VISION_MARKER)) docScore += 10;
          if (parsed.session && meta.session === parsed.session) docScore += 15;
          else if (!parsed.session && meta.session === 'SN') docScore += 5;
          if (meta.year) {
            docScore += Math.max(0, (meta.year - 2008) * 0.25);
          }

          if (docScore > bestScore) {
            bestScore = docScore;
            bestDoc = doc;
          }
        }
      }

      // Si un document officiel national est identifié avec un score de pertinence suffisant (>= 60)
      if (bestDoc && bestScore >= 60) {
        const fullContent = readDocumentFullText(bestDoc);
        const { exerciseText, visualText, rawStart, rawEnd, matchedSection } = extractExamExercise(
          fullContent,
          parsed.topic,
          parsed.exerciseNumber
        );
        const isPdf = bestDoc.name.toLowerCase().endsWith('.pdf');
        const markerIdx = fullContent.indexOf(SCIENTIFIC_VISION_MARKER);
        const bodyOnly = markerIdx !== -1 ? fullContent.slice(0, markerIdx) : fullContent;
        const { pages, totalPages } = isPdf
          ? computeExamPageRange(bodyOnly, rawStart, rawEnd, matchedSection, parsed.topic)
          : { pages: [1], totalPages: 1 };

        const meta = extractExamMetaFromFilename(bestDoc.name);
        const resolvedYear = parsed.year ?? meta.year;
        const resolvedSession = parsed.session ?? meta.session;

        const officialSource: OfficialSourceRef = {
          name: bestDoc.name,
          relativePath: bestDoc.relativePath,
          branch: bestDoc.branch,
          category: bestDoc.category,
          year: resolvedYear,
          session: resolvedSession,
          topic: parsed.topic,
          pages,
          totalPages,
          isPdf,
        };

        const isScannedPdf = isPdf && isScannedPdfContent(bodyOnly, totalPages);

        if (exerciseText || visualText || isPdf) {
          const sessionLabel = resolvedSession === 'SN'
            ? 'Session Normale'
            : resolvedSession === 'SR'
            ? 'Session de Rattrapage'
            : 'Épreuve Officielle';

          const scannedNotice = isScannedPdf
            ? '\n[IMPORTANT — PDF SCANNÉ SANS OCR : Ce fichier officiel ne contient pas de texte extractible ; ses pages officielles sont directement affichées visuellement à l’élève dans la visionneuse PDF au-dessus de ta réponse. Ne jamais inventer l’énoncé ni des valeurs numériques, et n’écris aucun code SVG/LaTeX de remplacement : invite l’élève à consulter la page affichée ou à joindre une capture de la question.]\n'
            : '';

          const examHeader = `[Cadre Officiel 2BAC ${branchUpper} - Épreuve Nationale du Baccalauréat marocain]\n` +
            `Document officiel : ${bestDoc.name} | ${sessionLabel} ${resolvedYear || ''} | Page(s) PDF ciblée(s) : ${pages.join(', ')}/${totalPages}\n` +
            (parsed.topic ? `Discipline / Thème : ${parsed.topic.toUpperCase()}\n` : '');

          const contextText = `${examHeader}${scannedNotice}\n--- ÉNONCÉ OFFICIEL EXTRAIT DU SUJET NATIONAL ---\n${exerciseText}\n\n` +
            (visualText ? `--- DONNÉES VISUELLES & SCHÉMAS DÉCODÉS (TRANSCRIPTION OFFICIELLE SI DRISS) ---\n${visualText}\n` : '');

          return { contextText, officialSource, isScannedPdf };
        }
      }
    }

    // 1.5 ROUTE PRIORITAIRE : COURS OFFICIELS DU PROGRAMME (MÊME AFFICHAGE PDF QUE LES EXAMENS)
    if (courseParsed.isCourseQuery && !shouldSkipOfficialSource) {
      const matchedCourse = findBestPdfByCategory(
        'cours',
        branchUpper,
        courseParsed.tokens,
        courseParsed.topic,
        {
          wantsManuscript: courseParsed.wantsManuscript,
          wantsManual: courseParsed.wantsManual,
        }
      );

      if (matchedCourse && matchedCourse.score >= 25) {
        return buildOfficialCourseResponse(
          matchedCourse.doc,
          branchUpper,
          courseParsed.tokens,
          courseParsed.topic
        );
      }
    }

    // 2. ROUTE GÉNÉRALE : RECHERCHE MULTI-SECTIONS CROISÉE FRANÇAIS / ARABE
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

    if (keywords.length === 0) return { contextText: '' };

    // Expansion bilingue des mots-clés physiques (pour chercher dans les épreuves arabes et les cours BIOF)
    const expandedKeywords = [...keywords];
    if (/\b(onde|ondes|fibre|optique)\b/i.test(query)) {
      expandedKeywords.push('الموجات', 'موج');
    }
    if (/\b(nucleaire|nucl[eé]aire|radioactiv)\b/i.test(query)) {
      expandedKeywords.push('النوو', 'النووية', 'اشعاع');
    }
    if (/\b(electr|[eé]lectricit[eé]|rc|rl|rlc|modulation)\b/i.test(query)) {
      expandedKeywords.push('الكهرب', 'مكثف', 'تضمين');
    }
    if (/\b(mecan|m[eé]canique|newton|chute|oscillat)\b/i.test(query)) {
      expandedKeywords.push('الميكانيك', 'نيوتن', 'حركة');
    }
    if (/\b(chimie|acide|base|titrage|dosage|ester)\b/i.test(query)) {
      expandedKeywords.push('الكيمياء', 'حمض', 'استر');
    }

    const matchedSnippets: { score: number; text: string }[] = [];
    const isCadreOrTheory = /\b(definition|definir|cadre|reference|programme|cours|formule|resume|piege|pieges|enonce)\b/i.test(query);

    for (const doc of documentsCache) {
      // ÉTANCHÉITÉ STRICTE : Si l'élève est en PC, on rejette tout document SM.
      // Si l'élève est en SM, on rejette tout document PC.
      if (doc.branch !== 'ALL' && doc.branch !== branchUpper) {
        continue;
      }

      const isCadreDoc = /cadre[-_ ]?(?:de[-_ ]?)?reference/i.test(doc.name);
      const isVisualQuery = /\b(figure|schema|graphe|courbe|montage|circuit|dispositif)\b/i.test(query);

      for (const sec of doc.sections) {
        let score = 0;
        for (const kw of expandedKeywords) {
          if (sec.lower.includes(kw)) {
            score++;
          }
          if (sec.arabicNorm.includes(kw)) {
            score += 2;
          }
        }

        // Bonus si la section correspond précisément au thème détecté dans la question
        if (parsed.topic && TOPIC_VISION_PATTERNS[parsed.topic]) {
          const matchesTopic = TOPIC_VISION_PATTERNS[parsed.topic].some((p) => p.test(sec.lower));
          if (matchesTopic) {
            score += 10;
          }
        }

        // Si la section contient des données visuelles décodées pertinentes et que la requête porte sur un schéma/graphe
        if (sec.raw.includes('FIGURE / SCHÉMA DÉCODÉ') && score > 0 && isVisualQuery) {
          score += 4;
        }

        if (score > 0) {
          // Bonus de pertinence si spécifiquement affilié à la filière
          if (doc.branch === branchUpper) {
            score += 3;
          }
          // Priorité absolue aux documents du Cadre de Référence officiel
          if (isCadreDoc) {
            score += 25;
            if (isCadreOrTheory) {
              score += 35;
            }
          }
          let header = `[Cadre Officiel 2BAC ${branchUpper} - ${doc.name}]`;
          if (doc.category === 'corriges') {
            header = `[CORRIGÉ / SOLUTION OFFICIELLE DU PROFESSEUR - DOCUMENT CONFIDENTIEL DE CONTRÔLE 2BAC ${branchUpper} - ${doc.name}]`;
          } else if (doc.category === 'series') {
            header = `[SÉRIE D'EXERCICES OFFICIELLE 2BAC ${branchUpper} - ${doc.name}]`;
          } else if (doc.category === 'cours') {
            header = `[COURS DU PROGRAMME 2BAC ${branchUpper} - ${doc.name}]`;
          }

          matchedSnippets.push({
            score,
            text: `${header}\n${sec.raw}`,
          });
        }
      }
    }

    if (matchedSnippets.length > 0) {
      matchedSnippets.sort((a, b) => b.score - a.score);
      // Retourne les 3 meilleurs extraits officiels
      return { contextText: matchedSnippets.slice(0, 3).map((s) => s.text).join('\n\n---\n\n') };
    }
  } catch (err) {
    console.warn('Erreur recherche documents RAG:', err);
  }
  return { contextText: '' };
}

/**
 * Extrait le texte d'un PDF en mémoire et libère systématiquement le parseur.
 */
export async function extractTextFromPdf(buf: Buffer): Promise<string> {
  let parser: PDFParse | null = null;
  try {
    parser = new PDFParse({ data: buf });
    const result = await parser.getText();
    return result.text || '';
  } catch (err) {
    console.warn('Erreur extraction PDF:', err);
    return '';
  } finally {
    if (parser) {
      try {
        await parser.destroy();
      } catch {}
    }
  }
}

/**
 * Vérifie si le fichier texte extrait (.extracted.txt) est aussi récent que le PDF
 * (avec tolérance de 2 s pour l'ordre de décompression git checkout / Docker).
 */
function isExtractedTextFresh(pdfPath: string, txtPath: string): boolean {
  try {
    const txtStat = fs.statSync(txtPath);
    if (txtStat.size === 0) return false;
    return txtStat.mtimeMs + 2000 >= fs.statSync(pdfPath).mtimeMs;
  } catch {
    return false;
  }
}

/**
 * Récupère le texte extrait d'un PDF depuis le cache ou extrait + enrichit visuellement si demandé.
 */
export async function getFreshExtractedPdfText(
  pdfPath: string,
  txtPath: string,
  apiKey?: string
): Promise<string> {
  const isFresh = fs.existsSync(txtPath) && isExtractedTextFresh(pdfPath, txtPath);
  const existingContent = isFresh ? fs.readFileSync(txtPath, 'utf-8') : '';

  const alreadyHasVisuals = existingContent.includes(SCIENTIFIC_VISION_MARKER);
  const alreadyHasReadableBody = isFresh ? hasReadablePdfText(existingContent) : false;

  // Si le cache est à jour et possède déjà un texte exploitable + transcription visuelle, ou aucune clé vision valide
  if (isFresh && ((alreadyHasReadableBody && alreadyHasVisuals) || !apiKey || !isLikelyGeminiKey(apiKey))) {
    return existingContent;
  }

  // 1. Extraction texte brut si manquant ou périmé
  let rawText = existingContent;
  if (!isFresh || !rawText) {
    rawText = await extractTextFromPdf(fs.readFileSync(pdfPath));
    try {
      fs.writeFileSync(txtPath, rawText, 'utf-8');
    } catch (err) {
      console.warn('Impossible de mettre en cache le texte extrait:', err);
    }
  }

  // 2. OCR complet (si PDF scanné) ou transcription visuelle IA des schémas/graphes
  const isScanned = !hasReadablePdfText(rawText);
  let fullContent = rawText;
  if (apiKey && isLikelyGeminiKey(apiKey) && (isScanned || !alreadyHasVisuals)) {
    try {
      const outcome = isScanned
        ? await extractScannedPdfFullContent(pdfPath, apiKey)
        : await extractVisualDataFromPdfDetailed(pdfPath, apiKey);
      if (outcome.status === 'ok' && outcome.text.trim().length > 30) {
        fullContent = isScanned
          ? `${outcome.text.trim()}\n`
          : `${rawText}\n\n================================================================================\n${SCIENTIFIC_VISION_MARKER}\n================================================================================\n\n${outcome.text}\n`;
        console.log(
          `[RAG] Document "${path.basename(pdfPath)}" enrichi avec succès (${isScanned ? 'OCR complet + schémas' : 'décodage schémas/graphes'}).`
        );
        try {
          fs.writeFileSync(txtPath, fullContent, 'utf-8');
        } catch (err) {
          console.warn('Impossible de sauvegarder le décodage visuel:', err);
        }
      }
    } catch (visErr) {
      console.warn(`[RAG] Avertissement décodage visuel pour ${path.basename(pdfPath)}:`, visErr);
    }
  }

  return fullContent;
}

const inflightScannedOcr = new Map<string, Promise<boolean>>();

/**
 * Effectue à la demande l'OCR + transcription visuelle d'un PDF officiel scanné,
 * met à jour son cache .extracted.txt et l'index RAG en mémoire.
 */
export async function transcribeScannedOfficialPdf(relativePath: string, apiKey: string): Promise<boolean> {
  if (!relativePath || !isLikelyGeminiKey(apiKey)) return false;

  const existingPromise = inflightScannedOcr.get(relativePath);
  if (existingPromise) return existingPromise;

  const job = (async () => {
    const absPath = resolveOfficialPdfPath(relativePath);
    if (!absPath) return false;
    const txtPath = `${absPath}.extracted.txt`;

    if (fs.existsSync(txtPath) && isExtractedTextFresh(absPath, txtPath)) {
      const cachedTxt = fs.readFileSync(txtPath, 'utf-8');
      if (hasReadablePdfText(cachedTxt)) return true;
    }

    const outcome = await extractScannedPdfFullContent(absPath, apiKey, 50_000);
    if (outcome.status !== 'ok' || !hasReadablePdfText(outcome.text)) {
      return false;
    }

    const finalContent = outcome.text.includes(SCIENTIFIC_VISION_MARKER)
      ? `${outcome.text.trim()}\n`
      : `${outcome.text.trim()}\n\n================================================================================\n${SCIENTIFIC_VISION_MARKER}\n================================================================================\n`;

    try {
      fs.writeFileSync(txtPath, finalContent, 'utf-8');
    } catch (err) {
      console.warn('[RAG] Impossible de sauvegarder le cache OCR scanné:', err);
    }

    const discovered = discoverProgrammeFiles(DOCS_DIR).find(
      (f) => f.relativePath === relativePath || f.absolutePath === absPath
    );
    if (discovered) {
      upsertCachedDoc(discovered, finalContent);
    }
    return true;
  })().finally(() => {
    inflightScannedOcr.delete(relativePath);
  });

  inflightScannedOcr.set(relativePath, job);
  return job;
}

const VISION_PACING_DELAY_MS = 4_500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let syncJobState: OfficialSyncStatus = {
  running: false,
  phase: 'idle',
  branch: 'PC',
  totalPdfs: 0,
  processedPdfs: 0,
  decodedCount: 0,
  alreadyDecodedCount: 0,
  skippedCount: 0,
  failedCount: 0,
  driveSyncCount: 0,
  currentFile: '',
  message: 'Prêt pour la synchronisation.',
};

export function getOfficialSyncStatus(): OfficialSyncStatus {
  return { ...syncJobState };
}

/**
 * Exécute la synchronisation complète en tâche de fond (Drive -> Extraction texte -> Vision Gemini cadencée).
 * Évite tout timeout HTTP 502/503 côté proxy (Render) et tout pic 429 côté API Gemini.
 */
export function startBackgroundOfficialSync(params: {
  branch: 'PC' | 'SM';
  visionApiKey?: string;
  runDriveSync?: () => Promise<number>;
}): { started: boolean; alreadyRunning: boolean; syncJob: OfficialSyncStatus } {
  if (syncJobState.running) {
    return {
      started: false,
      alreadyRunning: true,
      syncJob: getOfficialSyncStatus(),
    };
  }

  const branch = params.branch === 'SM' ? 'SM' : 'PC';
  const cleanVisionKey = isLikelyGeminiKey(params.visionApiKey) ? String(params.visionApiKey).trim() : '';

  syncJobState = {
    running: true,
    phase: params.runDriveSync ? 'drive_sync' : 'text_indexing',
    branch,
    totalPdfs: 0,
    processedPdfs: 0,
    decodedCount: 0,
    alreadyDecodedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    driveSyncCount: 0,
    currentFile: '',
    message: params.runDriveSync
      ? 'Synchronisation Google Drive en cours…'
      : 'Indexation textuelle des documents officiels en cours…',
    lastError: undefined,
    startedAt: new Date().toISOString(),
    finishedAt: undefined,
  };

  void (async () => {
    try {
      // Phase 1 : Synchronisation Drive optionnelle
      if (params.runDriveSync) {
        syncJobState.phase = 'drive_sync';
        syncJobState.message = `Synchronisation Google Drive (${branch})…`;
        try {
          syncJobState.driveSyncCount = await params.runDriveSync();
        } catch (driveErr: any) {
          console.warn('[SyncJob] Avertissement sync Drive:', driveErr?.message || driveErr);
        }
      }

      // Phase 2 : Indexation textuelle rapide de tous les documents locaux
      syncJobState.phase = 'text_indexing';
      syncJobState.message = 'Extraction textuelle et mise en cache RAG…';
      await refreshDocumentsCache(true);

      const discovered = discoverProgrammeFiles(DOCS_DIR);
      const allPdfs = discovered.filter((f) => f.name.toLowerCase().endsWith('.pdf'));
      const pendingVision = allPdfs.filter((f) => !hasVisualMarker(f.absolutePath));
      const alreadyDecoded = allPdfs.length - pendingVision.length;

      syncJobState.alreadyDecodedCount = alreadyDecoded;
      syncJobState.totalPdfs = pendingVision.length;

      // Phase 3 : Décodage visuel Gemini cadencé (uniquement pour les PDF non encore décodés)
      if (!cleanVisionKey || pendingVision.length === 0) {
        const rag = getLocalRagStatus();
        syncJobState.running = false;
        syncJobState.phase = 'completed';
        syncJobState.currentFile = '';
        syncJobState.finishedAt = new Date().toISOString();
        syncJobState.message = !cleanVisionKey && pendingVision.length > 0
          ? `Base officielle synchronisée (texte) : ${rag.totalIndexedFiles} document(s) indexé(s) (${rag.pcCount} PC, ${rag.smCount} SM). Ajoutez une clé Gemini pour décoder les ${pendingVision.length} PDF restants.`
          : `Base officielle entièrement à jour : ${rag.totalIndexedFiles} document(s) indexé(s) (${rag.pcCount} PC, ${rag.smCount} SM dont ${rag.visuallyDecodedCount} avec graphes décodés).`;
        return;
      }

      // Prioriser la filière demandée et les examens légers avant les gros polycopiés
      pendingVision.sort((a, b) => {
        const aBranchPriority = a.branch === branch ? 0 : 1;
        const bBranchPriority = b.branch === branch ? 0 : 1;
        if (aBranchPriority !== bBranchPriority) return aBranchPriority - bBranchPriority;
        let aSize = 0;
        let bSize = 0;
        try { aSize = fs.statSync(a.absolutePath).size; } catch {}
        try { bSize = fs.statSync(b.absolutePath).size; } catch {}
        return aSize - bSize;
      });

      syncJobState.phase = 'vision_decoding';
      let usedQuotaPause = false;
      let consecutiveTransientErrors = 0;
      let stoppedEarlyReason = '';
      let stoppedByRateLimit = false;

      for (let idx = 0; idx < pendingVision.length; idx++) {
        const file = pendingVision[idx];
        syncJobState.currentFile = file.name;
        syncJobState.message = `Décodage visuel (${idx + 1}/${pendingVision.length}) : ${file.name}…`;

        // Double vérification au cas où le sidecar aurait été enrichi entretemps
        if (hasVisualMarker(file.absolutePath)) {
          syncJobState.alreadyDecodedCount++;
          syncJobState.processedPdfs++;
          continue;
        }

        const txtPath = `${file.absolutePath}.extracted.txt`;
        let rawText = '';
        try {
          if (fs.existsSync(txtPath)) {
            rawText = fs.readFileSync(txtPath, 'utf-8');
          } else {
            rawText = await extractTextFromPdf(fs.readFileSync(file.absolutePath));
            fs.writeFileSync(txtPath, rawText, 'utf-8');
          }
        } catch (readErr: any) {
          console.warn(`[SyncJob] Erreur lecture PDF ${file.name}:`, readErr?.message || readErr);
          syncJobState.failedCount++;
          syncJobState.processedPdfs++;
          continue;
        }

        const isScanned = !hasReadablePdfText(rawText);
        let outcome = isScanned
          ? await extractScannedPdfFullContent(file.absolutePath, cleanVisionKey)
          : await extractVisualDataFromPdfDetailed(file.absolutePath, cleanVisionKey);

        if (outcome.status === 'rate_limited' && !usedQuotaPause) {
          usedQuotaPause = true;
          const waitMs = Math.min(25_000, outcome.retryAfterMs || 15_000);
          syncJobState.message = `Quota Gemini atteint (429) — pause automatique de ${Math.round(waitMs / 1000)}s avant reprise…`;
          await sleep(waitMs);
          outcome = isScanned
            ? await extractScannedPdfFullContent(file.absolutePath, cleanVisionKey)
            : await extractVisualDataFromPdfDetailed(file.absolutePath, cleanVisionKey);
        }

        if (outcome.status === 'ok') {
          consecutiveTransientErrors = 0;
          const fullContent = isScanned
            ? `${outcome.text.trim()}\n`
            : `${rawText}\n\n================================================================================\n${SCIENTIFIC_VISION_MARKER}\n================================================================================\n\n${outcome.text}\n`;
          try {
            fs.writeFileSync(txtPath, fullContent, 'utf-8');
          } catch {}
          upsertCachedDoc(file, fullContent);
          syncJobState.decodedCount++;
          syncJobState.processedPdfs++;
        } else if (outcome.status === 'skipped') {
          consecutiveTransientErrors = 0;
          syncJobState.skippedCount++;
          syncJobState.processedPdfs++;
        } else if (outcome.status === 'invalid_key') {
          stoppedEarlyReason = outcome.errorMessage || 'Clé Gemini invalide ou refusée.';
          syncJobState.lastError = stoppedEarlyReason;
          break;
        } else if (outcome.status === 'rate_limited') {
          stoppedByRateLimit = true;
          stoppedEarlyReason = 'Quota API Gemini temporairement atteint (429). Les documents déjà décodés sont sauvegardés ; relancez plus tard pour continuer les restants.';
          syncJobState.lastError = stoppedEarlyReason;
          break;
        } else {
          // transient_error (502 / 503)
          syncJobState.failedCount++;
          syncJobState.processedPdfs++;
          consecutiveTransientErrors++;
          syncJobState.lastError = outcome.errorMessage;
          if (consecutiveTransientErrors >= 5) {
            stoppedEarlyReason = 'Indexation texte terminée ; transcription visuelle IA interrompue temporairement (surcharge 502/503). Progression sauvegardée.';
            syncJobState.lastError = stoppedEarlyReason;
            break;
          }
          await sleep(8_000);
        }

        // Cadencement entre deux fichiers pour respecter les limites RPM/TPM Gemini
        if (idx < pendingVision.length - 1) {
          await sleep(VISION_PACING_DELAY_MS);
        }
      }

      const rag = getLocalRagStatus();
      syncJobState.running = false;
      syncJobState.currentFile = '';
      syncJobState.finishedAt = new Date().toISOString();
      syncJobState.phase = (stoppedByRateLimit || stoppedEarlyReason)
        ? 'partial_rate_limit'
        : 'completed';

      if (stoppedEarlyReason) {
        syncJobState.message = `Index texte prêt (${rag.totalIndexedFiles} docs). ${syncJobState.decodedCount} nouveau(x) schéma(s) décodé(s). ${stoppedEarlyReason}`;
      } else {
        syncJobState.message = `Base officielle synchronisée : ${rag.totalIndexedFiles} document(s) indexé(s) (${rag.pcCount} PC, ${rag.smCount} SM dont ${rag.visuallyDecodedCount} avec graphes décodés).`;
      }
    } catch (err: any) {
      console.error('[SyncJob] Erreur critique tâche de fond:', err);
      syncJobState.running = false;
      syncJobState.phase = 'error';
      syncJobState.currentFile = '';
      syncJobState.finishedAt = new Date().toISOString();
      syncJobState.lastError = err?.message || 'Erreur inattendue.';
      syncJobState.message = `Erreur lors de la synchronisation : ${syncJobState.lastError}`;
    }
  })();

  return {
    started: true,
    alreadyRunning: false,
    syncJob: getOfficialSyncStatus(),
  };
}

/**
 * Résumé de l'état du RAG officiel local (séparé en 2BAC PC et 2BAC SM).
 */
export function getLocalRagStatus(): {
  active: boolean;
  pcCount: number;
  smCount: number;
  totalIndexedFiles: number;
  visuallyDecodedCount: number;
  pcIndexed: boolean;
  smIndexed: boolean;
  message: string;
} {
  const discovered = discoverProgrammeFiles(DOCS_DIR);
  const pcFiles = discovered.filter((f) => f.branch === 'PC');
  const smFiles = discovered.filter((f) => f.branch === 'SM');

  let visuallyDecodedCount = 0;
  for (const doc of discovered) {
    if (doc.name.toLowerCase().endsWith('.pdf') && hasVisualMarker(doc.absolutePath)) {
      visuallyDecodedCount++;
    }
  }

  return {
    active: true,
    pcCount: pcFiles.length,
    smCount: smFiles.length,
    totalIndexedFiles: discovered.length,
    visuallyDecodedCount,
    pcIndexed: pcFiles.length > 0,
    smIndexed: smFiles.length > 0,
    message: visuallyDecodedCount > 0
      ? `Base RAG active (${pcFiles.length} docs PC, ${smFiles.length} docs SM dont ${visuallyDecodedCount} avec graphes & schémas décodés).`
      : `Base RAG officielle locale active (${pcFiles.length} docs PC, ${smFiles.length} docs SM).`,
  };
}
