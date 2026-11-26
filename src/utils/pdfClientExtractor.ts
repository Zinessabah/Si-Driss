let clientPdfWorkerReady = false;

/**
 * Vérifie qu'un texte extrait de PDF contient de véritables caractères lisibles
 * et non uniquement des marqueurs de page vides ("-- 1 of N --").
 */
export function hasMeaningfulPdfText(rawText?: string): boolean {
  if (!rawText) return false;
  const cleaned = rawText.replace(/^--\s*\d+\s+of\s+\d+\s*--$/gm, '').trim();
  return cleaned.length >= 80;
}

/**
 * Tente d'extraire la couche texte d'un PDF côté navigateur via pdfjs-dist.
 * Retourne `undefined` pour les PDF purement scannés afin que l'IA déclenche
 * la lecture visuelle / OCR automatique côté serveur.
 */
export async function extractClientPdfText(file: File, maxPages: number = 12): Promise<string | undefined> {
  let doc: any = null;
  try {
    const [pdfjsLib, workerMod] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]);
    if (!clientPdfWorkerReady) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerMod.default;
      clientPdfWorkerReady = true;
    }

    const buffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
    doc = await loadingTask.promise;

    const totalPages = Math.min(doc.numPages || 0, maxPages);
    const chunks: string[] = [];
    let realChars = 0;

    for (let p = 1; p <= totalPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const pageStr = (content.items || [])
        .map((it: any) => (typeof it?.str === 'string' ? it.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      realChars += pageStr.length;
      if (pageStr) {
        chunks.push(`-- ${p} of ${doc.numPages} --\n${pageStr}`);
      }
    }

    if (realChars < 80) {
      return undefined;
    }
    return chunks.join('\n\n').slice(0, 24_000);
  } catch {
    return undefined;
  } finally {
    if (doc) {
      try {
        await doc.destroy();
      } catch {}
    }
  }
}

