import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { DOCS_DIR, ADMIN_TOKEN, GOOGLE_DRIVE_FOLDER_PC, GOOGLE_DRIVE_FOLDER_SM } from '../config';
import { requireAdmin, documentMutationLimiter, safeTokenEqual } from '../security';
import {
  extractTextFromPdf,
  getFreshExtractedPdfText,
  getLocalRagStatus,
  discoverProgrammeFiles,
  refreshDocumentsCache,
  hasVisualMarker,
  startBackgroundOfficialSync,
  getOfficialSyncStatus,
} from '../rag';
import { isLikelyGeminiKey } from '../visionExtractor';
import { syncGoogleDriveBranch, extractDriveFolderId } from '../driveSync';

function resolveServerVisionKey(isAdminAuthorized: boolean): string {
  if (!isAdminAuthorized) return '';
  return (
    process.env.GEMINI_API_KEY ||
    (isLikelyGeminiKey(process.env.AI_API_KEY) ? process.env.AI_API_KEY : '') ||
    ''
  );
}

function readHeadPreview(filePath: string, maxChars = 150): string {
  let fd: number | null = null;
  try {
    fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(512);
    const bytesRead = fs.readSync(fd, buf, 0, buf.length, 0);
    return buf.toString('utf-8', 0, bytesRead).slice(0, maxChars).replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch {}
    }
  }
}

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
 * 3. Les élèves ne peuvent consulter que la liste métadonnées en lecture seule (/documents/official) ; le téléchargement et la lecture brute restent réservés à l'admin.
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

        const isPdf = doc.name.toLowerCase().endsWith('.pdf');
        const hasVisuals = isPdf ? hasVisualMarker(doc.absolutePath) : false;

        return {
          name: doc.name,
          relativePath: doc.relativePath,
          branch: doc.branch,
          size,
          isPdf,
          hasVisuals,
        };
      });

      return res.json({ files });
    } catch (err: any) {
      console.error('Erreur get official documents:', err);
      return res.status(500).json({ error: 'Impossible de lister les documents officiels.' });
    }
  });

  /**
   * Lecture publique en ligne (inline) d'un PDF officiel listé dans /documents/official
   * pour permettre l'affichage direct des pages d'exercices dans le chat.
   */
  router.get('/documents/official/pdf', (req, res) => {
    try {
      const name = String(req.query.name || '').trim();
      if (!name || !name.toLowerCase().endsWith('.pdf')) {
        return res.status(400).json({ error: 'Nom de document PDF officiel requis.' });
      }

      const baseName = path.basename(name);
      const allDocs = discoverProgrammeFiles(DOCS_DIR);
      const matched = allDocs.find(
        (doc) =>
          doc.name.toLowerCase().endsWith('.pdf') &&
          (doc.relativePath === name || doc.name === name || doc.name === baseName)
      );

      if (!matched || !fs.existsSync(matched.absolutePath)) {
        return res.status(404).json({ error: 'Document PDF officiel introuvable.' });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(path.basename(matched.name))}"`);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.sendFile(matched.absolutePath);
    } catch (err: any) {
      console.error('Erreur lecture PDF officiel:', err);
      return res.status(500).json({ error: 'Impossible de servir le document PDF officiel.' });
    }
  });

  /**
   * Synchronisation des documents officiels téléchargés et ré-indexation du RAG local.
   * Lance l'extraction et le décodage visuel en tâche de fond cadencée pour éviter les timeouts 502/503
   * et les dépassements de quota API (429).
   */
  router.post('/documents/sync', documentMutationLimiter, async (req, res) => {
    try {
      const adminToken = String(req.headers['x-admin-token'] || '').trim();
      const clientProvider = String(req.headers['x-ai-provider'] || req.body?.provider || '').toLowerCase();
      const clientApiKey = String(
        (req.headers['x-ai-key'] as string) ||
          (req.headers['x-gemini-api-key'] as string) ||
          (req.headers['x-ai-api-key'] as string) ||
          req.body?.apiKey ||
          ''
      ).trim();

      // N'utiliser la clé client pour Gemini Vision que si elle est compatible Gemini
      const validClientVisionKey =
        clientApiKey &&
        (!clientProvider || clientProvider === 'gemini') &&
        isLikelyGeminiKey(clientApiKey)
          ? clientApiKey
          : '';

      const isAdminAuthorized = ADMIN_TOKEN
        ? safeTokenEqual(adminToken, ADMIN_TOKEN)
        : process.env.NODE_ENV !== 'production';

      // En production avec ADMIN_TOKEN défini (ou sans ADMIN_TOKEN configuré), seuls les admins
      // authentifiés utilisent la clé GEMINI_API_KEY serveur ou lancent la synchro Drive ; les
      // autres appels peuvent indexer localement ou utiliser leur propre clé Gemini fournie par le client.
      const serverEnvGeminiKey = resolveServerVisionKey(isAdminAuthorized);

      const visionApiKey = validClientVisionKey || serverEnvGeminiKey;
      const branch = (String(req.body?.branch || 'PC').toUpperCase() === 'SM' ? 'SM' : 'PC') as 'PC' | 'SM';

      const isAuthorizedForDriveSync = Boolean(
        isAdminAuthorized && (!ADMIN_TOKEN ? (process.env.NODE_ENV !== 'production' && adminToken) : true)
      );
      const runDriveSync = isAuthorizedForDriveSync
        ? async () => {
            const driveResult = await syncGoogleDriveBranch({ branch });
            return driveResult.success ? driveResult.downloadedCount : 0;
          }
        : undefined;

      const { started, alreadyRunning, syncJob } = startBackgroundOfficialSync({
        branch,
        visionApiKey,
        runDriveSync,
      });

      const status = getLocalRagStatus();

      return res.status(202).json({
        success: true,
        started,
        alreadyRunning,
        syncJob,
        ...status,
        driveSyncCount: syncJob.driveSyncCount,
        hasVisionKey: Boolean(visionApiKey),
        message: syncJob.message,
      });
    } catch (err: any) {
      console.error('Erreur synchronisation documents officiels:', err);
      return res.status(500).json({ error: 'Erreur lors de la synchronisation des documents officiels.' });
    }
  });

  /**
   * Statut en temps réel de la tâche de synchronisation et de décodage visuel en arrière-plan.
   */
  router.get('/documents/sync/status', (_req, res) => {
    return res.json({
      syncJob: getOfficialSyncStatus(),
      ...getLocalRagStatus(),
    });
  });

  /**
   * Liste des documents du programme (RÉSERVÉ ADMIN / ENSEIGNANT).
   * Lecture légère sans extraction PDF synchrone pour éviter les timeouts 502/503.
   */
  router.get('/documents', requireAdmin, (_req, res) => {
    try {
      if (!fs.existsSync(DOCS_DIR)) {
        return res.json({ directory: DOCS_DIR, files: [] });
      }

      const discovered = discoverProgrammeFiles(DOCS_DIR);
      const files = discovered.map((doc) => {
        const filePath = doc.absolutePath;
        const stat = fs.statSync(filePath);
        const isPdf = doc.name.toLowerCase().endsWith('.pdf');
        const sidecarPath = `${filePath}.extracted.txt`;

        let preview = '';
        if (isPdf) {
          preview = fs.existsSync(sidecarPath)
            ? readHeadPreview(sidecarPath) || 'Document PDF indexé'
            : 'Document PDF prêt à être indexé';
        } else {
          preview = readHeadPreview(filePath) || 'Document texte';
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
      });

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
   * Synchronisation depuis Google Drive en tâche de fond (RÉSERVÉ ADMIN / ENSEIGNANT).
   * Retourne HTTP 202 immédiatement pour prévenir tout timeout 502/503 proxy.
   */
  router.post('/documents/sync-drive', requireAdmin, documentMutationLimiter, (req, res) => {
    try {
      const branch = (String(req.body.branch || 'PC').toUpperCase() === 'SM' ? 'SM' : 'PC') as 'PC' | 'SM';
      const folderInput = String(req.body.folderId || req.body.folderUrl || '');
      const apiKey = String(req.body.apiKey || '').trim();

      const fallbackFolder = branch === 'SM' ? GOOGLE_DRIVE_FOLDER_SM : GOOGLE_DRIVE_FOLDER_PC;
      if (!extractDriveFolderId(folderInput || fallbackFolder || '')) {
        return res.status(400).json({
          error: `Aucun identifiant ou lien de dossier Google Drive configuré pour 2BAC ${branch}.`,
        });
      }

      const visionApiKey = resolveServerVisionKey(true);

      const { started, alreadyRunning, syncJob } = startBackgroundOfficialSync({
        branch,
        visionApiKey,
        runDriveSync: async () => {
          const driveResult = await syncGoogleDriveBranch({
            branch,
            folderIdOrUrl: folderInput,
            apiKey: apiKey || undefined,
          });
          return driveResult.success ? driveResult.downloadedCount : 0;
        },
      });

      return res.status(202).json({
        success: true,
        started,
        alreadyRunning,
        syncJob,
        downloadedCount: syncJob.driveSyncCount,
        downloadedFiles: [],
        ...getLocalRagStatus(),
        message: syncJob.message,
      });
    } catch (err: any) {
      console.error('Erreur synchronisation Drive:', err);
      const msg = String(err?.message || 'Erreur inconnue');
      return res.status(500).json({ error: `Erreur synchronisation Drive : ${msg}` });
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

      await refreshDocumentsCache(true);

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
   * Accepte les chemins avec sous-dossier (ex: PC/mon_doc.pdf), encodés ou décodés par un proxy.
   */
  router.delete('/documents/*', requireAdmin, documentMutationLimiter, async (req, res) => {
    try {
      const rawParam = String((req.params as Record<string, string>)[0] || '');
      let decodedName = rawParam;
      try {
        decodedName = decodeURIComponent(rawParam);
      } catch {}
      const filePath = resolveDocumentFilePath(decodedName);

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

      await refreshDocumentsCache(true);

      return res.json({ success: true, message: `Fichier ${safeName} supprimé.` });
    } catch (err: any) {
      console.error('Erreur suppression document:', err);
      return res.status(500).json({ error: 'Erreur lors de la suppression.' });
    }
  });

  return router;
}
