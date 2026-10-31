import React, { useState, useEffect, useRef } from 'react';
import {
  FolderOpen,
  Upload,
  FileText,
  Trash2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Plus,
  Eye,
  FileCode,
  Sparkles,
  Zap,
  ArrowRight,
  Copy,
  ShieldCheck,
  Download,
  UploadCloud,
  FileUp,
} from 'lucide-react';
import { MathView } from './MathView';
import { useModalA11y } from '../hooks/useModalA11y';
import { getAdminToken, getAccessToken } from '../hooks/useApiKey';
import {
  saveDocumentToVault,
  removeDocumentFromVault,
  syncVaultWithServer,
  exportVaultBackup,
  importVaultBackup,
  getAllDocumentsFromVault,
} from '../utils/documentVault';

/** En-têtes d'authentification pour les routes admin (upload/delete documents). */
function adminHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'x-access-token': getAccessToken() };
  const admin = getAdminToken();
  if (admin) headers['x-admin-token'] = admin;
  return headers;
}

interface DocFile {
  name: string;
  size: number;
  modified: string;
  preview: string;
}

interface DocumentManagerProps {
  onAskQuestionAboutDoc?: (docName: string) => void;
}

export const DocumentManager: React.FC<DocumentManagerProps> = ({ onAskQuestionAboutDoc }) => {
  const [files, setFiles] = useState<DocFile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [vaultCount, setVaultCount] = useState<number>(0);

  // New text file creation modal/form
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newFileName, setNewFileName] = useState<string>('');
  const [newFileContent, setNewFileContent] = useState<string>('');
  const [copiedPath, setCopiedPath] = useState<boolean>(false);

  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  // (M14) Accessibilité de la modale de création de document
  const createDialogRef = useModalA11y(showCreateModal, () => setShowCreateModal(false));

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Synchronise le coffre-fort IndexedDB avec le serveur au chargement
  const syncAndLoad = async () => {
    setLoading(true);
    try {
      const syncResult = await syncVaultWithServer();
      setVaultCount(syncResult.totalVaultCount);

      if (syncResult.restoredCount > 0) {
        setStatusMsg({
          text: `🛡️ ${syncResult.restoredCount} document(s) automatiquement restauré(s) depuis votre sauvegarde locale permanente suite à la mise à jour !`,
          type: 'success',
        });
      }

      await fetchDocuments();
    } catch (err) {
      console.warn('Erreur synchro coffre:', err);
      await fetchDocuments();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncAndLoad();
    getAllDocumentsFromVault().then((docs) => setVaultCount(docs.length));
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    setUploading(true);
    setStatusMsg(null);

    try {
      let uploadedCount = 0;
      const vaultFailures: string[] = [];
      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        let bodyPayload: { filename: string; content?: string; base64?: string } = { filename: file.name };
        const isPdf = file.name.toLowerCase().endsWith('.pdf');

        if (isPdf) {
          const arrayBuffer = await file.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          const chunkSize = 8192;
          for (let b = 0; b < bytes.byteLength; b += chunkSize) {
            const chunk = bytes.subarray(b, Math.min(b + chunkSize, bytes.byteLength));
            binary += String.fromCharCode.apply(null, Array.from(chunk));
          }
          const base64Data = btoa(binary);
          bodyPayload.base64 = base64Data;

          // Sauvegarde immédiate dans le coffre-fort permanent IndexedDB (M15 : échec visible)
          try {
            await saveDocumentToVault({
              name: file.name,
              isPdf: true,
              base64: base64Data,
              size: file.size,
            });
          } catch (vaultErr) {
            console.warn('[DocumentVault] Échec sauvegarde locale:', vaultErr);
            vaultFailures.push(file.name);
          }
        } else {
          const textContent = await file.text();
          bodyPayload.content = textContent;

          // Sauvegarde immédiate dans le coffre-fort permanent IndexedDB (M15 : échec visible)
          try {
            await saveDocumentToVault({
              name: file.name,
              isPdf: false,
              content: textContent,
              size: file.size,
            });
          } catch (vaultErr) {
            console.warn('[DocumentVault] Échec sauvegarde locale:', vaultErr);
            vaultFailures.push(file.name);
          }
        }

        const res = await fetch('/api/documents/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...adminHeaders() },
          body: JSON.stringify(bodyPayload),
        });

        if (res.status === 401) {
          throw new Error('Jeton administrateur requis : ajoute ?admin=TON_JETON à l’URL puis réessaie.');
        }
        if (res.status === 503) {
          throw new Error("Le serveur n'a pas de ADMIN_TOKEN configuré : la gestion des documents est désactivée en production.");
        }
        if (!res.ok) throw new Error(`Erreur lors de l'upload de ${file.name}`);
        uploadedCount++;
      }

      const allVault = await getAllDocumentsFromVault();
      setVaultCount(allVault.length);

      // (M15) Message honnête : distingue l'indexation serveur de la copie locale permanente
      if (vaultFailures.length > 0) {
        setStatusMsg({
          text: `${uploadedCount} fichier(s) indexé(s) sur le serveur, mais la sauvegarde locale permanente a échoué pour : ${vaultFailures.join(', ')} (mémoire du navigateur saturée ?). Ces fichiers ne seront pas restaurés automatiquement — exporte une sauvegarde .json pour les protéger.`,
          type: 'error',
        });
      } else {
        setStatusMsg({
          text: `${uploadedCount} fichier(s) indexé(s) et sauvegardé(s) en permanence dans votre coffre-fort local ! Ils ne disparaîtront plus lors des mises à jour.`,
          type: 'success',
        });
      }
      await fetchDocuments();
    } catch (err: any) {
      setStatusMsg({ text: err?.message || 'Erreur lors de l\'upload.', type: 'error' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleCreateDocument = async () => {
    if (!newFileName.trim() || !newFileContent.trim()) return;

    let finalName = newFileName.trim();
    if (!finalName.endsWith('.md') && !finalName.endsWith('.txt')) {
      finalName += '.md';
    }

    try {
      // 1. Sauvegarde dans le coffre IndexedDB
      await saveDocumentToVault({
        name: finalName,
        isPdf: false,
        content: newFileContent,
        size: new Blob([newFileContent]).size,
      });

      // 2. Upload sur le serveur
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders() },
        body: JSON.stringify({
          filename: finalName,
          content: newFileContent,
        }),
      });

      if (res.status === 401) {
        setStatusMsg({
          text: 'Jeton administrateur requis : ajoute ?admin=TON_JETON à l’URL puis réessaie.',
          type: 'error',
        });
        return;
      }

      if (res.ok) {
        setStatusMsg({
          text: `Document "${finalName}" enregistré et protégé en local de manière permanente !`,
          type: 'success',
        });
        setShowCreateModal(false);
        setNewFileName('');
        setNewFileContent('');
        const allVault = await getAllDocumentsFromVault();
        setVaultCount(allVault.length);
        await fetchDocuments();
      } else {
        // (M15) Échec serveur signalé explicitement (la copie locale existe, elle)
        setStatusMsg({
          text: `Le serveur a refusé "${finalName}" (code ${res.status}). Le document reste sauvegardé dans ton coffre-fort local — réessaie plus tard.`,
          type: 'error',
        });
      }
    } catch (err: any) {
      // (M15) Plus d'échec silencieux (console seule) : l'élève est informé.
      setStatusMsg({ text: err?.message || `Impossible d'enregistrer "${finalName}".`, type: 'error' });
    }
  };

  const handleDelete = async (filename: string) => {
    try {
      // 1. Supprimer du serveur
      const res = await fetch(`/api/documents/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
        headers: adminHeaders(),
      });
      if (res.status === 401) {
        setStatusMsg({
          text: 'Jeton administrateur requis : ajoute ?admin=TON_JETON à l’URL puis réessaie.',
          type: 'error',
        });
        return;
      }

      // 2. Supprimer du coffre-fort local
      await removeDocumentFromVault(filename);

      setFiles((prev) => prev.filter((f) => f.name !== filename));
      const allVault = await getAllDocumentsFromVault();
      setVaultCount(allVault.length);
      setStatusMsg({ text: `Le document "${filename}" a été supprimé.`, type: 'info' });
    } catch (err) {
      console.error(err);
      setStatusMsg({ text: `Impossible de supprimer "${filename}".`, type: 'error' });
    }
  };

  const handleCopyPath = () => {
    navigator.clipboard.writeText('/docs/programme/');
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  const handleExportBackup = async () => {
    try {
      await exportVaultBackup();
      setStatusMsg({
        text: 'Fichier de sauvegarde exporté avec succès ! Tu pourras le restaurer à tout moment.',
        type: 'success',
      });
    } catch (err: any) {
      setStatusMsg({ text: 'Erreur lors de l\'exportation de la sauvegarde.', type: 'error' });
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const count = await importVaultBackup(text);
      setStatusMsg({
        text: `Sauvegarde importée avec succès : ${count} document(s) restauré(s) et indexé(s) !`,
        type: 'success',
      });
      await fetchDocuments();
      const allVault = await getAllDocumentsFromVault();
      setVaultCount(allVault.length);
    } catch (err: any) {
      setStatusMsg({ text: `Erreur import : ${err?.message || 'Fichier invalide'}`, type: 'error' });
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Permanent Storage Guarantee Banner */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-bold text-white">Stockage Permanent & Auto-Restauration Activé</h4>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Anti-Perte Garanti
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Tes fichiers sont sauvegardés dans le coffre-fort local ({vaultCount} document(s) sécurisé(s)) et <strong>ré-injectés automatiquement sur le serveur</strong> à chaque mise à jour ou redémarrage !
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportBackup}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
            title="Télécharger une copie de secours de tous mes documents"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Sauvegarder (.json)</span>
          </button>

          <button
            onClick={() => importFileInputRef.current?.click()}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
            title="Restaurer des documents depuis un fichier de sauvegarde"
          >
            <UploadCloud className="w-3.5 h-3.5 text-sky-400" />
            <span>Restaurer</span>
          </button>
          <input
            ref={importFileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportBackup}
            className="hidden"
          />
        </div>
      </div>

      {/* Directory Location Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Répertoire Officiel des Documents du Programme</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Dépose tes résumés et cours pour des réponses instantanées et précises de Si Driss
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              Nouveau document texte
            </button>

            <label className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all">
              <Upload className="w-4 h-4" />
              <span>{uploading ? 'Téléversement...' : 'Téléverser des fichiers (.pdf, .md, .txt)'}</span>
              <input
                type="file"
                multiple
                accept=".pdf,.md,.txt,.json,.csv"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Directory Path Info Box */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              Emplacement exact dans le projet :
            </span>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono text-cyan-300 font-bold bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">
                /docs/programme/
              </code>
              <button
                onClick={handleCopyPath}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                title="Copier le chemin"
              >
                {copiedPath ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="text-xs text-slate-400 max-w-md">
            💡 <strong>Restauration Automatique :</strong> Chaque document que tu téléverses est dorénavant sauvegardé dans la mémoire permanente de ton navigateur. Même si le serveur se redéploie ou se met à jour, l'application ré-injecte automatiquement tes cours sans que tu aies besoin de les retéléverser !
          </div>
        </div>

        {statusMsg && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              statusMsg.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : statusMsg.type === 'info'
                ? 'bg-sky-950/40 border-sky-500/30 text-sky-300'
                : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : statusMsg.type === 'info' ? (
              <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}
      </div>

      {/* Uploaded Documents List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <FileCode className="w-4 h-4 text-cyan-400" />
            Documents Actuellement Indexés ({files.length})
          </h4>
          <button
            onClick={syncAndLoad}
            disabled={loading}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors text-xs flex items-center gap-1.5"
            title="Vérifier et synchroniser le coffre-fort"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Synchroniser</span>
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Chargement et synchronisation des documents du répertoire...
          </div>
        ) : files.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs bg-slate-950 rounded-xl border border-dashed border-slate-800 space-y-2">
            <FileText className="w-8 h-8 text-slate-600 mx-auto" />
            <p>Aucun document pour le moment dans <code className="text-amber-400 font-mono">/docs/programme/</code>.</p>
            <p className="text-[11px] text-slate-500">
              Dépose tes fiches de cours ou clique sur "Téléverser des fichiers" ci-dessus.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {files.map((file) => (
              <div
                key={file.name}
                className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 hover:border-slate-700 space-y-2.5 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="font-bold text-slate-200 text-xs font-mono truncate" title={file.name}>
                      {file.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleDelete(file.name)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                      title="Supprimer le document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed bg-slate-900/50 p-2 rounded-lg border border-slate-800/60 font-mono">
                  {file.preview || 'Contenu indexé'}
                </p>

                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/50">
                  <span>{(file.size / 1024).toFixed(1)} Ko</span>
                  {onAskQuestionAboutDoc && (
                    <button
                      onClick={() => onAskQuestionAboutDoc(file.name)}
                      className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 transition-colors"
                    >
                      Interroger Si Driss sur ce doc
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Document Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div
            ref={createDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Créer un document du programme"
            tabIndex={-1}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-4 p-5"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-400" />
                Créer un document permanent dans /docs/programme/
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                Fermer
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Nom du fichier (ex: cours_ondes_optiques.md) :
                </label>
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="mon_resume_physique.md"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Contenu du document (Texte, définitions, formules en $...$) :
                </label>
                <textarea
                  rows={10}
                  value={newFileContent}
                  onChange={(e) => setNewFileContent(e.target.value)}
                  placeholder="# Titre du chapitre
- Définition 1 : ...
- Formule clé : $v = d / \Delta t$
- Piège à éviter : ..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500 leading-relaxed"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateDocument}
                disabled={!newFileName.trim() || !newFileContent.trim()}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs disabled:opacity-40"
              >
                Enregistrer et indexer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
