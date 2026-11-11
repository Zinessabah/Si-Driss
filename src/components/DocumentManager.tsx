import React, { useState, useEffect, useRef } from 'react';
import {
  FolderOpen,
  FileText,
  Trash2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Plus,
  Eye,
  Download,
  HardDrive,
  ShieldCheck,
  X,
  ArrowRight,
  Search,
  File,
  FileUp,
  Key,
  BookOpen,
  Sparkles,
  Lock,
  Layers,
} from 'lucide-react';
import { useModalA11y } from '../hooks/useModalA11y';
import { useBranch, StudentBranch } from '../hooks/useBranch';
import { useApiKey, getAccessToken, getAdminToken, setAdminToken } from '../hooks/useApiKey';
import {
  saveDocumentToVault,
  removeDocumentFromVault,
  getAllDocumentsFromVault,
  VaultDocument,
  exportVaultBackup,
  importVaultBackup,
} from '../utils/documentVault';
import {
  syncDriveFolderWithServer,
  getStoredDriveFolder,
  setStoredDriveFolder,
  fetchServerDriveConfig,
  fetchRagStatus,
  fetchOfficialDocuments,
  syncOfficialDocuments,
  fetchOfficialSyncStatus,
  OfficialSyncJobStatus,
  listOfficialDriveDocuments,
  DriveDoc,
} from '../utils/googleDrive';

interface DocumentManagerProps {
  onAskQuestionAboutDoc?: (docName: string, content?: string) => void;
}

export const DocumentManager: React.FC<DocumentManagerProps> = ({ onAskQuestionAboutDoc }) => {
  const { branch: globalBranch } = useBranch();
  const { config: aiConfig } = useApiKey();
  const [selectedBranch, setSelectedBranch] = useState<StudentBranch>(globalBranch || 'PC');

  // Student local documents state (IndexedDB)
  const [localDocs, setLocalDocs] = useState<VaultDocument[]>([]);
  const [localLoading, setLocalLoading] = useState<boolean>(false);
  const [localUploading, setLocalUploading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Status notification banner
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Document preview state
  const [previewDoc, setPreviewDoc] = useState<{ name: string; content: string } | null>(null);

  // Deletion confirmation modal
  const [docToDelete, setDocToDelete] = useState<{ name: string } | null>(null);

  // Student new text doc modal
  const [showCreateLocalModal, setShowCreateLocalModal] = useState<boolean>(false);
  const [newDocName, setNewDocName] = useState<string>('');
  const [newDocContent, setNewDocContent] = useState<string>('');

  // RAG summary from server (safe for students)
  const [ragStatus, setRagStatus] = useState<{
    active: boolean;
    pcIndexed: boolean;
    smIndexed: boolean;
    totalIndexedFiles: number;
    visuallyDecodedCount?: number;
    syncSchedule?: string;
    nextSyncIso?: string | null;
    lastSyncIso?: string | null;
    message: string;
  }>({
    active: true,
    pcIndexed: false,
    smIndexed: false,
    totalIndexedFiles: 0,
    visuallyDecodedCount: 0,
    syncSchedule: 'twice_daily',
    nextSyncIso: null,
    lastSyncIso: null,
    message: 'Base RAG active',
  });

  // Admin section state (Developer only)
  const [adminTokenVal, setAdminTokenVal] = useState<string>(() => getAdminToken());
  const [isAdminMode, setIsAdminMode] = useState<boolean>(Boolean(getAdminToken()));
  const [showAdminLoginModal, setShowAdminLoginModal] = useState<boolean>(false);
  const [tempAdminInput, setTempAdminInput] = useState<string>('');
  const [driveFolderPC, setDriveFolderPC] = useState<string>(() => getStoredDriveFolder('PC'));
  const [driveFolderSM, setDriveFolderSM] = useState<string>(() => getStoredDriveFolder('SM'));
  const [isSyncingDrive, setIsSyncingDrive] = useState<boolean>(false);
  const [adminOfficialDocs, setAdminOfficialDocs] = useState<DriveDoc[]>([]);

  // Official documents state
  const [officialDocs, setOfficialDocs] = useState<DriveDoc[]>([]);
  const [isSyncingOfficial, setIsSyncingOfficial] = useState<boolean>(false);
  const [showOfficialList, setShowOfficialList] = useState<boolean>(false);

  const importLocalFileInputRef = useRef<HTMLInputElement | null>(null);
  const localFileInputRef = useRef<HTMLInputElement | null>(null);
  const syncPollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const stopSyncPolling = () => {
    if (syncPollTimerRef.current) {
      clearInterval(syncPollTimerRef.current);
      syncPollTimerRef.current = null;
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopSyncPolling();
    };
  }, []);

  const previewModalRef = useModalA11y(Boolean(previewDoc), () => setPreviewDoc(null));
  const deleteModalRef = useModalA11y(Boolean(docToDelete), () => setDocToDelete(null));
  const createModalRef = useModalA11y(showCreateLocalModal, () => setShowCreateLocalModal(false));
  const adminModalRef = useModalA11y(showAdminLoginModal, () => setShowAdminLoginModal(false));

  // Sync selected branch with global branch if changed
  useEffect(() => {
    if (globalBranch) {
      setSelectedBranch(globalBranch);
    }
  }, [globalBranch]);

  // Load safe RAG status
  useEffect(() => {
    fetchRagStatus().then(setRagStatus);
  }, []);

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

  // Load official documents for the active branch
  const refreshOfficialDocs = async () => {
    try {
      const docs = await fetchOfficialDocuments(selectedBranch);
      setOfficialDocs(docs);
    } catch (err) {
      console.warn('[OfficialDocs] Erreur chargement:', err);
    }
  };

  useEffect(() => {
    refreshOfficialDocs();
  }, [selectedBranch]);

  const formatSyncProgressText = (job: OfficialSyncJobStatus): string => {
    const base = job.message || 'Synchronisation des documents officiels en cours…';
    if (job.totalPdfs > 0 && !base.includes(`/${job.totalPdfs}`)) {
      return `${base} (${job.processedPdfs}/${job.totalPdfs})`;
    }
    return base;
  };

  const applySyncCompletion = async (job?: OfficialSyncJobStatus, fallbackMessage?: string) => {
    stopSyncPolling();
    if (!isMountedRef.current) return;

    try {
      const updatedRag = await fetchRagStatus();
      if (isMountedRef.current) setRagStatus(updatedRag);
      await refreshOfficialDocs();
    } catch (refreshErr) {
      console.warn('[OfficialDocs] Rafraîchissement post-sync incomplet:', refreshErr);
    }

    if (!isMountedRef.current) return;

    if (job?.phase === 'error') {
      setStatusMsg({
        text: job.message || job.lastError || 'Erreur lors de la synchronisation des documents officiels.',
        type: 'error',
      });
    } else if (job?.phase === 'partial_rate_limit') {
      setStatusMsg({
        text: job.message || fallbackMessage || 'Synchronisation partielle (limite de requêtes atteinte).',
        type: 'info',
      });
    } else {
      setStatusMsg({
        text: `✅ ${job?.message || fallbackMessage || 'Documents officiels synchronisés avec succès !'}`,
        type: 'success',
      });
    }
    setIsSyncingOfficial(false);
  };

  // Synchronisation des documents officiels téléchargés et ré-indexation du RAG (tâche de fond cadencée)
  const handleSyncOfficialDocs = async () => {
    stopSyncPolling();
    setIsSyncingOfficial(true);
    setStatusMsg(null);
    try {
      const res = await syncOfficialDocuments(
        selectedBranch,
        adminTokenVal,
        aiConfig.apiKey,
        aiConfig.provider
      );

      if (res.syncJob?.running) {
        setStatusMsg({
          text: formatSyncProgressText(res.syncJob),
          type: 'info',
        });

        let consecutivePollErrors = 0;
        let pollInFlight = false;

        syncPollTimerRef.current = setInterval(async () => {
          if (pollInFlight || !isMountedRef.current) return;
          pollInFlight = true;
          try {
            const statusRes = await fetchOfficialSyncStatus();
            consecutivePollErrors = 0;
            if (!isMountedRef.current) return;

            const job = statusRes.syncJob;
            if (job?.running) {
              setStatusMsg({
                text: formatSyncProgressText(job),
                type: 'info',
              });
            } else {
              await applySyncCompletion(job, res.message);
            }
          } catch (pollErr: any) {
            consecutivePollErrors += 1;
            if (consecutivePollErrors >= 3) {
              stopSyncPolling();
              if (isMountedRef.current) {
                setIsSyncingOfficial(false);
                setStatusMsg({
                  text: `Erreur suivi de synchronisation : ${pollErr?.message || 'Connexion interrompue'}`,
                  type: 'error',
                });
              }
            }
          } finally {
            pollInFlight = false;
          }
        }, 3000);
        return;
      }

      await applySyncCompletion(res.syncJob, res.message);
    } catch (err: any) {
      stopSyncPolling();
      if (isMountedRef.current) {
        setStatusMsg({
          text: `Erreur synchronisation documents officiels : ${err?.message || 'Erreur inconnue'}`,
          type: 'error',
        });
        setIsSyncingOfficial(false);
      }
    }
  };

  // Prévisualisation d'un document officiel (avec son décodage visuel de schémas & graphes)
  const handlePreviewOfficialDoc = async (docName: string) => {
    try {
      const headers: Record<string, string> = {};
      const accessTokenVal = getAccessToken();
      if (accessTokenVal) headers['x-access-token'] = accessTokenVal;
      if (adminTokenVal) headers['x-admin-token'] = adminTokenVal;
      const res = await fetch(`/api/documents/file?name=${encodeURIComponent(docName)}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setPreviewDoc({
          name: data.name,
          content: data.content || 'Contenu en cours de traitement.',
        });
      } else {
        // En mode public, affiche la description extraite publique ou informe
        setStatusMsg({
          text: `Document "${docName}" indexé dans le RAG. Pour afficher l'intégralité du texte brut, activez le mode Enseignant.`,
          type: 'info',
        });
      }
    } catch {
      setStatusMsg({ text: 'Erreur lors du chargement du document.', type: 'error' });
    }
  };

  // If Admin mode is active, load drive config and official docs
  useEffect(() => {
    if (isAdminMode && adminTokenVal) {
      fetchServerDriveConfig(adminTokenVal).then((cfg) => {
        if (cfg.folderPc) setDriveFolderPC(cfg.folderPc);
        if (cfg.folderSm) setDriveFolderSM(cfg.folderSm);
      });
      listOfficialDriveDocuments(selectedBranch, adminTokenVal).then(setAdminOfficialDocs);
    }
  }, [isAdminMode, adminTokenVal, selectedBranch]);

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
        text: `💾 ${count} document(s) enregistré(s) dans votre classeur local (${selectedBranch}) !`,
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
        text: `Fiche personnelle "${cleanName}" créée avec succès dans votre classeur local !`,
        type: 'success',
      });
      setShowCreateLocalModal(false);
      setNewDocName('');
      setNewDocContent('');
      await refreshLocalDocs();
    } catch (err: any) {
      setStatusMsg({
        text: `Erreur création fiche : ${err?.message || 'Erreur'}`,
        type: 'error',
      });
    }
  };

  // Delete local doc
  const handleConfirmDelete = async () => {
    if (!docToDelete) return;
    setStatusMsg(null);

    try {
      await removeDocumentFromVault(docToDelete.name);
      setStatusMsg({ text: `Document "${docToDelete.name}" supprimé de votre classeur.`, type: 'info' });
      await refreshLocalDocs();
    } catch (err: any) {
      setStatusMsg({
        text: `Impossible de supprimer le document : ${err?.message || 'Erreur'}`,
        type: 'error',
      });
    } finally {
      setDocToDelete(null);
    }
  };

  // Export local backup
  const handleExportBackup = async () => {
    try {
      await exportVaultBackup();
      setStatusMsg({ text: 'Classeur exporté avec succès (sauvegarde locale JSON).', type: 'success' });
    } catch (err: any) {
      setStatusMsg({ text: `Échec export : ${err?.message || 'Erreur'}`, type: 'error' });
    }
  };

  // Import local backup
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const count = await importVaultBackup(file);
      setStatusMsg({
        text: `Sauvegarde importée avec succès : ${count} fiche(s) restaurée(s) !`,
        type: 'success',
      });
      await refreshLocalDocs();
    } catch (err: any) {
      setStatusMsg({ text: `Erreur importation : ${err?.message || 'Erreur'}`, type: 'error' });
    } finally {
      if (importLocalFileInputRef.current) importLocalFileInputRef.current.value = '';
    }
  };

  // Admin login submit
  const handleSaveAdminToken = () => {
    const clean = tempAdminInput.trim();
    if (clean) {
      setAdminToken(clean);
      setAdminTokenVal(clean);
      setIsAdminMode(true);
      setShowAdminLoginModal(false);
      setStatusMsg({ text: 'Mode Administrateur activé avec succès.', type: 'success' });
    }
  };

  // Admin Drive sync action
  const handleAdminSyncBranch = async (branchToSync: 'PC' | 'SM') => {
    const folder = branchToSync === 'PC' ? driveFolderPC : driveFolderSM;
    if (!folder.trim()) {
      setStatusMsg({ text: `Veuillez spécifier l'identifiant du dossier Drive pour ${branchToSync}.`, type: 'error' });
      return;
    }

    setIsSyncingDrive(true);
    setStatusMsg(null);

    try {
      const res = await syncDriveFolderWithServer(folder, branchToSync, adminTokenVal);
      setStatusMsg({ text: `[Admin ${branchToSync}] ${res.message}`, type: res.success ? 'success' : 'info' });
      const updatedDocs = await listOfficialDriveDocuments(selectedBranch, adminTokenVal);
      setAdminOfficialDocs(updatedDocs);
      const updatedRag = await fetchRagStatus();
      setRagStatus(updatedRag);
    } catch (err: any) {
      setStatusMsg({ text: `Erreur synchro admin : ${err?.message || 'Erreur'}`, type: 'error' });
    } finally {
      setIsSyncingDrive(false);
    }
  };

  const filteredLocalDocs = localDocs.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 max-w-6xl mx-auto w-full">
      {/* Top Header */}
      <div className="bg-[#18191b] p-5 sm:p-6 rounded-3xl border border-[#282a2c] shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
              <FolderOpen className="w-4 h-4" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide">
              Mon Classeur & Fiches de Révision
            </h2>
          </div>
          <p className="text-xs text-[#9aa0a6] max-w-2xl leading-relaxed">
            Vos fiches de cours, exercices et résumés restent <strong>100% privés</strong> dans le stockage de votre navigateur (IndexedDB). L'IA Si Driss utilise en parallèle le <strong>Référentiel National officiel (RAG)</strong> pour valider toutes vos démarches.
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

      {/* RAG Knowledge Base Status Banner (Official Cadre de Référence) */}
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-sky-950/40 via-[#18191b] to-purple-950/40 border border-[#282a2c] flex flex-col gap-3 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">
                  Référentiel Officiel du Ministère (RAG Actif)
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                  Synchronisé & Protégé
                </span>
              </div>
              <p className="text-xs text-[#9aa0a6] mt-1 max-w-3xl leading-relaxed">
                {selectedBranch === 'SM'
                  ? 'Si Driss valide vos réponses selon le barème officiel Sciences Mathématiques (Rotation solide autour d’un axe fixe, oscillations forcées & impédance Z, résonance aiguë).'
                  : 'Si Driss valide vos réponses selon le barème officiel Sciences Physiques (Modulation d’amplitude AM, chute verticale avec méthode d’Euler, circuits RC/RL/RLC).'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 self-end sm:self-center">
            <span className="text-[11px] text-[#8e918f] font-mono bg-[#131314] px-3 py-1.5 rounded-xl border border-[#282a2c]">
              Filière active : <strong>2BAC {selectedBranch}</strong>
            </span>

            <button
              type="button"
              onClick={handleSyncOfficialDocs}
              disabled={isSyncingOfficial}
              className="px-3.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 active:scale-95 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-sm"
              title="Synchroniser et ré-indexer les documents officiels téléchargés"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingOfficial ? 'animate-spin' : ''}`} />
              <span>{isSyncingOfficial ? 'Synchronisation…' : 'Synchroniser les documents officiels'}</span>
            </button>
          </div>
        </div>

        {/* Section documents officiels téléchargés */}
        <div className="pt-2 border-t border-[#282a2c]/60 flex flex-col gap-2 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap items-center gap-2 text-[#9aa0a6]">
              <BookOpen className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>
                <strong className="text-white">{officialDocs.length}</strong> document(s) officiel(s) téléchargé(s) pour 2BAC {selectedBranch}
              </span>
              {ragStatus.visuallyDecodedCount ? (
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-semibold flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-purple-400" />
                  {ragStatus.visuallyDecodedCount} avec graphes & schémas décodés
                </span>
              ) : null}
            </div>
            {officialDocs.length > 0 && (
              <button
                type="button"
                onClick={() => setShowOfficialList((prev) => !prev)}
                className="text-xs text-sky-400 hover:text-sky-300 font-semibold underline transition"
              >
                {showOfficialList ? 'Masquer la liste' : 'Voir les documents officiels'}
              </button>
            )}
          </div>

          {showOfficialList && officialDocs.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 animate-in fade-in">
              {officialDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="p-2.5 rounded-xl bg-[#131314]/80 border border-[#282a2c] flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span className="text-xs text-white font-medium truncate" title={doc.name}>
                      {doc.name}
                    </span>
                    {doc.hasVisuals && (
                      <span
                        className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[9px] font-semibold flex items-center gap-1 shrink-0"
                        title="Schémas de circuits et graphes expérimentaux transcrits et décodés par l'IA"
                      >
                        <Sparkles className="w-2.5 h-2.5 text-purple-400" />
                        Graphes décodés
                      </span>
                    )}
                    {doc.size ? (
                      <span className="text-[10px] text-[#8e918f] shrink-0 font-mono">
                        ({(doc.size / (1024 * 1024)).toFixed(1) === '0.0'
                          ? `${(doc.size / 1024).toFixed(1)} Ko`
                          : `${(doc.size / (1024 * 1024)).toFixed(1)} Mo`})
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handlePreviewOfficialDoc(doc.name)}
                      className="p-1 rounded-lg text-[#9aa0a6] hover:text-white hover:bg-[#202124] transition"
                      title="Consulter le contenu et le décodage du document"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {onAskQuestionAboutDoc && (
                      <button
                        type="button"
                        onClick={() => onAskQuestionAboutDoc(doc.name)}
                        className="text-[11px] text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1 transition px-1.5 py-0.5 rounded-lg hover:bg-sky-500/10"
                        title="Poser une question à Si Driss sur ce document officiel"
                      >
                        <span>Interroger</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
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

      {/* STUDENT PERSONAL WORKSPACE */}
      <div className="space-y-4">
        {/* Actions Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8e918f] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Rechercher dans mes fiches personnelles (${selectedBranch})…`}
              className="w-full bg-[#18191b] border border-[#282a2c] rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-[#8e918f] focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowCreateLocalModal(true)}
              className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Créer une fiche</span>
            </button>

            <button
              type="button"
              onClick={() => localFileInputRef.current?.click()}
              disabled={localUploading}
              className="px-3.5 py-2 rounded-xl bg-[#202124] hover:bg-[#282a2c] text-[#c4c7c5] hover:text-white border border-[#3c4043] font-semibold text-xs flex items-center gap-1.5 transition"
              title="Importer un fichier PDF ou texte depuis votre appareil"
            >
              <FileUp className="w-4 h-4 text-emerald-400" />
              <span>Importer un PDF</span>
            </button>
            <input
              type="file"
              ref={localFileInputRef}
              onChange={handleLocalFileUpload}
              accept=".pdf,.txt,.md"
              multiple
              className="hidden"
            />

            <button
              type="button"
              onClick={handleExportBackup}
              className="p-2 rounded-xl bg-[#202124] hover:bg-[#282a2c] text-[#c4c7c5] hover:text-white border border-[#3c4043] transition"
              title="Sauvegarder tout mon classeur en JSON"
            >
              <Download className="w-4 h-4 text-sky-400" />
            </button>

            <button
              type="button"
              onClick={() => importLocalFileInputRef.current?.click()}
              className="p-2 rounded-xl bg-[#202124] hover:bg-[#282a2c] text-[#c4c7c5] hover:text-white border border-[#3c4043] transition"
              title="Restaurer une sauvegarde de classeur"
            >
              <HardDrive className="w-4 h-4 text-amber-400" />
            </button>
            <input
              type="file"
              ref={importLocalFileInputRef}
              onChange={handleImportBackup}
              accept=".json"
              className="hidden"
            />
          </div>
        </div>

        {/* Documents Grid / Empty State */}
        {localLoading ? (
          <div className="py-16 text-center text-xs text-[#9aa0a6] flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
            Chargement de vos fiches…
          </div>
        ) : filteredLocalDocs.length === 0 ? (
          <div className="p-8 sm:p-12 text-center rounded-3xl bg-[#18191b] border border-[#282a2c] space-y-3">
            <File className="w-10 h-10 text-[#8e918f] mx-auto opacity-40" />
            <h4 className="text-sm font-bold text-white">
              {searchQuery
                ? 'Aucune fiche ne correspond à votre recherche.'
                : `Votre classeur 2BAC ${selectedBranch} est vide`}
            </h4>
            <p className="text-xs text-[#9aa0a6] max-w-md mx-auto leading-relaxed">
              Créez vos fiches de révision personnelles ou déposez vos cours et devoirs scannés en PDF avec les boutons <strong>« Créer une fiche »</strong> ou <strong>« Importer un PDF »</strong> ci-dessus. Vos documents restent entièrement privés dans votre navigateur.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredLocalDocs.map((doc) => (
              <div
                key={doc.name}
                className="p-4 rounded-2xl bg-[#18191b] border border-[#282a2c] hover:border-emerald-500/40 space-y-3 transition shadow-md flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate" title={doc.name}>
                        {doc.name}
                      </h4>
                      <div className="text-[10px] text-[#9aa0a6] flex items-center gap-2 mt-0.5">
                        <span className="px-1.5 py-0.2 rounded font-semibold bg-emerald-950/40 text-emerald-300 border border-emerald-500/30">
                          Classeur {selectedBranch}
                        </span>
                        {doc.size && <span>{(doc.size / 1024).toFixed(1)} Ko</span>}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPreviewDoc({ name: doc.name, content: doc.content || `Fichier PDF (${doc.name})` })}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#202124] transition"
                      title="Lire / Aperçu"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDocToDelete({ name: doc.name })}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition"
                      title="Supprimer de mon classeur"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#282a2c] flex items-center justify-between text-[11px]">
                  <span className="text-[#8e918f] flex items-center gap-1">
                    <HardDrive className="w-3 h-3 text-emerald-400" />
                    Local (100% privé)
                  </span>
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

      {/* FOOTER: DISCRETE ADMIN SECTION FOR DEVELOPER ONLY */}
      <div className="pt-6 border-t border-[#282a2c] flex flex-col items-center justify-center">
        {!isAdminMode ? (
          <button
            type="button"
            onClick={() => setShowAdminLoginModal(true)}
            className="text-[11px] text-[#5f6368] hover:text-[#9aa0a6] flex items-center gap-1.5 transition py-1"
          >
            <Lock className="w-3 h-3" />
            <span>Administration RAG (Enseignant / Développeur)</span>
          </button>
        ) : (
          <div className="w-full bg-[#141517] border border-[#282a2c] rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Key className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Espace Enseignant / Développeur (RAG Backend)</h4>
                  <p className="text-[10px] text-[#8e918f]">
                    Ces réglages sont invisibles pour les élèves. Synchronisez vos dossiers Google Drive vers le RAG.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setAdminToken('');
                  setAdminTokenVal('');
                  setIsAdminMode(false);
                }}
                className="text-[11px] text-rose-400 hover:underline"
              >
                Verrouiller
              </button>
            </div>

            {/* Local Repository Status */}
            <div className="p-3.5 bg-[#18191b] rounded-2xl border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                <div>
                  <span className="font-bold text-white">Architecture RAG 100% Locale & Étanche : </span>
                  <span className="text-[#9aa0a6]">2 dossiers séparés (PC et SM) sans dossier commun</span>
                </div>
              </div>
              <div className="text-[11px] text-emerald-400 font-mono bg-[#131314] px-2.5 py-1 rounded-lg border border-[#282a2c] shrink-0">
                /docs/programme/PC/ & /docs/programme/SM/
              </div>
            </div>

            {/* Folder Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="p-3.5 bg-[#18191b] rounded-2xl border border-sky-500/30 space-y-1.5">
                <span className="text-xs font-bold text-sky-400">📁 Répertoire Local 2BAC PC</span>
                <p className="text-[11px] text-[#9aa0a6] leading-relaxed">
                  Déposez vos PDF et résumés PC dans <code className="text-white bg-black/40 px-1 py-0.5 rounded">docs/programme/PC/</code>. L'indexation s'effectue une seule fois avec mise en cache instantanée.
                </p>
              </div>

              <div className="p-3.5 bg-[#18191b] rounded-2xl border border-purple-500/30 space-y-1.5">
                <span className="text-xs font-bold text-purple-400">📁 Répertoire Local 2BAC SM</span>
                <p className="text-[11px] text-[#9aa0a6] leading-relaxed">
                  Déposez vos PDF et résumés SM dans <code className="text-white bg-black/40 px-1 py-0.5 rounded">docs/programme/SM/</code>. Séparation totale pour adapter le niveau d'exigence mathématique.
                </p>
              </div>
            </div>

            {/* Sync Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="p-3 bg-[#18191b] rounded-2xl border border-[#282a2c] space-y-2">
                <span className="text-xs font-bold text-sky-400">Dossier Google Drive 2BAC PC</span>
                <input
                  type="text"
                  value={driveFolderPC}
                  onChange={(e) => {
                    setDriveFolderPC(e.target.value);
                    setStoredDriveFolder('PC', e.target.value);
                  }}
                  placeholder="Lien ou ID du dossier Drive PC..."
                  className="w-full bg-[#131314] border border-[#282a2c] rounded-xl px-3 py-1.5 text-xs text-white"
                />
                <button
                  type="button"
                  onClick={() => handleAdminSyncBranch('PC')}
                  disabled={isSyncingDrive}
                  className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDrive ? 'animate-spin' : ''}`} />
                  <span>Synchroniser PC vers RAG</span>
                </button>
              </div>

              <div className="p-3 bg-[#18191b] rounded-2xl border border-[#282a2c] space-y-2">
                <span className="text-xs font-bold text-purple-400">Dossier Google Drive 2BAC SM</span>
                <input
                  type="text"
                  value={driveFolderSM}
                  onChange={(e) => {
                    setDriveFolderSM(e.target.value);
                    setStoredDriveFolder('SM', e.target.value);
                  }}
                  placeholder="Lien ou ID du dossier Drive SM..."
                  className="w-full bg-[#131314] border border-[#282a2c] rounded-xl px-3 py-1.5 text-xs text-white"
                />
                <button
                  type="button"
                  onClick={() => handleAdminSyncBranch('SM')}
                  disabled={isSyncingDrive}
                  className="px-3 py-1.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs flex items-center gap-1.5 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDrive ? 'animate-spin' : ''}`} />
                  <span>Synchroniser SM vers RAG</span>
                </button>
              </div>
            </div>

            <p className="text-[10px] text-[#8e918f]">
              💡 <em>Astuce : Vous pouvez aussi lancer la synchronisation directement en ligne de commande avec : <code className="text-white bg-black/40 px-1 py-0.5 rounded">npm run sync-drive</code></em>
            </p>
          </div>
        )}
      </div>

      {/* CREATE NEW TEXT DOCUMENT MODAL */}
      {showCreateLocalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div
            ref={createModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Créer une fiche de révision"
            tabIndex={-1}
            className="bg-[#18191b] border border-[#282a2c] rounded-3xl w-full max-w-2xl p-5 sm:p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#282a2c] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Nouvelle Fiche de Révision (2BAC {selectedBranch})</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateLocalModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#c4c7c5] block mb-1">Titre de la fiche</label>
                <input
                  type="text"
                  value={newDocName}
                  onChange={(e) => setNewDocName(e.target.value)}
                  placeholder="Ex: Fiche_Lois_Newton_Mvt_Plan.md"
                  className="w-full bg-[#131314] border border-[#282a2c] rounded-xl px-3.5 py-2 text-xs text-white placeholder-[#8e918f] focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#c4c7c5] block mb-1">
                  Contenu (Texte ou Markdown avec formules KaTeX)
                </label>
                <textarea
                  rows={8}
                  value={newDocContent}
                  onChange={(e) => setNewDocContent(e.target.value)}
                  placeholder="Écrivez votre cours, vos formules (ex: $F = m \cdot a$) ou vos notes personnelles..."
                  className="w-full bg-[#131314] border border-[#282a2c] rounded-xl p-3 text-xs text-white placeholder-[#8e918f] focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateLocalModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-[#9aa0a6] hover:text-white transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleCreateLocalDocument}
                disabled={!newDocName.trim() || !newDocContent.trim()}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition shadow-md"
              >
                Enregistrer dans mon classeur
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW DOCUMENT MODAL */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div
            ref={previewModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Aperçu du document"
            tabIndex={-1}
            className="bg-[#18191b] border border-[#282a2c] rounded-3xl w-full max-w-3xl max-h-[80vh] flex flex-col p-5 sm:p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#282a2c] pb-3 mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white truncate max-w-md">{previewDoc.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-[#131314] border border-[#282a2c] rounded-2xl p-4 text-xs text-[#c4c7c5] whitespace-pre-wrap font-sans leading-relaxed">
              {previewDoc.content}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 mt-3 border-t border-[#282a2c]">
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 rounded-xl bg-[#202124] text-xs text-white font-semibold hover:bg-[#282a2c] transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {docToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div
            ref={deleteModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Confirmation suppression"
            tabIndex={-1}
            className="bg-[#18191b] border border-[#282a2c] rounded-3xl w-full max-w-md p-5 sm:p-6 space-y-4 shadow-2xl"
          >
            <h3 className="text-sm font-bold text-white">Supprimer ce document ?</h3>
            <p className="text-xs text-[#9aa0a6] leading-relaxed">
              Voulez-vous vraiment retirer « <strong>{docToDelete.name}</strong> » de votre classeur personnel ? Cette action est irréversible.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDocToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs text-[#9aa0a6] hover:text-white transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition shadow-md"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN LOGIN MODAL */}
      {showAdminLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div
            ref={adminModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Connexion Enseignant / Développeur"
            tabIndex={-1}
            className="bg-[#18191b] border border-[#282a2c] rounded-3xl w-full max-w-md p-5 sm:p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#282a2c] pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Accès Enseignant / Développeur</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminLoginModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#9aa0a6] leading-relaxed">
              Saisissez votre jeton administrateur (variable <code className="text-amber-400">ADMIN_TOKEN</code> du serveur) pour gérer la synchronisation Google Drive.
            </p>

            <div>
              <input
                type="password"
                value={tempAdminInput}
                onChange={(e) => setTempAdminInput(e.target.value)}
                placeholder="Jeton ADMIN_TOKEN..."
                className="w-full bg-[#131314] border border-[#282a2c] rounded-xl px-3.5 py-2 text-xs text-white placeholder-[#8e918f] focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAdminLoginModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-[#9aa0a6] hover:text-white transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveAdminToken}
                disabled={!tempAdminInput.trim()}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition shadow-md"
              >
                Déverrouiller
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
