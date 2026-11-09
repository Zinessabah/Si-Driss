import fs from 'fs';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import { DOCS_DIR } from './config';
import { SCIENTIFIC_VISION_MARKER, extractVisualDataFromPdf } from './visionExtractor';

interface CachedDocSection {
  raw: string;
  lower: string;
}

export type DocumentBranch = 'PC' | 'SM' | 'ALL';

interface CachedDoc {
  name: string;
  relativePath: string;
  branch: DocumentBranch;
  mtime: number;
  sections: CachedDocSection[];
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

/**
 * Rafraîchit l'index RAG en mémoire à partir du stockage local (docs/programme/PC et docs/programme/SM).
 * L'extraction des PDF se fait avec mise en cache .extracted.txt et décodage visuel si apiKey est fournie.
 */
export async function refreshDocumentsCache(force: boolean = false, apiKey?: string) {
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
      const alreadyHasVisuals = isPdf ? hasVisualMarker(file.absolutePath) : true;

      const existing = documentsCache.find(
        (d) => d.relativePath === file.relativePath && d.mtime === file.mtime
      );

      // Si le document est déjà en cache mémoire et ne requiert pas de décodage visuel additionnel
      if (existing && (!apiKey || !isPdf || alreadyHasVisuals)) {
        updatedCache.push(existing);
        continue;
      }

      let content = '';
      if (isPdf) {
        const sidecarPath = `${file.absolutePath}.extracted.txt`;
        content = await getFreshExtractedPdfText(file.absolutePath, sidecarPath, apiKey);
      } else {
        content = fs.readFileSync(file.absolutePath, 'utf-8');
      }

      if (content) {
        // Découpage en sections thématiques pour le RAG
        const rawSections = content.split(/\n#{1,3}\s+|\n\n+/).filter((s) => s.trim().length > 20);
        const sections: CachedDocSection[] = rawSections.map((s) => ({
          raw: s.trim().slice(0, 900),
          lower: s.toLowerCase(),
        }));

        updatedCache.push({
          name: file.name,
          relativePath: file.relativePath,
          branch: file.branch,
          mtime: file.mtime,
          sections,
        });
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
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

    if (keywords.length === 0) return '';

    const matchedSnippets: { score: number; text: string }[] = [];

    for (const doc of documentsCache) {
      // ÉTANCHÉITÉ STRICTE : Si l'élève est en PC, on rejette tout document SM.
      // Si l'élève est en SM, on rejette tout document PC.
      if (doc.branch !== 'ALL' && doc.branch !== branchUpper) {
        continue;
      }

      for (const sec of doc.sections) {
        let score = 0;
        for (const kw of keywords) {
          if (sec.lower.includes(kw)) {
            score++;
          }
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
 * Récupère le texte extrait d'un PDF depuis le cache ou extrait + enrichit visuellement si nouveau/clé fournie.
 */
export async function getFreshExtractedPdfText(
  pdfPath: string,
  txtPath: string,
  apiKey?: string
): Promise<string> {
  const isFresh = fs.existsSync(txtPath) && isExtractedTextFresh(pdfPath, txtPath);
  let existingContent = isFresh ? fs.readFileSync(txtPath, 'utf-8') : '';

  const alreadyHasVisuals = existingContent.includes(SCIENTIFIC_VISION_MARKER);

  // Si le cache est à jour et possède déjà la transcription visuelle, ou si aucune clé vision n'est fournie
  if (isFresh && (alreadyHasVisuals || !apiKey)) {
    return existingContent;
  }

  // 1. Extraction texte brut si manquant ou périmé
  let rawText = existingContent;
  if (!isFresh || !rawText) {
    rawText = await extractTextFromPdf(fs.readFileSync(pdfPath));
  }

  // 2. Transcription visuelle IA des schémas, circuits et graphes si apiKey fournie
  let fullContent = rawText;
  if (apiKey && !alreadyHasVisuals) {
    try {
      const visualData = await extractVisualDataFromPdf(pdfPath, apiKey);
      if (visualData && visualData.trim().length > 30) {
        fullContent = `${rawText}\n\n================================================================================\n${SCIENTIFIC_VISION_MARKER}\n================================================================================\n\n${visualData}\n`;
        console.log(`[RAG] Document "${path.basename(pdfPath)}" enrichi avec succès avec le décodage des schémas/graphes.`);
      }
    } catch (visErr) {
      console.warn(`[RAG] Avertissement décodage visuel pour ${path.basename(pdfPath)}:`, visErr);
    }
  }

  try {
    fs.writeFileSync(txtPath, fullContent, 'utf-8');
  } catch (err) {
    console.warn('Impossible de mettre en cache le texte extrait:', err);
  }
  return fullContent;
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
