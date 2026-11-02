import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
// Configuration Firebase client pour Google Drive (supporte les variables VITE_ ou valeurs par défaut)
const FIREBASE_CONFIG = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'gen-lang-client-0176457762',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:97093970248:web:0859a349ef3f3ab2fc6b7d',
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBvfihcgHc718J7GzP-UVc-3jDnVIFyyyI',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'gen-lang-client-0176457762.firebaseapp.com',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'gen-lang-client-0176457762.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '97093970248',
};

// Reuse existing Firebase app instance if already initialized
const app = getApps().length > 0 ? getApp() : initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);

// Scopes required for Google Drive official documents management
export const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
];

const provider = new GoogleAuthProvider();
DRIVE_SCOPES.forEach((scope) => provider.addScope(scope));

// In-memory caching for OAuth access token (per workspace-integration skill)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export interface DriveDoc {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  modifiedTime?: string;
  webViewLink?: string;
  branch: 'PC' | 'SM';
  preview?: string;
}

/**
 * Initializes the auth listener. Keeps access token in memory.
 */
export const initDriveAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      onAuthSuccess?.(user, cachedAccessToken);
    } else {
      if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure?.();
      }
    }
  });
};

/**
 * Initiates Google sign-in for the Professor / Admin to access Google Drive.
 */
export const signInWithGoogleDrive = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Impossible de récupérer le jeton d\'accès Google Drive.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('[GoogleDrive] Erreur de connexion:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Returns current access token from memory.
 */
export const getDriveAccessToken = (): string | null => {
  return cachedAccessToken;
};

/**
 * Signs out the Professor from Google Drive session.
 */
export const signOutFromGoogleDrive = async (): Promise<void> => {
  await signOut(auth);
  cachedAccessToken = null;
};

/**
 * Returns the current authenticated Google user.
 */
export const getCurrentDriveUser = (): User | null => {
  return auth.currentUser;
};

/**
 * Names of official folders created in Google Drive for each branch.
 */
export const FOLDER_NAMES: Record<'PC' | 'SM', string> = {
  PC: 'Si Driss — Documents Officiels PC',
  SM: 'Si Driss — Documents Officiels SM',
};

/**
 * Gets or creates the official branch folder in the teacher's Google Drive.
 */
export const getOrCreateBranchFolder = async (branch: 'PC' | 'SM'): Promise<string> => {
  const token = getDriveAccessToken();
  if (!token) throw new Error('Authentification Google Drive requise.');

  const folderName = FOLDER_NAMES[branch];

  // 1. Search for existing folder
  const query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!searchRes.ok) {
    const errText = await searchRes.text();
    throw new Error(`Erreur recherche dossier Drive: ${errText}`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // 2. Create the folder if not found
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      description: `Dossier officiel des documents pédagogiques de Physique-Chimie pour 2ème Bac ${branch} (BIOF).`,
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Erreur création dossier Drive: ${errText}`);
  }

  const newFolder = await createRes.json();
  return newFolder.id;
};

/**
 * Lists official documents stored in Google Drive for a specific branch (or both).
 */
export const listOfficialDriveDocuments = async (branch?: 'PC' | 'SM'): Promise<DriveDoc[]> => {
  const token = getDriveAccessToken();
  if (!token) return [];

  const branchesToFetch: ('PC' | 'SM')[] = branch ? [branch] : ['PC', 'SM'];
  const allDocs: DriveDoc[] = [];

  for (const b of branchesToFetch) {
    try {
      const folderId = await getOrCreateBranchFolder(b);
      const query = `'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`;
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        query
      )}&fields=files(id,name,mimeType,size,modifiedTime,webViewLink)&orderBy=name`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const files: DriveDoc[] = (data.files || []).map((f: any) => ({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          size: f.size ? Number(f.size) : undefined,
          modifiedTime: f.modifiedTime,
          webViewLink: f.webViewLink,
          branch: b,
        }));
        allDocs.push(...files);
      }
    } catch (err) {
      console.warn(`[GoogleDrive] Erreur listing documents pour ${b}:`, err);
    }
  }

  return allDocs;
};

/**
 * Uploads a file directly to the teacher's Google Drive in the branch-specific folder.
 */
export const uploadOfficialDriveDocument = async (
  file: File,
  branch: 'PC' | 'SM',
  customContent?: string
): Promise<DriveDoc> => {
  const token = getDriveAccessToken();
  if (!token) throw new Error('Veuillez vous connecter à Google Drive.');

  const folderId = await getOrCreateBranchFolder(branch);

  const metadata = {
    name: file.name,
    parents: [folderId],
    description: `Document officiel 2ème Bac ${branch} téléversé par le Professeur.`,
    properties: {
      branch,
      role: 'official',
    },
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  let body: BodyInit;
  let contentTypeHeader: string;

  if (customContent !== undefined || file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
    const textData = customContent !== undefined ? customContent : await file.text();
    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${file.type || 'text/plain'}\r\n\r\n` +
      textData +
      closeDelimiter;

    body = multipartRequestBody;
    contentTypeHeader = `multipart/related; boundary=${boundary}`;
  } else {
    // Binary/PDF files
    const arrayBuffer = await file.arrayBuffer();
    const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
    const fileBlob = new Blob([arrayBuffer], { type: file.type || 'application/octet-stream' });

    const formData = new FormData();
    formData.append('metadata', metadataBlob);
    formData.append('file', fileBlob);

    // Using multipart standard upload
    const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,webViewLink';
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error(`Échec upload Google Drive (${uploadRes.status}): ${err}`);
    }

    const uploaded = await uploadRes.json();
    return {
      id: uploaded.id,
      name: uploaded.name,
      mimeType: uploaded.mimeType,
      size: uploaded.size ? Number(uploaded.size) : file.size,
      modifiedTime: uploaded.modifiedTime,
      webViewLink: uploaded.webViewLink,
      branch,
    };
  }

  const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,webViewLink';
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': contentTypeHeader,
    },
    body,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Échec upload Google Drive (${uploadRes.status}): ${err}`);
  }

  const uploaded = await uploadRes.json();
  return {
    id: uploaded.id,
    name: uploaded.name,
    mimeType: uploaded.mimeType,
    size: uploaded.size ? Number(uploaded.size) : file.size,
    modifiedTime: uploaded.modifiedTime,
    webViewLink: uploaded.webViewLink,
    branch,
  };
};

/**
 * Downloads text or extracts content from a Google Drive document.
 */
export const downloadDriveDocumentText = async (fileId: string): Promise<string> => {
  const token = getDriveAccessToken();
  if (!token) throw new Error('Authentification requise.');

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Impossible de récupérer le document (${res.status}).`);
  }

  return await res.text();
};

/**
 * Deletes an official document from Google Drive.
 * (MANDATORY: An explicit UI confirmation must be confirmed before calling this function).
 */
export const deleteOfficialDriveDocument = async (fileId: string): Promise<void> => {
  const token = getDriveAccessToken();
  if (!token) throw new Error('Authentification requise.');

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok && res.status !== 404) {
    const err = await res.text();
    throw new Error(`Erreur lors de la suppression sur Google Drive: ${err}`);
  }
};
