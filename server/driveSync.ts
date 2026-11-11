import fs from 'fs';
import path from 'path';
import { DOCS_DIR, GOOGLE_DRIVE_FOLDER_PC, GOOGLE_DRIVE_FOLDER_SM, DRIVE_SYNC_INTERVAL_HOURS, GOOGLE_DRIVE_APPS_SCRIPT_URL } from './config';
import { extractTextFromPdf, discoverProgrammeFiles } from './rag';

// État de planification de l'auto-synchronisation (2 fois par jour = toutes les 12 heures)
let lastSyncTimestamp: number | null = null;
let nextSyncTimestamp: number | null = null;
let isSyncInProgress = false;
let syncScheduleTimer: NodeJS.Timeout | null = null;

export interface DriveSyncResult {
  success: boolean;
  branch: 'PC' | 'SM';
  folderId: string;
  filesFound: number;
  downloadedCount: number;
  downloadedFiles: string[];
  message: string;
  error?: string;
}

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
}

/**
 * Extrait l'identifiant propre d'un dossier ou fichier Google Drive depuis une URL ou un ID brut.
 */
export function extractDriveFolderId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];
  const fileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch) return idParamMatch[1];
  return trimmed;
}

/**
 * Récupère la clé API Google Drive depuis l'environnement ou les clés IA partagées.
 */
function resolveDriveApiKey(customKey?: string): string {
  return (
    customKey ||
    process.env.GOOGLE_DRIVE_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.AI_API_KEY ||
    ''
  ).trim();
}

const DRIVE_FETCH_TIMEOUT_MS = 25_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  maxAttempts: number = 3
): Promise<Response> {
  let lastError: any = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(DRIVE_FETCH_TIMEOUT_MS),
      });
      if (res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504) {
        if (attempt < maxAttempts) {
          const retryAfterHdr = Number(res.headers.get('retry-after') || 0);
          const delayMs = retryAfterHdr > 0
            ? Math.min(20_000, retryAfterHdr * 1000)
            : 1500 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 500);
          console.warn(`[DriveSync] HTTP ${res.status}, réessai dans ${delayMs}ms (${attempt}/${maxAttempts})`);
          await sleep(delayMs);
          continue;
        }
      }
      return res;
    } catch (err: any) {
      lastError = err;
      if (attempt < maxAttempts) {
        const delayMs = 1500 * Math.pow(2, attempt - 1);
        await sleep(delayMs);
      }
    }
  }
  throw lastError || new Error('Délai dépassé lors de la connexion Google Drive.');
}

/**
 * Récupère la liste des fichiers d'un dossier Google Drive public.
 * Tente d'abord l'URL Apps Script si configurée, puis l'API Google Drive v3 avec clé.
 */
async function listPublicDriveFolderFiles(
  folderId: string,
  apiKey: string
): Promise<DriveFileItem[]> {
  const files: DriveFileItem[] = [];

  // 1. Essai via Google Apps Script Web App (si configuré, 100% gratuit et sans clé API requise)
  if (GOOGLE_DRIVE_APPS_SCRIPT_URL) {
    try {
      const sep = GOOGLE_DRIVE_APPS_SCRIPT_URL.includes('?') ? '&' : '?';
      const scriptUrl = `${GOOGLE_DRIVE_APPS_SCRIPT_URL}${sep}id=${encodeURIComponent(folderId)}`;
      const res = await fetchWithRetry(scriptUrl);
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : data.files || [];
        for (const item of items) {
          if (item && item.id && item.name) {
            files.push({
              id: item.id,
              name: item.name,
              mimeType: item.mimeType || 'application/pdf',
              size: item.size ? Number(item.size) : undefined,
            });
          }
        }
        if (files.length > 0) {
          console.log(`[DriveSync] ${files.length} fichier(s) récupéré(s) via Google Apps Script pour ${folderId}.`);
          return files;
        }
      }
    } catch (scriptErr: any) {
      console.warn('[DriveSync] Erreur appel Google Apps Script:', scriptErr?.message || scriptErr);
    }
  }

  // 2. Essai via l'API officielle Google Drive v3
  if (apiKey) {
    try {
      const listUrl = `https://www.googleapis.com/drive/v3/files?q='${encodeURIComponent(
        folderId
      )}'+in+parents+and+trashed=false&key=${encodeURIComponent(
        apiKey
      )}&fields=files(id,name,mimeType,size)&pageSize=100`;

      const res = await fetchWithRetry(listUrl);
      if (res.ok) {
        const data = await res.json();
        const items = (data.files || []).filter(
          (f: any) =>
            f.mimeType === 'application/pdf' ||
            f.name.toLowerCase().endsWith('.pdf') ||
            f.name.toLowerCase().endsWith('.md') ||
            f.name.toLowerCase().endsWith('.txt')
        );
        for (const item of items) {
          files.push({
            id: item.id,
            name: item.name,
            mimeType: item.mimeType || 'application/pdf',
            size: item.size ? Number(item.size) : undefined,
          });
        }
        if (files.length > 0) return files;
      } else {
        const errTxt = await res.text();
        console.warn(`[DriveSync] Réponse API Drive (${res.status}):`, errTxt.slice(0, 150));
      }
    } catch (err: any) {
      console.warn('[DriveSync] Erreur appel API Google Drive:', err?.message || err);
    }
  } else {
    console.log('[DriveSync] ℹ️ Note : Pour lister les fichiers d\'un dossier Google Drive, ajoutez GOOGLE_DRIVE_API_KEY=... ou GOOGLE_DRIVE_APPS_SCRIPT_URL=... dans votre fichier .env.');
  }

  return files;
}

/**
 * Télécharge un fichier depuis Google Drive en utilisant l'API avec clé ou le lien direct uc?export=download.
 */
async function downloadDriveFile(fileId: string, apiKey: string, expectPdf: boolean): Promise<Buffer> {
  const downloadUrls: string[] = [];
  if (apiKey) {
    downloadUrls.push(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&key=${encodeURIComponent(apiKey)}`
    );
  }
  downloadUrls.push(`https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`);
  downloadUrls.push(`https://docs.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`);

  for (const url of downloadUrls) {
    try {
      const res = await fetchWithRetry(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (res.ok) {
        const contentType = (res.headers.get('content-type') || '').toLowerCase();
        if (expectPdf && contentType.includes('text/html')) {
          continue; // Page HTML de confirmation/erreur Google Drive
        }
        const arrayBuffer = await res.arrayBuffer();
        if (arrayBuffer.byteLength > 100) {
          const buf = Buffer.from(arrayBuffer);
          if (expectPdf && buf.subarray(0, 5).toString() !== '%PDF-') {
            continue;
          }
          return buf;
        }
      }
    } catch {}
  }

  throw new Error(`Impossible de télécharger le fichier Google Drive (ID: ${fileId})`);
}

/**
 * Synchronise un dossier Google Drive pour une filière donnée (PC ou SM).
 * Télécharge uniquement les documents nouveaux/modifiés et extrait le texte pour le RAG.
 */
export async function syncGoogleDriveBranch(params: {
  branch: 'PC' | 'SM';
  folderIdOrUrl?: string;
  apiKey?: string;
  force?: boolean;
}): Promise<DriveSyncResult> {
  const branch = params.branch.toUpperCase() as 'PC' | 'SM';
  const envFolder = branch === 'SM' ? GOOGLE_DRIVE_FOLDER_SM : GOOGLE_DRIVE_FOLDER_PC;
  const rawFolderInput = params.folderIdOrUrl || envFolder || '';
  const cleanFolderId = extractDriveFolderId(rawFolderInput);

  if (!cleanFolderId) {
    return {
      success: false,
      branch,
      folderId: '',
      filesFound: 0,
      downloadedCount: 0,
      downloadedFiles: [],
      message: `Aucun identifiant ou lien de dossier Google Drive configuré pour 2BAC ${branch}.`,
    };
  }

  const apiKey = resolveDriveApiKey(params.apiKey);

  const branchDir = path.join(DOCS_DIR, branch);
  if (!fs.existsSync(branchDir)) {
    fs.mkdirSync(branchDir, { recursive: true });
  }

  console.log(`[DriveSync] Début de la synchronisation 2BAC ${branch} (Dossier ID: ${cleanFolderId})...`);

  const files = await listPublicDriveFolderFiles(cleanFolderId, apiKey);

  if (files.length === 0) {
    return {
      success: true,
      branch,
      folderId: cleanFolderId,
      filesFound: 0,
      downloadedCount: 0,
      downloadedFiles: [],
      message: `Dossier Google Drive 2BAC ${branch} accessible mais aucun document PDF/MD n'a été trouvé.`,
    };
  }

  const downloadedFiles: string[] = [];
  let skippedExisting = 0;

  for (const file of files) {
    try {
      let cleanName = path.basename(file.name).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
      if (
        !cleanName.toLowerCase().endsWith('.pdf') &&
        !cleanName.toLowerCase().endsWith('.md') &&
        !cleanName.toLowerCase().endsWith('.txt')
      ) {
        cleanName += '.pdf';
      }

      // Préfixe strict par filière pour garantir l'étanchéité du RAG
      const nameLower = cleanName.toLowerCase();
      let targetName = cleanName;
      if (branch === 'PC' && !nameLower.includes('pc') && !nameLower.includes('sm')) {
        targetName = `PC_${cleanName}`;
      } else if (branch === 'SM' && !nameLower.includes('sm') && !nameLower.includes('pc')) {
        targetName = `SM_${cleanName}`;
      }

      const targetPath = path.join(branchDir, targetName);
      const isPdf = targetName.toLowerCase().endsWith('.pdf');

      // Éviter de re-télécharger inutilement (prévient les 429 Google Drive et 502 timeout)
      if (!params.force && fs.existsSync(targetPath)) {
        const localStat = fs.statSync(targetPath);
        const sameSize = file.size ? localStat.size === file.size : localStat.size > 512;
        if (sameSize) {
          skippedExisting++;
          if (isPdf && !fs.existsSync(`${targetPath}.extracted.txt`)) {
            try {
              const extractedText = await extractTextFromPdf(fs.readFileSync(targetPath));
              if (extractedText && extractedText.trim().length > 20) {
                fs.writeFileSync(`${targetPath}.extracted.txt`, extractedText, 'utf-8');
              }
            } catch {}
          }
          continue;
        }
      }

      const fileBuffer = await downloadDriveFile(file.id, apiKey, isPdf);
      fs.writeFileSync(targetPath, fileBuffer);

      // Extraction immédiate du texte pour le RAG
      if (isPdf) {
        try {
          const extractedText = await extractTextFromPdf(fileBuffer);
          if (extractedText && extractedText.trim().length > 20) {
            fs.writeFileSync(path.join(branchDir, `${targetName}.extracted.txt`), extractedText, 'utf-8');
          }
        } catch (extractErr) {
          console.warn(`[DriveSync] Avertissement extraction PDF (${targetName}):`, extractErr);
        }
      }

      downloadedFiles.push(targetName);
      console.log(`[DriveSync] Fichier indexé avec succès dans le RAG (${branch}): ${targetName}`);

      // Pause douce entre téléchargements pour éviter le rate-limit Drive
      await sleep(450);
    } catch (err: any) {
      console.warn(`[DriveSync] Échec du téléchargement pour ${file.name}:`, err?.message || err);
    }
  }

  return {
    success: true,
    branch,
    folderId: cleanFolderId,
    filesFound: files.length,
    downloadedCount: downloadedFiles.length,
    downloadedFiles,
    message:
      downloadedFiles.length > 0
        ? `✅ ${downloadedFiles.length} nouveau(x) document(s) téléchargé(s) (${skippedExisting} déjà à jour) pour 2BAC ${branch} !`
        : skippedExisting > 0
        ? `✅ Tous les documents (${skippedExisting}) de 2BAC ${branch} sont déjà à jour.`
        : `⚠️ Aucun document n'a pu être téléchargé depuis le dossier 2BAC ${branch}.`,
  };
}

/**
 * Synchronise l'ensemble des dossiers configurés (PC et SM) pour enrichir le RAG.
 */
export async function syncAllDriveFolders(): Promise<{
  pc: DriveSyncResult;
  sm: DriveSyncResult;
  totalDownloaded: number;
}> {
  if (isSyncInProgress) {
    console.log('[DriveSync] Une synchronisation est déjà en cours, requête ignorée.');
    return {
      pc: { success: false, branch: 'PC', folderId: '', filesFound: 0, downloadedCount: 0, downloadedFiles: [], message: 'Synchronisation en cours...' },
      sm: { success: false, branch: 'SM', folderId: '', filesFound: 0, downloadedCount: 0, downloadedFiles: [], message: 'Synchronisation en cours...' },
      totalDownloaded: 0,
    };
  }

  isSyncInProgress = true;
  try {
    const pc = await syncGoogleDriveBranch({ branch: 'PC' });
    const sm = await syncGoogleDriveBranch({ branch: 'SM' });

    lastSyncTimestamp = Date.now();
    const intervalMs = DRIVE_SYNC_INTERVAL_HOURS * 3600 * 1000;
    nextSyncTimestamp = lastSyncTimestamp + intervalMs;

    return {
      pc,
      sm,
      totalDownloaded: pc.downloadedCount + sm.downloadedCount,
    };
  } finally {
    isSyncInProgress = false;
  }
}

/**
 * Lance le planificateur d'auto-synchronisation Drive.
 * Par défaut : 2 fois par jour (toutes les 12 heures).
 */
export function startDriveAutoSyncSchedule(intervalHours: number = DRIVE_SYNC_INTERVAL_HOURS) {
  if (syncScheduleTimer) {
    clearInterval(syncScheduleTimer);
    syncScheduleTimer = null;
  }

  const intervalMs = Math.max(1, intervalHours) * 3600 * 1000;
  console.log(`[DriveAutoSync] ⏰ Auto-synchronisation configurée : 2 fois par jour (toutes les ${intervalHours}h).`);

  // 1. Synchronisation initiale au démarrage (après un court délai de 5s)
  setTimeout(async () => {
    if (GOOGLE_DRIVE_FOLDER_PC || GOOGLE_DRIVE_FOLDER_SM) {
      console.log('[DriveAutoSync] 🚀 Exécution de la première synchronisation de la journée...');
      try {
        const res = await syncAllDriveFolders();
        if (res.totalDownloaded > 0) {
          console.log(`[DriveAutoSync] ✅ Synchronisation initiale réussie : ${res.totalDownloaded} fichier(s) indexé(s) dans le RAG.`);
        }
      } catch (err: any) {
        console.warn('[DriveAutoSync] Avertissement synchronisation initiale:', err?.message || err);
      }
    } else {
      console.log('[DriveAutoSync] Aucun dossier Drive configuré dans .env. Auto-synchronisation en attente de configuration.');
    }
    nextSyncTimestamp = Date.now() + intervalMs;
    console.log(`[DriveAutoSync] 📅 Prochaine synchronisation programmée à : ${new Date(nextSyncTimestamp).toLocaleTimeString('fr-FR')} (dans ${intervalHours}h).`);
  }, 5000);

  // 2. Intervalle récurrent (toutes les 12h = 2 fois par jour)
  syncScheduleTimer = setInterval(async () => {
    if (!GOOGLE_DRIVE_FOLDER_PC && !GOOGLE_DRIVE_FOLDER_SM) return;

    console.log(`[DriveAutoSync] 🔄 Lancement de la synchronisation biquotidienne (${new Date().toLocaleTimeString('fr-FR')})...`);
    try {
      const res = await syncAllDriveFolders();
      console.log(`[DriveAutoSync] ✅ Synchronisation biquotidienne terminée : ${res.totalDownloaded} fichier(s) RAG.`);
    } catch (err: any) {
      console.warn('[DriveAutoSync] Échec de la synchronisation biquotidienne:', err?.message || err);
    }
  }, intervalMs);

  // Ne bloque pas l'arrêt du processus Node.js si besoin
  syncScheduleTimer.unref?.();
}

/**
 * Arrête le planificateur d'auto-synchronisation.
 */
export function stopDriveAutoSyncSchedule() {
  if (syncScheduleTimer) {
    clearInterval(syncScheduleTimer);
    syncScheduleTimer = null;
  }
}

/**
 * Résumé de l'état du RAG officiel (sans exposer de noms de fichiers ni d'URL aux élèves).
 */
export function getOfficialRagSummary(): {
  active: boolean;
  pcIndexed: boolean;
  smIndexed: boolean;
  totalIndexedFiles: number;
  syncSchedule: string;
  intervalHours: number;
  lastSyncIso: string | null;
  nextSyncIso: string | null;
  message: string;
} {
  const lastSyncIso = lastSyncTimestamp ? new Date(lastSyncTimestamp).toISOString() : null;
  const nextSyncIso = nextSyncTimestamp ? new Date(nextSyncTimestamp).toISOString() : null;

  if (!fs.existsSync(DOCS_DIR)) {
    return {
      active: true,
      pcIndexed: false,
      smIndexed: false,
      totalIndexedFiles: 0,
      syncSchedule: 'twice_daily',
      intervalHours: DRIVE_SYNC_INTERVAL_HOURS,
      lastSyncIso,
      nextSyncIso,
      message: 'Base de connaissances Si Driss prête pour enrichissement.',
    };
  }

  const discovered = discoverProgrammeFiles(DOCS_DIR);
  const pcFiles = discovered.filter((f) => f.branch === 'PC');
  const smFiles = discovered.filter((f) => f.branch === 'SM');

  const totalIndexedFiles = discovered.length;
  const pcIndexed = pcFiles.length > 0;
  const smIndexed = smFiles.length > 0;

  return {
    active: true,
    pcIndexed,
    smIndexed,
    totalIndexedFiles,
    syncSchedule: 'twice_daily',
    intervalHours: DRIVE_SYNC_INTERVAL_HOURS,
    lastSyncIso,
    nextSyncIso,
    message:
      totalIndexedFiles > 0
        ? `Base de connaissances officielle Si Driss active et enrichie (${pcFiles.length} docs PC, ${smFiles.length} docs SM).`
        : 'Base de connaissances prête.',
  };
}

