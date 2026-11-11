import fs from 'fs';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import { DOCS_DIR } from './config';
import {
  SCIENTIFIC_VISION_MARKER,
  extractVisualDataFromPdfDetailed,
  isLikelyGeminiKey,
} from './visionExtractor';

interface CachedDocSection {
  raw: string;
  lower: string;
  arabicNorm: string;
}

export type DocumentBranch = 'PC' | 'SM' | 'ALL';

interface CachedDoc {
  name: string;
  relativePath: string;
  absolutePath: string;
  branch: DocumentBranch;
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
  mtime: number;
}

let documentsCache: CachedDoc[] = [];
let lastCacheRefreshTime = 0;

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
}

/**
 * Analyse la requête utilisateur pour identifier les demandes d'examens nationaux (année, session, thème).
 */
export function parseExamQuery(query: string): ParsedExamQuery {
  const q = query.toLowerCase();

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

  // 3. Détection du thème disciplinaire
  let topic: ExamTopic | null = null;
  if (/\b(onde|ondes|lumineus|sonor|optique|laser|diffraction|propagation|fibre)\b/i.test(q)) {
    topic = 'ondes';
  } else if (/\b(nucleaire|nucl[eé]aire|radioactiv|d[eé]croissance|astate|polonium|uranium|radium|noyau)\b/i.test(q)) {
    topic = 'nucleaire';
  } else if (/\b(electr|[eé]lectricit[eé]|rlc|circuit|condensateur|bobine|dipole|modulation)\b/i.test(q)) {
    topic = 'electricite';
  } else if (/\b(mecan|m[eé]canique|newton|chute|projectile|satellite|planete|oscillat|pendule)\b/i.test(q)) {
    topic = 'mecanique';
  } else if (/\b(chimie|acide|base|titrage|dosage|ester|pile|electrolyse)\b/i.test(q)) {
    topic = 'chimie';
  }

  const isExamQuery = !!(year || session || /\b(examen|national|bac|baccalaureat|epreuve|sujet)\b/i.test(q));

  return { isExamQuery, year, session, topic };
}

const NEXT_SECTION_FOR_TOPIC: Record<ExamTopic, RegExp[]> = {
  chimie: [/التمرين\s*(الثاني|2)/i, /الموج/i, /EXERCICE\s*2/i],
  ondes: [/النوو/i, /التمرين\s*(الثالث|3)/i, /الكهرب/i, /EXERCICE\s*3/i, /Nucl[eé]aire/i],
  nucleaire: [/التمرين\s*(الثالث|3)/i, /الكهرب/i, /EXERCICE\s*3/i, /[EÉ]lectricit[eé]/i],
  electricite: [/التمرين\s*(الرابع|4)/i, /الميكانيك/i, /EXERCICE\s*4/i, /M[eé]canique/i],
  mecanique: [/===+\s*TRANSCRIPTION\s*VISUELLE/i, /^\s*FIN\s*(?:DE\s*L['’]ÉPREUVE|DU\s*SUJET)?\s*$/im],
};

const TOPIC_VISION_PATTERNS: Record<ExamTopic, RegExp[]> = {
  ondes: [/\bonde/i, /lumineus/i, /fibre/i, /diffraction/i, /laser/i],
  nucleaire: [/nucl[eé]aire/i, /radioactiv/i, /d[eé]croissance/i, /astate/i, /noyau/i],
  electricite: [/rc/i, /rl/i, /rlc/i, /[eé]lectricit[eé]/i, /modulation/i, /condensateur/i],
  mecanique: [/m[eé]canique/i, /golf/i, /satellite/i, /oscillateur/i, /chute/i, /pendule/i],
  chimie: [/chimie/i, /acide/i, /base/i, /ester/i, /titrage/i, /pile/i],
};

/**
 * Extrait précisément l'énoncé d'un exercice et ses données visuelles (graphes/schémas décodés).
 */
export function extractExamExercise(
  rawContent: string,
  topic: ExamTopic | null
): { exerciseText: string; visualText: string } {
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

  if (!topic) {
    return {
      exerciseText: bodyContent.slice(0, 3500),
      visualText: visualText.trim(),
    };
  }

  const { normalized: normBody, toRawIndex } = normalizeArabicWithIndexMap(bodyContent);

  const topicArPats: Record<ExamTopic, RegExp[]> = {
    ondes: [/الموجات/i, /موج/i],
    nucleaire: [/النوو/i, /التحولات\s*النووية/i],
    electricite: [/الكهرب/i, /ثنائي\s*القطب/i],
    mecanique: [/الميكانيك/i, /نيوتن/i],
    chimie: [/الكيمياء/i, /حمض/i],
  };

  const topicFrPats: Record<ExamTopic, RegExp[]> = {
    ondes: [/exercice\s*\d?\s*[:\-]?\s*ondes/i, /propagation\s*d'une\s*onde/i, /ondes\s*lumineuses/i],
    nucleaire: [/exercice\s*\d?\s*[:\-]?\s*physique\s*nucl/i, /d[eé]croissance\s*radioactive/i],
    electricite: [/exercice\s*\d?\s*[:\-]?\s*[eé]lectricit/i, /r[eé]ponse\s*d'un\s*dip/i],
    mecanique: [/exercice\s*\d?\s*[:\-]?\s*m[eé]canique/i, /mouvement\s*d'un/i],
    chimie: [/exercice\s*\d?\s*[:\-]?\s*chimie/i, /[eé]tude\s*d'une\s*solution/i],
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

  // Si non trouvé en arabe, recherche en français sur normBody également (sujets BIOF)
  // pour rester dans le même repère d'indices que normBody / toRawIndex
  if (bestStart === -1) {
    for (const re of topicFrPats[topic]) {
      const match = normBody.search(re);
      if (match !== -1) {
        bestStart = match;
        break;
      }
    }
  }

  if (bestStart === -1) {
    return {
      exerciseText: bodyContent.slice(0, 3500),
      visualText: visualText.trim(),
    };
  }

  // Reculer pour attraper l'en-tête de l'exercice (ex: "التمرين الثاني" ou "EXERCICE 2")
  const lookbackStart = Math.max(0, bestStart - 350);
  const lookbackChunk = normBody.slice(lookbackStart, bestStart);
  const headerIdx = lookbackChunk.search(/(التمرين|EXERCICE)/i);
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
      // Ignorer les sidecars d'extraction et les fichiers cachés
      if (entry.name.startsWith('.') || entry.name.endsWith('.extracted.txt')) {
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (!['.pdf', '.md', '.txt', '.json'].includes(ext)) {
        continue;
      }

      const relPath = path.relative(baseDir, fullPath);
      const stat = fs.statSync(fullPath);
      const branch = resolveDocumentBranch(relPath, entry.name);

      results.push({
        absolutePath: fullPath,
        relativePath: relPath,
        name: entry.name,
        branch,
        mtime: stat.mtimeMs,
      });
    }
  }

  return results;
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
  const now = Date.now();
  if (!force && now - lastCacheRefreshTime < 4000) {
    return getLocalRagStatus();
  }
  lastCacheRefreshTime = now;

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
      } else {
        content = fs.readFileSync(file.absolutePath, 'utf-8');
      }

      if (content) {
        updatedCache.push(buildCachedDoc(file, content));
      }
    }

    documentsCache = updatedCache;
  } catch (err) {
    console.warn('Erreur rafraîchissement cache RAG local:', err);
  }

  return getLocalRagStatus();
}

/**
 * Recherche contextuelle dans les documents officiels avec ÉTANCHÉITÉ TOTALE entre PC et SM.
 * Aucune fuite d'exercice SM vers PC (ex: pas d'oscillations forcées/impédance Z chez PC).
 * Aucune fuite de document PC vers SM (ex: modulation AM n'apparaît pas chez SM).
 */
export async function searchLocalDocuments(query: string, branch: string = 'PC'): Promise<string> {
  try {
    await refreshDocumentsCache();
    if (!documentsCache.length) return '';

    const branchUpper = (branch || 'PC').toUpperCase() as 'PC' | 'SM';
    const parsed = parseExamQuery(query);

    // 1. ROUTE PRIORITAIRE : EXAMEN NATIONAL DU BACCALAURÉAT
    // Si la requête concerne une épreuve nationale (année, session, ou mot-clé examen/national),
    // on identifie le document officiel cible dans la filière de l'élève (PC ou SM)
    if (parsed.isExamQuery) {
      let bestDoc: CachedDoc | null = null;
      let bestScore = 0;

      for (const doc of documentsCache) {
        // ÉTANCHÉITÉ STRICTE PC vs SM
        if (doc.branch !== 'ALL' && doc.branch !== branchUpper) {
          continue;
        }

        let docScore = 0;
        const normName = doc.name.toLowerCase();

        // Correspondance sur l'année (ex: 2015, 2014, etc.)
        if (parsed.year && normName.includes(String(parsed.year))) {
          docScore += 60;
        }

        // Correspondance sur la session (SN vs SR)
        if (parsed.session === 'SN' && (normName.includes('sn') || normName.includes('normale'))) {
          docScore += 30;
        } else if (parsed.session === 'SR' && (normName.includes('sr') || normName.includes('rattrapage'))) {
          docScore += 30;
        }

        // Bonus filière et type PDF
        if (normName.includes(branchUpper.toLowerCase())) {
          docScore += 10;
        }
        if (normName.endsWith('.pdf')) {
          docScore += 5;
        }

        if (docScore > bestScore) {
          bestScore = docScore;
          bestDoc = doc;
        }
      }

      // Si un document officiel national est identifié
      if (bestDoc && bestScore >= 50) {
        const fullContent = readDocumentFullText(bestDoc);
        const { exerciseText, visualText } = extractExamExercise(fullContent, parsed.topic);
        if (exerciseText || visualText) {
          const sessionLabel = parsed.session === 'SN'
            ? 'Session Normale'
            : parsed.session === 'SR'
            ? 'Session de Rattrapage'
            : 'Épreuve Officielle';

          const examHeader = `[Cadre Officiel 2BAC ${branchUpper} - Épreuve Nationale du Baccalauréat marocain]\n` +
            `Document officiel : ${bestDoc.name} | ${sessionLabel} ${parsed.year || ''}\n` +
            (parsed.topic ? `Discipline / Thème : ${parsed.topic.toUpperCase()}\n` : '');

          return `${examHeader}\n--- ÉNONCÉ OFFICIEL EXTRAIT DU SUJET NATIONAL ---\n${exerciseText}\n\n` +
            (visualText ? `--- DONNÉES VISUELLES & SCHÉMAS DÉCODÉS (TRANSCRIPTION OFFICIELLE SI DRISS) ---\n${visualText}\n` : '');
        }
      }
    }

    // 2. ROUTE GÉNÉRALE : RECHERCHE MULTI-SECTIONS CROISÉE FRANÇAIS / ARABE
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

    if (keywords.length === 0) return '';

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

    for (const doc of documentsCache) {
      // ÉTANCHÉITÉ STRICTE : Si l'élève est en PC, on rejette tout document SM.
      // Si l'élève est en SM, on rejette tout document PC.
      if (doc.branch !== 'ALL' && doc.branch !== branchUpper) {
        continue;
      }

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

        // Si la section contient des données visuelles décodées pertinentes
        if (sec.raw.includes('FIGURE / SCHÉMA DÉCODÉ') && score > 0) {
          score += 4;
        }

        if (score > 0) {
          // Bonus de pertinence si spécifiquement affilié à la filière
          if (doc.branch === branchUpper) {
            score += 3;
          }
          matchedSnippets.push({
            score,
            text: `[Cadre Officiel 2BAC ${branchUpper} - ${doc.name}]\n${sec.raw}`,
          });
        }
      }
    }

    if (matchedSnippets.length > 0) {
      matchedSnippets.sort((a, b) => b.score - a.score);
      // Retourne les 3 meilleurs extraits officiels
      return matchedSnippets.slice(0, 3).map((s) => s.text).join('\n\n---\n\n');
    }
  } catch (err) {
    console.warn('Erreur recherche documents RAG:', err);
  }
  return '';
}

/**
 * Extrait le texte d'un PDF en mémoire.
 */
export async function extractTextFromPdf(buf: Buffer): Promise<string> {
  try {
    const parser = new PDFParse({ data: buf });
    const result = await parser.getText();
    await parser.destroy();
    return result.text || '';
  } catch (err) {
    console.warn('Erreur extraction PDF:', err);
    return '';
  }
}

/**
 * Vérifie si le fichier texte extrait (.extracted.txt) est aussi récent que le PDF.
 */
function isExtractedTextFresh(pdfPath: string, txtPath: string): boolean {
  try {
    return fs.statSync(txtPath).mtimeMs >= fs.statSync(pdfPath).mtimeMs;
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

  // Si le cache est à jour et possède déjà la transcription visuelle, ou si aucune clé vision valide n'est fournie
  if (isFresh && (alreadyHasVisuals || !apiKey || !isLikelyGeminiKey(apiKey))) {
    return existingContent;
  }

  // 1. Extraction texte brut si manquant ou périmé
  let rawText = existingContent;
  if (!isFresh || !rawText) {
    rawText = await extractTextFromPdf(fs.readFileSync(pdfPath));
    // Sauvegarde immédiate du texte brut pour éviter de re-parser le PDF en cas d'erreur Vision ultérieure
    try {
      fs.writeFileSync(txtPath, rawText, 'utf-8');
    } catch (err) {
      console.warn('Impossible de mettre en cache le texte extrait:', err);
    }
  }

  // 2. Transcription visuelle IA des schémas, circuits et graphes si clé Gemini valide fournie
  let fullContent = rawText;
  if (apiKey && isLikelyGeminiKey(apiKey) && !alreadyHasVisuals) {
    try {
      const outcome = await extractVisualDataFromPdfDetailed(pdfPath, apiKey);
      if (outcome.status === 'ok' && outcome.text.trim().length > 30) {
        fullContent = `${rawText}\n\n================================================================================\n${SCIENTIFIC_VISION_MARKER}\n================================================================================\n\n${outcome.text}\n`;
        console.log(`[RAG] Document "${path.basename(pdfPath)}" enrichi avec succès avec le décodage des schémas/graphes.`);
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

        let outcome = await extractVisualDataFromPdfDetailed(file.absolutePath, cleanVisionKey);

        if (outcome.status === 'rate_limited' && !usedQuotaPause) {
          usedQuotaPause = true;
          const waitMs = Math.min(25_000, outcome.retryAfterMs || 15_000);
          syncJobState.message = `Quota Gemini atteint (429) — pause automatique de ${Math.round(waitMs / 1000)}s avant reprise…`;
          await sleep(waitMs);
          outcome = await extractVisualDataFromPdfDetailed(file.absolutePath, cleanVisionKey);
        }

        if (outcome.status === 'ok') {
          consecutiveTransientErrors = 0;
          const fullContent = `${rawText}\n\n================================================================================\n${SCIENTIFIC_VISION_MARKER}\n================================================================================\n\n${outcome.text}\n`;
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
          if (consecutiveTransientErrors >= 3) {
            stoppedEarlyReason = 'Serveurs IA temporairement surchargés (502/503). Progression sauvegardée, réessayez dans quelques minutes.';
            syncJobState.lastError = stoppedEarlyReason;
            break;
          }
          await sleep(6_000);
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
      syncJobState.phase = stoppedByRateLimit
        ? 'partial_rate_limit'
        : stoppedEarlyReason
        ? 'error'
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
