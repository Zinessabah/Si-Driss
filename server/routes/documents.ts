import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { DOCS_DIR, GOOGLE_DRIVE_FOLDER_PC, GOOGLE_DRIVE_FOLDER_SM } from '../config';
import { requireAdmin, documentMutationLimiter } from '../security';
import { extractTextFromPdf, getFreshExtractedPdfText, getLocalRagStatus } from '../rag';
import { syncGoogleDriveBranch, extractDriveFolderId } from '../driveSync';

/**
 * Routes de gestion des documents du programme et du RAG.
 * 
 * ARCHITECTURE 100% LOCALE & CONFIDENTIELLE :
 * 1. Les documents officiels sont stockés localement sur le serveur dans /docs/programme/PC/ et /docs/programme/SM/.
 * 2. L'indexation et l'extraction de texte se font une seule fois par document avec mise en cache .extracted.txt.
 * 3. Les élèves ne voient jamais la liste des fichiers officiels ni ne peuvent les télécharger.
 * 4. Étanchéité stricte : aucun dossier "Commun" — 2BAC PC et 2BAC SM sont entièrement séparés.
 */
export function createDocumentsRouter(): Router {
  const router = Router();

  /**
   * Statut public du RAG pour les élèves.
   * Indique si les bases PC et SM sont actives sans exposer de fichiers ou de liens.
   */
  router.get('/rag/status', (_req, res) => {
    return res.json(getLocalRagStatus());
  });

  /**
   * Liste des documents du programme (RÉSERVÉ ADMIN / ENSEIGNANT).
   */
  router.get('/documents', requireAdmin, async (_req, res) => {
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

  /**
   * Lecture du contenu d'un fichier (RÉSERVÉ ADMIN / ENSEIGNANT).
   */
  router.get('/documents/file', requireAdmin, async (req, res) => {
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

  /**
   * Téléchargement direct d'un fichier officiel (RÉSERVÉ ADMIN / ENSEIGNANT).
   */
  router.get('/documents/download', requireAdmin, (req, res) => {
    try {
      const name = String(req.query.name || '');
      if (!name) return res.status(400).json({ error: 'Nom requis.' });

      const safeName = path.basename(name);
      const filePath = path.join(DOCS_DIR, safeName);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Fichier non trouvé.' });
      }

      return res.download(filePath, safeName);
    } catch (err: any) {
      console.error('Erreur download document:', err);
      return res.status(500).json({ error: 'Erreur téléchargement document.' });
    }
  });

  /**
   * Configuration des dossiers Google Drive (RÉSERVÉ ADMIN / ENSEIGNANT).
   */
  router.get('/documents/drive-config', requireAdmin, (_req, res) => {
    return res.json({
      folderPc: GOOGLE_DRIVE_FOLDER_PC || '',
      folderSm: GOOGLE_DRIVE_FOLDER_SM || '',
    });
  });

  /**
   * Synchronisation depuis Google Drive (RÉSERVÉ ADMIN / ENSEIGNANT).
   */
  router.post('/documents/sync-drive', requireAdmin, documentMutationLimiter, async (req, res) => {
    try {
      const branch = (String(req.body.branch || 'PC').toUpperCase() === 'SM' ? 'SM' : 'PC') as 'PC' | 'SM';
      const folderInput = String(req.body.folderId || req.body.folderUrl || '');
      const apiKey = String(req.body.apiKey || '').trim();

      const result = await syncGoogleDriveBranch({
        branch,
        folderIdOrUrl: folderInput,
        apiKey: apiKey || undefined,
      });

      return res.json(result);
    } catch (err: any) {
      console.error('Erreur synchronisation Drive:', err);
      return res.status(500).json({ error: `Erreur synchronisation Drive : ${err?.message || 'Erreur inconnue'}` });
    }
  });

  const UPLOAD_ALLOWED_EXTENSIONS = new Set(['.pdf', '.md', '.txt', '.json', '.csv']);
  const UPLOAD_MAX_BASE64_BYTES = 15 * 1024 * 1024; // ~15 MB
  const UPLOAD_MAX_TEXT_CHARS = 2_000_000;

  /**
   * Téléversement manuel d'un document dans le RAG (RÉSERVÉ ADMIN / ENSEIGNANT).
   */
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
          ? `Document PDF "${safeName}" indexé et texte extrait pour le RAG !`
          : `Document "${safeName}" indexé avec succès dans /docs/programme/`,
        file: { name: safeName },
      });
    } catch (err: any) {
      console.error('Erreur upload document:', err);
      return res.status(500).json({ error: 'Erreur lors de la sauvegarde du document.' });
    }
  });

  /**
   * Suppression d'un document du RAG (RÉSERVÉ ADMIN / ENSEIGNANT).
   */
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
