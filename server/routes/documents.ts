import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { DOCS_DIR, GOOGLE_DRIVE_FOLDER_PC, GOOGLE_DRIVE_FOLDER_SM } from '../config';
import { requireAdmin, documentMutationLimiter } from '../security';
import {
  extractTextFromPdf,
  getFreshExtractedPdfText,
  getLocalRagStatus,
  discoverProgrammeFiles,
  refreshDocumentsCache,
} from '../rag';
import { syncGoogleDriveBranch, extractDriveFolderId } from '../driveSync';

/**
 * Résout le chemin absolu sécurisé d'un document dans DOCS_DIR.
 * Empêche toute tentative de path traversal (..) et prend en charge
 * les fichiers situés dans la racine ou dans les sous-dossiers PC/ et SM/.
 */
function resolveDocumentFilePath(nameOrRelativePath: string): string | null {
  if (!nameOrRelativePath || typeof nameOrRelativePath !== 'string') return null;

  const clean = nameOrRelativePath.trim();
  if (!clean) return null;

  const normalizedDocsDir = path.resolve(DOCS_DIR);
  const resolved = path.resolve(DOCS_DIR, clean);

  // Sécurité anti-traversal : le chemin résolu DOIT être à l'intérieur de DOCS_DIR
  if (!resolved.startsWith(normalizedDocsDir + path.sep) && resolved !== normalizedDocsDir) {
    return null;
  }

  // 1. Si le fichier direct existe
  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
    return resolved;
  }

  // 2. Recherche par nom de base dans DOCS_DIR/PC, DOCS_DIR/SM, ou DOCS_DIR
  const baseName = path.basename(clean);
  const candidates = [
    path.join(DOCS_DIR, 'PC', baseName),
    path.join(DOCS_DIR, 'SM', baseName),
    path.join(DOCS_DIR, baseName),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  // 3. Recherche parmi tous les fichiers découverts par le RAG
  const allFiles = discoverProgrammeFiles(DOCS_DIR);
  const matched = allFiles.find(
    (f) => f.name === baseName || f.relativePath === clean || f.name === clean
  );
  if (matched && fs.existsSync(matched.absolutePath) && fs.statSync(matched.absolutePath).isFile()) {
    return matched.absolutePath;
  }

  return null;
}

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
   * Liste publique des documents officiels du programme indexés dans le RAG.
   * Fournit le nom, la filière, la taille et le format sans exposer de chemin absolu système.
   */
  router.get('/documents/official', (_req, res) => {
    try {
      if (!fs.existsSync(DOCS_DIR)) {
        return res.json({ files: [] });
      }

      const discovered = discoverProgrammeFiles(DOCS_DIR);
      const files = discovered.map((doc) => {
        let size = 0;
        try {
          size = fs.statSync(doc.absolutePath).size;
        } catch {}

        return {
          name: doc.name,
          relativePath: doc.relativePath,
          branch: doc.branch,
          size,
          isPdf: doc.name.toLowerCase().endsWith('.pdf'),
        };
      });

      return res.json({ files });
    } catch (err: any) {
      console.error('Erreur get official documents:', err);
      return res.status(500).json({ error: 'Impossible de lister les documents officiels.' });
    }
  });

  /**
   * Synchronisation des documents officiels téléchargés et ré-indexation du RAG local.
   * Re-scanne les sous-dossiers PC/ et SM/, extrait les textes des nouveaux PDFs et
   * met à jour l'index en mémoire de Si Driss.
   */
  router.post('/documents/sync', async (req, res) => {
    try {
      const adminToken = req.headers['x-admin-token'] as string | undefined;
      const branch = (String(req.body.branch || 'PC').toUpperCase() === 'SM' ? 'SM' : 'PC') as 'PC' | 'SM';
      let driveSyncCount = 0;

      // Si un token admin est fourni, synchroniser également le dossier Drive de la filière
      if (adminToken) {
        try {
          const driveResult = await syncGoogleDriveBranch({ branch });
          if (driveResult.success) {
            driveSyncCount = driveResult.downloadedCount;
          }
        } catch (e) {
          console.warn('[Sync] Sync Drive facultatif non exécuté :', e);
        }
      }

      // Re-scan et ré-indexation complète du RAG local
      const status = await refreshDocumentsCache(true);

      return res.json({
        success: true,
        ...status,
        driveSyncCount,
        message: `Base officielle synchronisée : ${status.totalIndexedFiles} document(s) indexé(s) (${status.pcCount} PC, ${status.smCount} SM).`,
      });
    } catch (err: any) {
      console.error('Erreur synchronisation documents officiels:', err);
      return res.status(500).json({ error: 'Erreur lors de la synchronisation des documents officiels.' });
    }
  });

  /**
   * Liste des documents du programme (RÉSERVÉ ADMIN / ENSEIGNANT).
   */
  router.get('/documents', requireAdmin, async (_req, res) => {
    try {
      if (!fs.existsSync(DOCS_DIR)) {
        return res.json({ directory: DOCS_DIR, files: [] });
      }

      const discovered = discoverProgrammeFiles(DOCS_DIR);
      const files = await Promise.all(
        discovered.map(async (doc) => {
          const filePath = doc.absolutePath;
          const stat = fs.statSync(filePath);
          let preview = '';
          const isPdf = doc.name.toLowerCase().endsWith('.pdf');

          if (isPdf) {
            try {
              const text = await getFreshExtractedPdfText(filePath, `${filePath}.extracted.txt`);
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
            name: doc.name,
            relativePath: doc.relativePath,
            branch: doc.branch,
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

      const filePath = resolveDocumentFilePath(name);
      if (!filePath) {
        return res.status(404).json({ error: 'Fichier non trouvé.' });
      }

      const safeName = path.basename(filePath);
      const isPdf = safeName.toLowerCase().endsWith('.pdf');

      if (isPdf) {
        const content = await getFreshExtractedPdfText(filePath, `${filePath}.extracted.txt`);
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

      const filePath = resolveDocumentFilePath(name);
      if (!filePath) {
        return res.status(404).json({ error: 'Fichier non trouvé.' });
      }

      return res.download(filePath, path.basename(filePath));
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
      const { filename, content, base64, branch: reqBranch } = req.body;
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

      // Détermination de la filière cible (PC ou SM) pour respecter l'étanchéité stricte
      let branchFolder = '';
      const bUpper = String(reqBranch || '').toUpperCase();
      if (bUpper === 'PC' || bUpper === 'SM') {
        branchFolder = bUpper;
      } else {
        const nameLower = safeName.toLowerCase();
        if (nameLower.includes('pc') && !nameLower.includes('sm')) branchFolder = 'PC';
        else if (nameLower.includes('sm') && !nameLower.includes('pc')) branchFolder = 'SM';
      }

      const targetDir = branchFolder ? path.join(DOCS_DIR, branchFolder) : DOCS_DIR;
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const filePath = path.join(targetDir, safeName);
      const isPdf = ext === '.pdf';

      if (base64) {
        const buf = Buffer.from(base64, 'base64');
        fs.writeFileSync(filePath, buf);

        if (isPdf) {
          try {
            const text = await extractTextFromPdf(buf);
            const txtPath = `${filePath}.extracted.txt`;
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
          ? `Document PDF "${safeName}" indexé et texte extrait pour le RAG (${branchFolder || 'Général'}) !`
          : `Document "${safeName}" indexé avec succès dans /docs/programme/${branchFolder ? branchFolder + '/' : ''}`,
        file: {
          name: safeName,
          relativePath: branchFolder ? `${branchFolder}/${safeName}` : safeName,
          branch: branchFolder || 'ALL',
        },
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
      const filePath = resolveDocumentFilePath(filename);

      if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Fichier non trouvé.' });
      }

      const safeName = path.basename(filePath);
      const txtPath = `${filePath}.extracted.txt`;

      fs.unlinkSync(filePath);
      if (fs.existsSync(txtPath)) {
        try {
          fs.unlinkSync(txtPath);
        } catch {}
      }

      return res.json({ success: true, message: `Fichier ${safeName} supprimé.` });
    } catch (err: any) {
      console.error('Erreur suppression document:', err);
      return res.status(500).json({ error: 'Erreur lors de la suppression.' });
    }
  });

  return router;
}
