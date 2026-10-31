import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { DOCS_DIR } from '../config';
import { requireAdmin, documentMutationLimiter } from '../security';
import { extractTextFromPdf, getFreshExtractedPdfText } from '../rag';

/** Routes de gestion des documents du programme (/docs/programme). */
export function createDocumentsRouter(): Router {
  const router = Router();

router.get('/documents', async (_req, res) => {
  try {
    if (!fs.existsSync(DOCS_DIR)) {
      return res.json({ directory: DOCS_DIR, files: [] });
    }

    const fileNames = fs.readdirSync(DOCS_DIR).filter((f) => !f.endsWith('.extracted.txt'));
    const files = await Promise.all(
      fileNames.map(async (name) => {
        const filePath = path.join(DOCS_DIR, name);
        const stat = fs.statSync(filePath);
        let preview = '';
        const isPdf = name.toLowerCase().endsWith('.pdf');

        if (isPdf) {
          try {
            // H5 : ré-extrait si le texte stocké est plus ancien que le PDF
            const text = await getFreshExtractedPdfText(filePath, path.join(DOCS_DIR, `${name}.extracted.txt`));
            preview = text.slice(0, 150).replace(/\n/g, ' ');
          } catch {
            preview = 'Document PDF prêt à être indexé';
          }
        } else {
          try {
            const text = fs.readFileSync(filePath, 'utf-8');
            preview = text.slice(0, 150).replace(/\n/g, ' ');
          } catch {
            preview = 'Document texte';
          }
        }

        return {
          name,
          size: stat.size,
          modified: stat.mtime,
          preview,
          isPdf,
        };
      })
    );

    return res.json({
      directory: '/docs/programme',
      files,
    });
  } catch (err: any) {
    console.error('Erreur get documents:', err);
    return res.status(500).json({ error: 'Impossible de lire les documents.' });
  }
});

router.get('/documents/file', async (req, res) => {
  try {
    const name = String(req.query.name || '');
    if (!name) return res.status(400).json({ error: 'Nom requis.' });

    const safeName = path.basename(name);
    const filePath = path.join(DOCS_DIR, safeName);
    const isPdf = safeName.toLowerCase().endsWith('.pdf');

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Fichier non trouvé.' });
    }

    if (isPdf) {
      // H5 : ré-extrait si le texte stocké est plus ancien que le PDF
      const content = await getFreshExtractedPdfText(filePath, path.join(DOCS_DIR, `${safeName}.extracted.txt`));
      return res.json({ name: safeName, content, isPdf: true });
    } else {
      const content = fs.readFileSync(filePath, 'utf-8');
      return res.json({ name: safeName, content, isPdf: false });
    }
  } catch (err: any) {
    console.error('Erreur get document file:', err);
    return res.status(500).json({ error: 'Erreur lecture document.' });
  }
});

const UPLOAD_ALLOWED_EXTENSIONS = new Set(['.pdf', '.md', '.txt', '.json', '.csv']);
const UPLOAD_MAX_BASE64_BYTES = 15 * 1024 * 1024; // ~15 MB encoded ≈ 11 MB file
const UPLOAD_MAX_TEXT_CHARS = 2_000_000;

router.post('/documents/upload', requireAdmin, documentMutationLimiter, async (req, res) => {
  try {
    const { filename, content, base64 } = req.body;
    if (!filename || (content === undefined && !base64)) {
      return res.status(400).json({ error: 'Nom de fichier et contenu (texte ou base64) requis.' });
    }

    const safeName = path.basename(filename).replace(/[^a-zA-Z0-9_\-\.]/g, '_');

    if (!safeName || safeName === '.' || safeName === '..') {
      return res.status(400).json({ error: 'Nom de fichier invalide.' });
    }

    // Never accept pre-extracted sidecars: they would bypass PDF parsing and inject
    // arbitrary text straight into the RAG index.
    if (safeName.toLowerCase().endsWith('.extracted.txt')) {
      return res.status(400).json({ error: 'Ce nom de fichier est réservé au système d’indexation.' });
    }

    const ext = path.extname(safeName).toLowerCase();
    if (!UPLOAD_ALLOWED_EXTENSIONS.has(ext)) {
      return res.status(400).json({
        error: `Extension "${ext}" non autorisée. Formats acceptés : ${[...UPLOAD_ALLOWED_EXTENSIONS].join(', ')}.`,
      });
    }

    if (base64 && String(base64).length > UPLOAD_MAX_BASE64_BYTES) {
      return res.status(413).json({ error: 'Fichier trop volumineux (max ~11 Mo).' });
    }
    if (content !== undefined && String(content).length > UPLOAD_MAX_TEXT_CHARS) {
      return res.status(413).json({ error: 'Document texte trop volumineux (max 2 millions de caractères).' });
    }

    const filePath = path.join(DOCS_DIR, safeName);
    const isPdf = ext === '.pdf';

    if (base64) {
      const buf = Buffer.from(base64, 'base64');
      fs.writeFileSync(filePath, buf);

      if (isPdf) {
        try {
          const text = await extractTextFromPdf(buf);
          const txtPath = path.join(DOCS_DIR, `${safeName}.extracted.txt`);
          fs.writeFileSync(txtPath, text, 'utf-8');
        } catch (pdfErr) {
          console.warn('Extraction PDF échouée:', pdfErr);
        }
      }
    } else {
      fs.writeFileSync(filePath, content, 'utf-8');
    }

    return res.json({
      success: true,
      message: isPdf
        ? `Document PDF "${safeName}" téléchargé et texte extrait automatiquement pour l'indexation !`
        : `Document "${safeName}" indexé avec succès dans /docs/programme/`,
      file: { name: safeName },
    });
  } catch (err: any) {
    console.error('Erreur upload document:', err);
    return res.status(500).json({ error: 'Erreur lors de la sauvegarde du document.' });
  }
});

router.delete('/documents/:filename', requireAdmin, documentMutationLimiter, async (req, res) => {
  try {
    const { filename } = req.params;
    const safeName = path.basename(filename);
    const filePath = path.join(DOCS_DIR, safeName);
    const txtPath = path.join(DOCS_DIR, `${safeName}.extracted.txt`);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      if (fs.existsSync(txtPath)) {
        fs.unlinkSync(txtPath);
      }
      return res.json({ success: true, message: `Fichier ${safeName} supprimé.` });
    }
    return res.status(404).json({ error: 'Fichier non trouvé.' });
  } catch (err: any) {
    console.error('Erreur suppression document:', err);
    return res.status(500).json({ error: 'Erreur lors de la suppression.' });
  }
});

  return router;
}
