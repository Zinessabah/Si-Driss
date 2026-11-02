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
  ArrowRight,
  ShieldCheck,
  Download,
  UploadCloud,
  FileUp,
  Cloud,
  HardDrive,
  ExternalLink,
  LogOut,
  AlertTriangle,
  X,
  File,
} from 'lucide-react';
import { useModalA11y } from '../hooks/useModalA11y';
import { useBranch, StudentBranch } from '../hooks/useBranch';
import {
  saveDocumentToVault,
  removeDocumentFromVault,
  getAllDocumentsFromVault,
  VaultDocument,
  exportVaultBackup,
  importVaultBackup,
} from '../utils/documentVault';
import {
  initDriveAuth,
  signInWithGoogleDrive,
  signOutFromGoogleDrive,
  listOfficialDriveDocuments,
  uploadOfficialDriveDocument,
  deleteOfficialDriveDocument,
  downloadDriveDocumentText,
  getCurrentDriveUser,
  getDriveAccessToken,
  DriveDoc,
  FOLDER_NAMES,
} from '../utils/googleDrive';
import type { User } from 'firebase/auth';

interface DocumentManagerProps {
  onAskQuestionAboutDoc?: (docName: string, content?: string) => void;
}

export const DocumentManager: React.FC<DocumentManagerProps> = ({ onAskQuestionAboutDoc }) => {
  const { branch: globalBranch } = useBranch();
  // Selected branch in document manager (PC or SM)
  const [selectedBranch, setSelectedBranch] = useState<StudentBranch>(globalBranch || 'PC');

  // Active section: 'drive' (Admin/Prof - Google Drive) vs 'local' (Élève - Local IndexedDB)
  const [activeSection, setActiveSection] = useState<'drive' | 'local'>('drive');

  // Google Drive state
  const [driveUser, setDriveUser] = useState<User | null>(null);
  const [driveDocs, setDriveDocs] = useState<DriveDoc[]>([]);
  const [driveLoading, setDriveLoading] = useState<boolean>(false);
  const [driveUploading, setDriveUploading] = useState<boolean>(false);

  // Student local documents state (IndexedDB)
  const [localDocs, setLocalDocs] = useState<VaultDocument[]>([]);
  const [localLoading, setLocalLoading] = useState<boolean>(false);
  const [localUploading, setLocalUploading] = useState<boolean>(false);

  // Document preview state
  const [previewDoc, setPreviewDoc] = useState<{ name: string; content: string; source: 'drive' | 'local' } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);

  // Deletion confirmation modal (MANDATORY for destructive Drive operations)
  const [docToDelete, setDocToDelete] = useState<{ id: string; name: string; source: 'drive' | 'local' } | null>(null);

  // Status message
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Student new text doc modal
  const [showCreateLocalModal, setShowCreateLocalModal] = useState<boolean>(false);
  const [newDocName, setNewDocName] = useState<string>('');
  const [newDocContent, setNewDocContent] = useState<string>('');

  const importLocalFileInputRef = useRef<HTMLInputElement | null>(null);
  const driveFileInputRef = useRef<HTMLInputElement | null>(null);
  const localFileInputRef = useRef<HTMLInputElement | null>(null);

  const previewModalRef = useModalA11y(Boolean(previewDoc), () => setPreviewDoc(null));
  const deleteModalRef = useModalA11y(Boolean(docToDelete), () => setDocToDelete(null));
  const createModalRef = useModalA11y(showCreateLocalModal, () => setShowCreateLocalModal(false));

  // Initialize Google Auth state
  useEffect(() => {
    const unsubscribe = initDriveAuth(
      (user) => {
        setDriveUser(user);
      },
      () => {
        setDriveUser(null);
        setDriveDocs([]);
      }
    );
    return () => unsubscribe();
  }, []);

  // Sync selected branch with global branch if changed
  useEffect(() => {
    if (globalBranch) {
      setSelectedBranch(globalBranch);
    }
  }, [globalBranch]);

  // Load Google Drive documents when authenticated or when branch changes
  const refreshDriveDocs = async () => {
    if (!getDriveAccessToken()) {
      setDriveDocs([]);
      return;
    }
    setDriveLoading(true);
    try {
      const docs = await listOfficialDriveDocuments(selectedBranch);
      setDriveDocs(docs);
    } catch (err: any) {
      console.warn('[GoogleDrive] Erreur chargement documents:', err);
      setStatusMsg({ text: `Impossible de charger les fichiers Google Drive : ${err?.message || ''}`, type: 'error' });
    } finally {
      setDriveLoading(false);
    }
  };

  useEffect(() => {
    if (driveUser) {
      refreshDriveDocs();
    }
  }, [driveUser, selectedBranch]);

  // Load Student local documents from IndexedDB
  const refreshLocalDocs = async () => {
    setLocalLoading(true);
    try {
      const docs = await getAllDocumentsFromVault(selectedBranch);
      setLocalDocs(docs);
    } catch (err) {
      console.warn('[LocalVault] Erreur chargement documents:', err);
    } finally {
      setLocalLoading(false);
    }
  };

  useEffect(() => {
    refreshLocalDocs();
  }, [selectedBranch]);

  // Google Sign-in Handler
  const handleGoogleSignIn = async () => {
    setStatusMsg(null);
    try {
      const { user } = await signInWithGoogleDrive();
      setDriveUser(user);
      setStatusMsg({
        text: `Connecté à Google Drive avec succès (${user.email}). Vos documents officiels ${selectedBranch} sont synchronisés !`,
        type: 'success',
      });
    } catch (err: any) {
      setStatusMsg({
        text: err?.message || 'Connexion à Google Drive annulée ou échouée.',
        type: 'error',
      });
    }
  };

  // Google Sign-out Handler
  const handleGoogleSignOut = async () => {
    try {
      await signOutFromGoogleDrive();
      setDriveUser(null);
      setDriveDocs([]);
      setStatusMsg({ text: 'Déconnecté de Google Drive.', type: 'info' });
    } catch (err) {
      console.error(err);
    }
  };

  // Upload file to Google Drive (Admin/Prof)
  const handleDriveFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setDriveUploading(true);
    setStatusMsg(null);

    try {
      let count = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        await uploadOfficialDriveDocument(file, selectedBranch);
        count++;
      }
      setStatusMsg({
        text: `✅ ${count} document(s) officiel(s) téléversé(s) dans Google Drive sous "${FOLDER_NAMES[selectedBranch]}" !`,
        type: 'success',
      });
      await refreshDriveDocs();
    } catch (err: any) {
      setStatusMsg({
        text: `Échec du téléversement vers Google Drive : ${err?.message || 'Erreur inconnue'}`,
        type: 'error',
      });
    } finally {
      setDriveUploading(false);
      if (driveFileInputRef.current) driveFileInputRef.current.value = '';
    }
  };

  // Upload file to Local Student Vault (IndexedDB)
  const handleLocalFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLocalUploading(true);
    setStatusMsg(null);

    try {
      let count = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
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

          await saveDocumentToVault({
            name: file.name,
            isPdf: true,
            base64: base64Data,
            size: file.size,
            branch: selectedBranch,
          });
        } else {
          const text = await file.text();
          await saveDocumentToVault({
            name: file.name,
            isPdf: false,
            content: text,
            size: file.size,
            branch: selectedBranch,
          });
        }
        count++;
      }

      setStatusMsg({
        text: `💾 ${count} document(s) sauvegardé(s) dans le stockage local de l'élève (Filière ${selectedBranch}) !`,
        type: 'success',
      });
      await refreshLocalDocs();
    } catch (err: any) {
      setStatusMsg({
        text: `Erreur enregistrement local : ${err?.message || 'Erreur'}`,
        type: 'error',
      });
    } finally {
      setLocalUploading(false);
      if (localFileInputRef.current) localFileInputRef.current.value = '';
    }
  };

  // Create custom student text document locally
  const handleCreateLocalDocument = async () => {
    if (!newDocName.trim() || !newDocContent.trim()) return;

    let cleanName = newDocName.trim();
    if (!cleanName.endsWith('.md') && !cleanName.endsWith('.txt')) {
      cleanName += '.md';
    }

    try {
      await saveDocumentToVault({
        name: cleanName,
        isPdf: false,
        content: newDocContent,
        size: new Blob([newDocContent]).size,
        branch: selectedBranch,
      });

      setStatusMsg({
        text: `Fiche "${cleanName}" enregistrée localement pour la filière ${selectedBranch} !`,
        type: 'success',
      });
      setShowCreateLocalModal(false);
      setNewDocName('');
      setNewDocContent('');
      await refreshLocalDocs();
    } catch (err: any) {
      setStatusMsg({ text: `Erreur création document : ${err?.message || 'Erreur'}`, type: 'error' });
    }
  };

  // Execute deletion with confirmed dialog
  const handleConfirmDelete = async () => {
    if (!docToDelete) return;

    setStatusMsg(null);
    try {
      if (docToDelete.source === 'drive') {
        await deleteOfficialDriveDocument(docToDelete.id);
        setStatusMsg({
          text: `Le document officiel "${docToDelete.name}" a été définitivement supprimé de Google Drive.`,
          type: 'success',
        });
        await refreshDriveDocs();
      } else {
        await removeDocumentFromVault(docToDelete.name);
        setStatusMsg({
          text: `Le document local "${docToDelete.name}" a été supprimé de votre appareil.`,
          type: 'success',
        });
        await refreshLocalDocs();
      }
    } catch (err: any) {
      setStatusMsg({ text: `Échec de la suppression : ${err?.message || 'Erreur'}`, type: 'error' });
    } finally {
      setDocToDelete(null);
    }
  };

  // View document content
  const handlePreviewDoc = async (doc: { id?: string; name: string; content?: string; isPdf?: boolean; source: 'drive' | 'local' }) => {
    setLoadingPreview(true);
    setPreviewDoc({ name: doc.name, content: 'Chargement du document...', source: doc.source });

    try {
      if (doc.source === 'drive' && doc.id) {
        if (doc.name.toLowerCase().endsWith('.pdf')) {
          setPreviewDoc({
            name: doc.name,
            content: `Document PDF officiel hébergé sur Google Drive.\n\nNom: ${doc.name}\nFilière: ${selectedBranch}\n\nVous pouvez l'ouvrir directement dans Google Drive via le lien externe ou l'attacher aux questions de Si Driss.`,
            source: 'drive',
          });
        } else {
          const text = await downloadDriveDocumentText(doc.id);
          setPreviewDoc({ name: doc.name, content: text, source: 'drive' });
        }
      } else {
        const text = doc.content || 'Document PDF local enregistré dans le coffre-fort de votre navigateur.';
        setPreviewDoc({ name: doc.name, content: text, source: 'local' });
      }
    } catch (err: any) {
      setPreviewDoc({
        name: doc.name,
        content: `Impossible d'afficher l'aperçu : ${err?.message || 'Erreur'}`,
        source: doc.source,
      });
    } finally {
      setLoadingPreview(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 max-w-6xl mx-auto w-full">
      {/* Top Header */}
      <div className="bg-[#18191b] p-5 sm:p-6 rounded-3xl border border-[#282a2c] shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <FolderOpen className="w-4 h-4" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide">
              Gestionnaire de Documents & Cadres de Référence
            </h2>
          </div>
          <p className="text-xs text-[#9aa0a6] max-w-2xl leading-relaxed">
            Architecture à deux niveaux : les <strong>documents officiels du Professeur</strong> sont hébergés sur <strong>Google Drive</strong>,
            tandis que les <strong>documents de l'élève</strong> restent strictement privés et stockés en <strong>local</strong> sur l'appareil.
          </p>
        </div>

        {/* Filière Switcher */}
        <div className="flex items-center gap-1.5 bg-[#131314] p-1.5 rounded-2xl border border-[#282a2c] shrink-0">
          <span className="text-[11px] font-semibold text-[#8e918f] px-2.5">Filière :</span>
          <button
            type="button"
            onClick={() => setSelectedBranch('PC')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              selectedBranch === 'PC'
                ? 'bg-sky-500 text-slate-950 shadow-md ring-1 ring-sky-400/50'
                : 'text-[#9aa0a6] hover:text-white hover:bg-[#202124]'
            }`}
          >
            <span>2BAC PC</span>
            <span className="text-[10px] opacity-80">(Physique)</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedBranch('SM')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              selectedBranch === 'SM'
                ? 'bg-purple-500 text-white shadow-md ring-1 ring-purple-400/50'
                : 'text-[#9aa0a6] hover:text-white hover:bg-[#202124]'
            }`}
          >
            <span>2BAC SM</span>
            <span className="text-[10px] opacity-80">(Maths)</span>
          </button>
        </div>
      </div>

      {/* Notification banner */}
      {statusMsg && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs animate-in fade-in ${
            statusMsg.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
              : statusMsg.type === 'error'
              ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
              : 'bg-sky-950/40 border-sky-500/40 text-sky-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {statusMsg.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : statusMsg.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMsg(null)}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Storage Section Tabs: Google Drive (Prof) vs Local (Élève) */}
      <div className="flex items-center gap-2 border-b border-[#282a2c] pb-3">
        <button
          type="button"
          onClick={() => setActiveSection('drive')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2.5 transition ${
            activeSection === 'drive'
              ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30 shadow-md'
              : 'text-[#9aa0a6] hover:text-white hover:bg-[#202124]'
          }`}
        >
          <Cloud className="w-4 h-4 text-sky-400" />
          <span>Documents Officiels (Google Drive — Professeur)</span>
          {driveDocs.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-mono">
              {driveDocs.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('local')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2.5 transition ${
            activeSection === 'local'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-md'
              : 'text-[#9aa0a6] hover:text-white hover:bg-[#202124]'
          }`}
        >
          <HardDrive className="w-4 h-4 text-emerald-400" />
          <span>Mes Documents Personnels (Stockage Local — Élève)</span>
          {localDocs.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
              {localDocs.length}
            </span>
          )}
        </button>
      </div>

      {/* SECTION 1: GOOGLE DRIVE (PROFESSEUR / ADMIN) */}
      {activeSection === 'drive' && (
        <div className="space-y-5 animate-in fade-in">
          {/* Drive Status & Account Bar */}
          <div className="bg-[#18191b] p-5 rounded-3xl border border-[#282a2c] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">
                    Dossier Google Drive : <span className="text-sky-300">{FOLDER_NAMES[selectedBranch]}</span>
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#202124] text-[#c4c7c5] font-semibold border border-[#3c4043]">
                    Filière {selectedBranch}
                  </span>
                </div>
                <p className="text-xs text-[#9aa0a6] mt-0.5">
                  Les documents officiels du programme déposés ici sont accessibles et indexés par Si Driss pour les élèves de {selectedBranch}.
                </p>
              </div>
            </div>

            {/* Auth Button or User Profile */}
            <div>
              {driveUser ? (
                <div className="flex items-center gap-3 bg-[#131314] px-3.5 py-2 rounded-2xl border border-[#282a2c]">
                  {driveUser.photoURL ? (
                    <img src={driveUser.photoURL} alt={driveUser.displayName || 'Prof'} className="w-6 h-6 rounded-full" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-sky-500 text-slate-950 font-bold text-xs flex items-center justify-center">
                      {(driveUser.displayName || driveUser.email || 'P')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="text-left">
                    <div className="text-xs font-bold text-white leading-tight">
                      {driveUser.displayName || 'Professeur connecté'}
                    </div>
                    <div className="text-[10px] text-[#9aa0a6] leading-tight truncate max-w-[150px]">
                      {driveUser.email}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleGoogleSignOut}
                    className="ml-2 p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition"
                    title="Déconnexion Google Drive"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs flex items-center gap-2.5 shadow-md transition touch-manipulation cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Connexion Google Drive (Professeur)</span>
                </button>
              )}
            </div>
          </div>

          {/* Action Bar for Google Drive */}
          {driveUser && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#18191b] rounded-2xl border border-[#282a2c]">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={driveFileInputRef}
                  onChange={handleDriveFileUpload}
                  multiple
                  accept=".pdf,.md,.txt,.json"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => driveFileInputRef.current?.click()}
                  disabled={driveUploading}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-md transition disabled:opacity-50"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>{driveUploading ? 'Téléversement en cours…' : `Ajouter un document officiel ${selectedBranch}`}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={refreshDriveDocs}
                  disabled={driveLoading}
                  className="p-2 rounded-xl border border-[#3c4043] bg-[#202124] hover:bg-[#282a2c] text-[#c4c7c5] hover:text-white transition"
                  title="Actualiser la liste Google Drive"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${driveLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          )}

          {/* Documents Grid / Empty State */}
          {!driveUser ? (
            <div className="p-8 sm:p-12 text-center rounded-3xl bg-[#18191b]/70 border border-[#282a2c] space-y-3">
              <Cloud className="w-12 h-12 text-[#8e918f] mx-auto opacity-40" />
              <h4 className="text-sm font-bold text-white">Espace Administrateur Google Drive non connecté</h4>
              <p className="text-xs text-[#9aa0a6] max-w-md mx-auto leading-relaxed">
                Connectez-vous avec votre compte Google Enseignant pour créer et consulter les dossiers officiels
                séparés pour le <strong>2BAC PC</strong> et le <strong>2BAC SM</strong>.
              </p>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="mt-3 px-4 py-2.5 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs inline-flex items-center gap-2 shadow-md transition"
              >
                <Cloud className="w-4 h-4" />
                <span>Se connecter à Google Drive</span>
              </button>
            </div>
          ) : driveLoading ? (
            <div className="py-16 text-center text-xs text-[#9aa0a6] flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
              Chargement des documents officiels {selectedBranch} depuis Google Drive…
            </div>
          ) : driveDocs.length === 0 ? (
            <div className="p-8 sm:p-12 text-center rounded-3xl bg-[#18191b]/70 border border-[#282a2c] space-y-2">
              <File className="w-10 h-10 text-[#8e918f] mx-auto opacity-30" />
              <h4 className="text-sm font-bold text-white">Aucun document officiel dans {FOLDER_NAMES[selectedBranch]}</h4>
              <p className="text-xs text-[#9aa0a6] max-w-sm mx-auto">
                Cliquez sur « Ajouter un document officiel » pour déposer le premier cours ou cadre de référence officiel pour cette filière.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {driveDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="p-4 rounded-2xl bg-[#18191b] border border-[#282a2c] hover:border-sky-500/40 space-y-3 transition shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white truncate" title={doc.name}>
                          {doc.name}
                        </h4>
                        <div className="text-[10px] text-[#9aa0a6] flex items-center gap-2 mt-0.5">
                          <span className="px-1.5 py-0.2 rounded bg-[#202124] text-sky-300 font-semibold border border-[#3c4043]">
                            Officiel {doc.branch}
                          </span>
                          {doc.size && <span>{(doc.size / 1024).toFixed(1)} Ko</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {doc.webViewLink && (
                        <a
                          href={doc.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#202124] transition"
                          title="Ouvrir dans Google Drive"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handlePreviewDoc({ id: doc.id, name: doc.name, source: 'drive' })}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#202124] transition"
                        title="Aperçu du contenu"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDocToDelete({ id: doc.id, name: doc.name, source: 'drive' })}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition"
                        title="Supprimer de Google Drive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#282a2c] flex items-center justify-between text-[11px]">
                    <span className="text-[#8e918f]">Hébergé sur Google Drive</span>
                    {onAskQuestionAboutDoc && (
                      <button
                        type="button"
                        onClick={() => onAskQuestionAboutDoc(doc.name)}
                        className="text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1 transition"
                      >
                        <span>Interroger Si Driss</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: DOCUMENTS PERSONNELS DE L'ÉLÈVE (STOCKAGE LOCAL) */}
      {activeSection === 'local' && (
        <div className="space-y-5 animate-in fade-in">
          {/* Info Card */}
          <div className="bg-[#18191b] p-5 rounded-3xl border border-[#282a2c] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">
                    Coffre-fort Local de l'Élève : <span className="text-emerald-300">Filière {selectedBranch}</span>
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                    100% Hors-ligne & Privé
                  </span>
                </div>
                <p className="text-xs text-[#9aa0a6] mt-0.5">
                  Vos devoirs, fiches personnelles et résumés restent stockés sur votre navigateur sans aucun compte requis.
                </p>
              </div>
            </div>

            {/* Local backup export/import */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => exportVaultBackup()}
                className="px-3 py-1.5 rounded-xl border border-[#3c4043] bg-[#202124] hover:bg-[#282a2c] text-[#c4c7c5] hover:text-white text-xs font-semibold flex items-center gap-1.5 transition"
                title="Exporter une sauvegarde de vos documents locaux"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exporter JSON</span>
              </button>
              <input
                type="file"
                ref={importLocalFileInputRef}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const text = await file.text();
                    const count = await importVaultBackup(text);
                    setStatusMsg({ text: `${count} document(s) importé(s) avec succès !`, type: 'success' });
                    await refreshLocalDocs();
                  } catch (err: any) {
                    setStatusMsg({ text: `Erreur import : ${err?.message || ''}`, type: 'error' });
                  }
                }}
                accept=".json"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => importLocalFileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl border border-[#3c4043] bg-[#202124] hover:bg-[#282a2c] text-[#c4c7c5] hover:text-white text-xs font-semibold flex items-center gap-1.5 transition"
                title="Importer une sauvegarde"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Importer JSON</span>
              </button>
            </div>
          </div>

          {/* Action Bar for Student Local Storage */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#18191b] rounded-2xl border border-[#282a2c]">
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={localFileInputRef}
                onChange={handleLocalFileUpload}
                multiple
                accept=".pdf,.md,.txt"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => localFileInputRef.current?.click()}
                disabled={localUploading}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-md transition disabled:opacity-50"
              >
                <FileUp className="w-4 h-4" />
                <span>{localUploading ? 'Enregistrement…' : `Importer un fichier élève (${selectedBranch})`}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowCreateLocalModal(true)}
                className="px-3.5 py-2 rounded-xl bg-[#202124] hover:bg-[#282a2c] text-white border border-[#3c4043] font-bold text-xs flex items-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Rédiger une fiche</span>
              </button>
            </div>

            <button
              type="button"
              onClick={refreshLocalDocs}
              disabled={localLoading}
              className="p-2 rounded-xl border border-[#3c4043] bg-[#202124] hover:bg-[#282a2c] text-[#c4c7c5] hover:text-white transition"
              title="Actualiser les documents locaux"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${localLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Local documents grid */}
          {localLoading ? (
            <div className="py-16 text-center text-xs text-[#9aa0a6] flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
              Lecture des documents locaux ({selectedBranch})…
            </div>
          ) : localDocs.length === 0 ? (
            <div className="p-8 sm:p-12 text-center rounded-3xl bg-[#18191b]/70 border border-[#282a2c] space-y-2">
              <HardDrive className="w-10 h-10 text-[#8e918f] mx-auto opacity-30" />
              <h4 className="text-sm font-bold text-white">Aucun document élève enregistré pour {selectedBranch}</h4>
              <p className="text-xs text-[#9aa0a6] max-w-sm mx-auto">
                Importez vos énoncés d'exercices, résumés de cours ou fiches personnelles. Ils resteront stockés en toute sécurité dans votre navigateur.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {localDocs.map((doc) => (
                <div
                  key={doc.name}
                  className="p-4 rounded-2xl bg-[#18191b] border border-[#282a2c] hover:border-emerald-500/40 space-y-3 transition shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                        <FileCode className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white truncate" title={doc.name}>
                          {doc.name}
                        </h4>
                        <div className="text-[10px] text-[#9aa0a6] flex items-center gap-2 mt-0.5">
                          <span className="px-1.5 py-0.2 rounded bg-[#202124] text-emerald-300 font-semibold border border-[#3c4043]">
                            Élève {doc.branch || selectedBranch}
                          </span>
                          <span>{(doc.size / 1024).toFixed(1)} Ko</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handlePreviewDoc({ name: doc.name, content: doc.content, isPdf: doc.isPdf, source: 'local' })}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#202124] transition"
                        title="Aperçu du document"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDocToDelete({ id: doc.name, name: doc.name, source: 'local' })}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition"
                        title="Supprimer du coffre local"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#282a2c] flex items-center justify-between text-[11px]">
                    <span className="text-[#8e918f]">Stocké localement (IndexedDB)</span>
                    {onAskQuestionAboutDoc && (
                      <button
                        type="button"
                        onClick={() => onAskQuestionAboutDoc(doc.name, doc.content)}
                        className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 transition"
                      >
                        <span>Interroger Si Driss</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: PREVIEW DOCUMENT */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div
            ref={previewModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Aperçu du document"
            tabIndex={-1}
            className="bg-[#18191b] border border-[#3c4043] rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-[#282a2c] bg-[#1e1f20]">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-400" />
                <h3 className="font-bold text-white text-xs sm:text-sm truncate max-w-md">{previewDoc.name}</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#282a2c] text-[#c4c7c5]">
                  {previewDoc.source === 'drive' ? 'Google Drive (Prof)' : 'Stockage Local (Élève)'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {loadingPreview ? (
                <div className="py-12 text-center text-xs text-[#9aa0a6] flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
                  Chargement de l'aperçu…
                </div>
              ) : (
                <pre className="text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed bg-[#131314] p-4 rounded-2xl border border-[#282a2c]">
                  {previewDoc.content}
                </pre>
              )}
            </div>

            <div className="p-3 border-t border-[#282a2c] bg-[#1e1f20] flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 rounded-xl bg-[#282a2c] hover:bg-[#3c4043] text-white text-xs font-semibold"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRM DELETION (MANDATORY REQUIREMENT FOR WORKSPACE APIS) */}
      {docToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div
            ref={deleteModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Confirmation de suppression"
            tabIndex={-1}
            className="bg-[#18191b] border border-rose-500/30 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Confirmer la suppression</h3>
                <p className="text-[11px] text-slate-400">
                  {docToDelete.source === 'drive' ? 'Action sur Google Drive' : 'Action sur le stockage local'}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Êtes-vous sûr de vouloir supprimer définitivement le document{' '}
              <strong className="text-white font-mono">{docToDelete.name}</strong>{' '}
              {docToDelete.source === 'drive'
                ? `de votre dossier Google Drive (${FOLDER_NAMES[selectedBranch]}) ? Cette action est irréversible.`
                : `de votre stockage local ?`}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDocToDelete(null)}
                className="px-4 py-2 rounded-xl bg-[#282a2c] hover:bg-[#3c4043] text-[#c4c7c5] text-xs font-semibold transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-md"
              >
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CREATE LOCAL STUDENT DOCUMENT */}
      {showCreateLocalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div
            ref={createModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Créer une fiche élève locale"
            tabIndex={-1}
            className="bg-[#18191b] border border-[#3c4043] rounded-3xl w-full max-w-xl p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#282a2c] pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                Rédiger une fiche de révision locale ({selectedBranch})
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateLocalModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Nom du document (ex: resume_chute_verticale.md) :
                </label>
                <input
                  type="text"
                  value={newDocName}
                  onChange={(e) => setNewDocName(e.target.value)}
                  placeholder="mon_resume_rlc.md"
                  className="w-full bg-[#131314] border border-[#3c4043] rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Contenu (formules en $...$, notes, définitions) :
                </label>
                <textarea
                  rows={8}
                  value={newDocContent}
                  onChange={(e) => setNewDocContent(e.target.value)}
                  placeholder="# Résumé du chapitre&#10;- Équation différentielle : ...&#10;- Formule de la période propre : $T_0 = 2\pi\sqrt{LC}$&#10;- Piège à retenir : ..."
                  className="w-full bg-[#131314] border border-[#3c4043] rounded-xl p-3 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500 leading-relaxed"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#282a2c]">
              <button
                type="button"
                onClick={() => setShowCreateLocalModal(false)}
                className="px-4 py-2 rounded-xl bg-[#282a2c] hover:bg-[#3c4043] text-slate-300 text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleCreateLocalDocument}
                disabled={!newDocName.trim() || !newDocContent.trim()}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs disabled:opacity-40 transition"
              >
                Sauvegarder dans mon coffre local
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
