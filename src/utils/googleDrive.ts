/**
 * Google Drive Public Integration (Option 2 — Lecture Seule Universelle)
 *
 * Ce module gère l'accès aux documents officiels hébergés sur un dossier Google Drive
 * public (partagé en mode « Tous les utilisateurs disposant du lien : Lecteur »).
 *
 * AVANTAGES :
 * 1. Aucun compte Google ni popup Firebase requis pour les élèves (100% universel).
 * 2. Aucune erreur d'autorisation de domaine (auth/unauthorized-domain).
 * 3. Les documents sont synchronisés vers le serveur (/docs/programme/) et indexés
 *    directement par le RAG de Si Driss.
 */

export interface DriveDoc {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  modifiedTime?: string;
  webViewLink?: string;
  downloadUrl?: string;
  branch: 'PC' | 'SM';
  preview?: string;
}

export const FOLDER_NAMES: Record<'PC' | 'SM', string> = {
  PC: 'Si Driss — Documents Officiels PC',
  SM: 'Si Driss — Documents Officiels SM',
};

const STORAGE_KEY_PC = 'sidriss_public_drive_folder_pc';
const STORAGE_KEY_SM = 'sidriss_public_drive_folder_sm';

/**
 * Extrait l'identifiant propre d'un dossier ou fichier Google Drive
 * depuis une URL complète (ex: https://drive.google.com/drive/folders/1ABC...) ou un ID brut.
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
 * Lien d'affichage web officiel dans Google Drive
 */
export function getDriveViewUrl(fileOrFolderId: string): string {
  const id = extractDriveFolderId(fileOrFolderId);
  return id ? `https://drive.google.com/file/d/${id}/view` : '';
}

/**
 * Lien d'accès direct au dossier public dans Google Drive
 */
export function getDriveFolderUrl(folderIdOrUrl: string): string {
  const id = extractDriveFolderId(folderIdOrUrl);
  return id ? `https://drive.google.com/drive/folders/${id}` : '';
}

/**
 * Lien direct de téléchargement d'un fichier Google Drive public (sans passerelle)
 */
export function getDriveDownloadUrl(fileId: string): string {
  const id = extractDriveFolderId(fileId);
  return id ? `https://drive.google.com/uc?export=download&id=${id}` : '';
}

/**
 * Récupère le lien ou l'ID du dossier public stocké localement pour la filière
 */
export function getStoredDriveFolder(branch: 'PC' | 'SM'): string {
  try {
    const key = branch === 'SM' ? STORAGE_KEY_SM : STORAGE_KEY_PC;
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

/**
 * Enregistre le lien ou l'ID du dossier public pour la filière
 */
export function setStoredDriveFolder(branch: 'PC' | 'SM', folderIdOrUrl: string): void {
  try {
    const key = branch === 'SM' ? STORAGE_KEY_SM : STORAGE_KEY_PC;
    if (folderIdOrUrl) {
      localStorage.setItem(key, folderIdOrUrl.trim());
    } else {
      localStorage.removeItem(key);
    }
  } catch {}
}

/**
 * Récupère le statut public du RAG (accessible aux élèves sans divulguer de liens ou fichiers)
 */
export async function fetchRagStatus(): Promise<{
  active: boolean;
  pcIndexed: boolean;
  smIndexed: boolean;
  totalIndexedFiles: number;
  syncSchedule?: string;
  intervalHours?: number;
  lastSyncIso?: string | null;
  nextSyncIso?: string | null;
  message: string;
}> {
  try {
    const res = await fetch('/api/rag/status');
    if (res.ok) {
      return await res.json();
    }
  } catch {}
  return {
    active: true,
    pcIndexed: false,
    smIndexed: false,
    totalIndexedFiles: 0,
    message: 'Base de connaissances Si Driss prête.',
  };
}

/**
 * Récupère la configuration des dossiers Google Drive (PC & SM) définie côté serveur (Admin uniquement)
 */
export async function fetchServerDriveConfig(adminToken?: string): Promise<{ folderPc: string; folderSm: string }> {
  try {
    const headers: Record<string, string> = {};
    if (adminToken) headers['x-admin-token'] = adminToken;
    const res = await fetch('/api/documents/drive-config', { headers });
    if (res.ok) {
      return await res.json();
    }
  } catch {}
  return { folderPc: '', folderSm: '' };
}

/**
 * Récupère le dossier Drive effectif pour une filière (local ou fallback serveur)
 */
export function getEffectiveDriveFolder(branch: 'PC' | 'SM', serverConfig?: { folderPc: string; folderSm: string }): string {
  const stored = getStoredDriveFolder(branch);
  if (stored) return stored;
  if (serverConfig) {
    return branch === 'SM' ? serverConfig.folderSm : serverConfig.folderPc;
  }
  return '';
}

/**
 * Déclenche la synchronisation du dossier Google Drive public avec le serveur
 * pour télécharger les PDFs officiels et les intégrer dans l'index RAG de Si Driss.
 */
export async function syncDriveFolderWithServer(
  folderIdOrUrl: string,
  branch: 'PC' | 'SM',
  adminToken?: string
): Promise<{ success: boolean; count: number; message: string; files?: string[] }> {
  const cleanId = extractDriveFolderId(folderIdOrUrl);
  if (!cleanId) {
    throw new Error('Veuillez fournir un lien ou un identifiant de dossier Google Drive valide.');
  }

  // Mémorise le dossier pour de futures synchronisations
  setStoredDriveFolder(branch, folderIdOrUrl);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (adminToken) {
    headers['x-admin-token'] = adminToken;
  }

  const res = await fetch('/api/documents/sync-drive', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      folderId: cleanId,
      branch,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Erreur de synchronisation (${res.status})`);
  }

  const data = await res.json();
  return {
    success: Boolean(data.success),
    count: Number(data.downloadedCount || 0),
    message: data.message || 'Synchronisation terminée avec succès.',
    files: data.downloadedFiles || [],
  };
}

/**
 * Récupère la liste des documents officiels accessibles (Admin uniquement).
 */
export async function listOfficialDriveDocuments(branch?: 'PC' | 'SM', adminToken?: string): Promise<DriveDoc[]> {
  try {
    const headers: Record<string, string> = {};
    if (adminToken) headers['x-admin-token'] = adminToken;
    const res = await fetch('/api/documents', { headers });
    if (!res.ok) return [];

    const data = await res.json();
    const files = data.files || [];

    const branchUpper = (branch || 'PC').toUpperCase();

    return files
      .filter((f: any) => {
        if (f.branch && f.branch !== 'ALL') {
          return f.branch === branchUpper;
        }
        const nameLower = (f.name || '').toLowerCase();
        const isSm = nameLower.includes('_sm') || nameLower.includes('-sm') || nameLower.includes('sm.');
        const isPc = nameLower.includes('_pc') || nameLower.includes('-pc') || nameLower.includes('pc.');
        if (branchUpper === 'PC' && isSm && !isPc) return false;
        if (branchUpper === 'SM' && isPc && !isSm) return false;
        return true;
      })
      .map((f: any) => ({
        id: f.relativePath || f.name,
        name: f.name,
        mimeType: f.isPdf ? 'application/pdf' : 'text/plain',
        size: f.size,
        modifiedTime: f.modified,
        branch: (f.branch === 'SM' ? 'SM' : 'PC') as 'PC' | 'SM',
        preview: f.preview,
        downloadUrl: `/api/documents/download?name=${encodeURIComponent(f.relativePath || f.name)}`,
      }));
  } catch (err) {
    console.warn('[GoogleDrive] Erreur chargement documents officiels:', err);
    return [];
  }
}

/**
 * Télécharge le texte d'un document officiel depuis le serveur.
 */
export async function downloadDriveDocumentText(fileId: string, adminToken?: string): Promise<string> {
  const headers: Record<string, string> = {};
  if (adminToken) headers['x-admin-token'] = adminToken;
  const res = await fetch(`/api/documents/file?name=${encodeURIComponent(fileId)}`, { headers });
  if (!res.ok) {
    throw new Error(`Impossible de récupérer le document (${res.status}).`);
  }
  const data = await res.json();
  return data.content || '';
}

// -----------------------------------------------------------------------------
// STUBS DE RÉTROCOMPATIBILITÉ (évite toute régression de compilation)
// -----------------------------------------------------------------------------
export const initDriveAuth = (_onSuccess?: any, _onFailure?: any) => {
  return () => {};
};

export const signInWithGoogleDrive = async () => {
  return { user: { displayName: 'Développeur / Professeur' } as any, accessToken: 'public_drive_token' };
};

export const signOutFromGoogleDrive = async () => {};

export const getCurrentDriveUser = () => null;

export const getDriveAccessToken = () => 'public_drive_token';

export const getOrCreateBranchFolder = async (_branch: 'PC' | 'SM') => '';

export const uploadOfficialDriveDocument = async (_file: File, _branch: 'PC' | 'SM') => {
  throw new Error(
    "Pour ajouter un document officiel, déposez-le directement dans votre dossier Google Drive public, puis cliquez sur « Synchroniser » dans l'application."
  );
};

export const deleteOfficialDriveDocument = async (fileId: string, adminToken?: string) => {
  const headers: Record<string, string> = {};
  if (adminToken) headers['x-admin-token'] = adminToken;
  const res = await fetch(`/api/documents/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) {
    throw new Error('Erreur suppression document (Jeton administrateur requis).');
  }
};
