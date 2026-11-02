/**
 * Document Vault - Persistent Client-Side Storage via IndexedDB
 * 
 * Ce module protège les documents de l'élève (PDFs, fiches de cours, énoncés)
 * en les stockant de façon permanente dans l'IndexedDB du navigateur.
 * 
 * À chaque mise à jour ou redémarrage de l'application (serveur / conteneur),
 * la fonction `syncVaultWithServer()` vérifie automatiquement si des documents
 * manquent sur le serveur et les ré-injecte de manière transparente dans /docs/programme/.
 */

export interface VaultDocument {
  name: string;
  isPdf: boolean;
  content?: string;
  base64?: string;
  size: number;
  savedAt: number;
  branch?: 'PC' | 'SM' | 'ALL';
  category?: 'cours' | 'exercice' | 'devoir' | 'resume';
}

const DB_NAME = 'sidriss_document_vault_db';
const STORE_NAME = 'documents';
const DB_VERSION = 2;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB non supporté par ce navigateur'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'name' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Enregistre un document de l'élève dans le coffre-fort permanent local du navigateur.
 */
export async function saveDocumentToVault(doc: Omit<VaultDocument, 'savedAt'>): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const record: VaultDocument = {
      ...doc,
      branch: doc.branch || 'PC',
      savedAt: Date.now(),
    };
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error('Échec d’écriture IndexedDB'));
  });
}

/**
 * Récupère tous les documents enregistrés dans le coffre-fort IndexedDB,
 * avec filtrage optionnel par filière (PC, SM ou ALL).
 */
export async function getAllDocumentsFromVault(branchFilter?: 'PC' | 'SM'): Promise<VaultDocument[]> {
  try {
    const db = await openDB();
    const docs = await new Promise<VaultDocument[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    if (!branchFilter) return docs;
    return docs.filter((d) => !d.branch || d.branch === 'ALL' || d.branch === branchFilter);
  } catch (err) {
    console.warn('[DocumentVault] Erreur lecture IndexedDB:', err);
    return [];
  }
}

/**
 * Alias explicite pour récupérer les documents de l'élève par filière.
 */
export const getStudentDocuments = getAllDocumentsFromVault;

/**
 * Supprime un document du coffre-fort permanent.
 */
export async function removeDocumentFromVault(name: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(name);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error('Échec de suppression IndexedDB'));
  });
}

/**
 * Synchronise et restaure automatiquement les fichiers du coffre vers le serveur
 * s'ils ont été effacés lors d'une mise à jour ou d'un redéploiement.
 */
export async function syncVaultWithServer(): Promise<{
  restoredCount: number;
  totalVaultCount: number;
  serverFiles: string[];
}> {
  try {
    const vaultDocs = await getAllDocumentsFromVault();
    if (vaultDocs.length === 0) {
      return { restoredCount: 0, totalVaultCount: 0, serverFiles: [] };
    }

    // Récupérer les fichiers actuellement sur le serveur
    const res = await fetch('/api/documents');
    if (!res.ok) {
      return { restoredCount: 0, totalVaultCount: vaultDocs.length, serverFiles: [] };
    }

    const data = await res.json();
    const existingServerNames = new Set<string>((data.files || []).map((f: any) => String(f.name || '')));

    let restoredCount = 0;

    for (const doc of vaultDocs) {
      if (!existingServerNames.has(doc.name)) {
        try {
          const uploadRes = await fetch('/api/documents/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: doc.name,
              content: doc.content,
              base64: doc.base64,
            }),
          });
          if (uploadRes.ok) {
            restoredCount++;
            existingServerNames.add(doc.name);
            console.log(`[DocumentVault] Fichier restauré sur le serveur après mise à jour : ${doc.name}`);
          }
        } catch (uploadErr) {
          console.warn(`[DocumentVault] Échec restauration ${doc.name}:`, uploadErr);
        }
      }
    }

    return {
      restoredCount,
      totalVaultCount: vaultDocs.length,
      serverFiles: Array.from(existingServerNames),
    };
  } catch (err) {
    console.warn('[DocumentVault] Erreur synchronisation coffre-fort:', err);
    return { restoredCount: 0, totalVaultCount: 0, serverFiles: [] };
  }
}

/**
 * Exporte une sauvegarde JSON complète de tous les documents du coffre.
 */
export async function exportVaultBackup(): Promise<void> {
  const docs = await getAllDocumentsFromVault();
  const backupData = {
    app: 'Si Driss Bac BIOF',
    exportedAt: new Date().toISOString(),
    version: 1,
    documents: docs,
  };

  const blob = new Blob([JSON.stringify(backupData, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `si-driss-documents-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Importe un fichier de sauvegarde JSON, enregistre dans IndexedDB et pousse sur le serveur.
 */
export async function importVaultBackup(jsonStr: string): Promise<number> {
  const data = JSON.parse(jsonStr);
  if (!data || !Array.isArray(data.documents)) {
    throw new Error('Format de fichier de sauvegarde invalide.');
  }

  let importedCount = 0;
  for (const doc of data.documents) {
    if (doc.name && (doc.content || doc.base64)) {
      await saveDocumentToVault({
        name: doc.name,
        isPdf: Boolean(doc.isPdf),
        content: doc.content,
        base64: doc.base64,
        size: doc.size || 0,
      });

      // Synchroniser avec le serveur
      await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: doc.name,
          content: doc.content,
          base64: doc.base64,
        }),
      }).catch(() => {});

      importedCount++;
    }
  }

  return importedCount;
}
