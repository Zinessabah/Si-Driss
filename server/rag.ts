import fs from 'fs';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import { DOCS_DIR } from './config';

interface CachedDocSection {
  raw: string;
  lower: string;
}

interface CachedDoc {
  name: string;
  mtime: number;
  sections: CachedDocSection[];
}

let documentsCache: CachedDoc[] = [];
let lastCacheRefreshTime = 0;

async function refreshDocumentsCache() {
  const now = Date.now();
  if (now - lastCacheRefreshTime < 4000) return;
  lastCacheRefreshTime = now;

  try {
    if (!fs.existsSync(DOCS_DIR)) return;
    const files = fs.readdirSync(DOCS_DIR).filter((f) => !f.endsWith('.extracted.txt'));

    const updatedCache: CachedDoc[] = [];

    for (const file of files) {
      const filePath = path.join(DOCS_DIR, file);
      const stat = fs.statSync(filePath);
      const existing = documentsCache.find((d) => d.name === file && d.mtime === stat.mtimeMs);

      if (existing) {
        updatedCache.push(existing);
        continue;
      }

      let content = '';
      if (file.toLowerCase().endsWith('.pdf')) {
        // H5 : ré-extrait le PDF dès que le texte en cache est plus ancien que le PDF lui-même
        content = await getFreshExtractedPdfText(filePath, path.join(DOCS_DIR, `${file}.extracted.txt`));
      } else if (file.endsWith('.md') || file.endsWith('.txt') || file.endsWith('.json')) {
        content = fs.readFileSync(filePath, 'utf-8');
      }

      if (content) {
        const rawSections = content.split(/\n#{1,3}\s+|\n\n+/).filter((s) => s.trim().length > 20);
        const sections: CachedDocSection[] = rawSections.map((s) => ({
          raw: s.trim().slice(0, 800),
          lower: s.toLowerCase(),
        }));
        updatedCache.push({ name: file, mtime: stat.mtimeMs, sections });
      }
    }
    documentsCache = updatedCache;
  } catch (err) {
    console.warn('Erreur rafraîchissement cache documents:', err);
  }
}

export async function searchLocalDocuments(query: string, branch: string = 'PC'): Promise<string> {
  try {
    await refreshDocumentsCache();
    if (!documentsCache.length) return '';

    const branchUpper = (branch || 'PC').toUpperCase();
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

    if (keywords.length === 0) return '';

    const matchedSnippets: { score: number; text: string }[] = [];

    for (const doc of documentsCache) {
      const docNameLower = doc.name.toLowerCase();
      // Filtrage par filière : exclure les référentiels de l'autre filière
      const isDocForSM = docNameLower.includes('_sm') || docNameLower.includes('-sm') || docNameLower.includes('sm.');
      const isDocForPC = docNameLower.includes('_pc') || docNameLower.includes('-pc') || docNameLower.includes('pc.');

      if (branchUpper === 'PC' && isDocForSM && !isDocForPC) continue;
      if (branchUpper === 'SM' && isDocForPC && !isDocForSM) continue;

      for (const sec of doc.sections) {
        let score = 0;
        for (const kw of keywords) {
          if (sec.lower.includes(kw)) {
            score++;
          }
        }
        if (score > 0) {
          // Bonus de pertinence si le document correspond exactement à la filière
          if ((branchUpper === 'PC' && isDocForPC) || (branchUpper === 'SM' && isDocForSM)) {
            score += 2;
          }
          matchedSnippets.push({
            score,
            text: `[Source officielle ${branchUpper}: ${doc.name}]\n${sec.raw}`,
          });
        }
      }
    }

    if (matchedSnippets.length > 0) {
      matchedSnippets.sort((a, b) => b.score - a.score);
      return matchedSnippets.slice(0, 3).map((s) => s.text).join('\n\n---\n\n');
    }
  } catch (err) {
    console.warn('Erreur recherche documents:', err);
  }
  return '';
}

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
 * True when the pre-extracted sidecar text is at least as recent as the PDF itself.
 * (H5 : un PDF remplacé hors upload ne doit jamais servir son ancien texte.)
 */
function isExtractedTextFresh(pdfPath: string, txtPath: string): boolean {
  try {
    return fs.statSync(txtPath).mtimeMs >= fs.statSync(pdfPath).mtimeMs;
  } catch {
    return false;
  }
}

/**
 * Returns the extracted text of a PDF, re-extracting it (and refreshing the sidecar
 * cache) whenever the stored .extracted.txt is older than the PDF itself.
 */
export async function getFreshExtractedPdfText(pdfPath: string, txtPath: string): Promise<string> {
  if (fs.existsSync(txtPath) && isExtractedTextFresh(pdfPath, txtPath)) {
    return fs.readFileSync(txtPath, 'utf-8');
  }
  const text = await extractTextFromPdf(fs.readFileSync(pdfPath));
  try {
    fs.writeFileSync(txtPath, text, 'utf-8');
  } catch (err) {
    console.warn('Impossible de mettre en cache le texte extrait:', err);
  }
  return text;
}
