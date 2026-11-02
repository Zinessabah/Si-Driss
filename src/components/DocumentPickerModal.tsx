import React, { useState, useEffect } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';
import {
  X,
  FileText,
  Search,
  CheckCircle,
  FolderOpen,
  Plus,
  RefreshCw,
  BookOpen,
  Cloud,
  HardDrive,
  FileCode,
} from 'lucide-react';
import { ChatAttachment } from '../types/chat';
import { useBranch, StudentBranch } from '../hooks/useBranch';
import { getAllDocumentsFromVault, VaultDocument } from '../utils/documentVault';
import {
  listOfficialDriveDocuments,
  downloadDriveDocumentText,
  getDriveAccessToken,
  DriveDoc,
} from '../utils/googleDrive';

interface DocumentPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDoc: (attachment: ChatAttachment) => void;
}

export const DocumentPickerModal: React.FC<DocumentPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectDoc,
}) => {
  const { branch: activeBranch } = useBranch();
  const [selectedBranch, setSelectedBranch] = useState<StudentBranch>(activeBranch || 'PC');
  const [source, setSource] = useState<'drive' | 'local'>('drive');

  // Official docs (Drive + Server fallback)
  const [driveDocs, setDriveDocs] = useState<DriveDoc[]>([]);
  const [serverDocs, setServerDocs] = useState<any[]>([]);

  // Student local docs
  const [localDocs, setLocalDocs] = useState<VaultDocument[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<{
    id?: string;
    name: string;
    size?: number;
    preview?: string;
    source: 'drive' | 'local';
    content?: string;
  } | null>(null);

  const dialogRef = useModalA11y(isOpen, onClose);

  useEffect(() => {
    if (activeBranch) {
      setSelectedBranch(activeBranch);
    }
  }, [activeBranch]);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);

    const loadAll = async () => {
      try {
        // 1. Load Local Student Docs
        const vault = await getAllDocumentsFromVault(selectedBranch);
        if (isMounted) setLocalDocs(vault);

        // 2. Load Google Drive Docs if authenticated
        if (getDriveAccessToken()) {
          const driveList = await listOfficialDriveDocuments(selectedBranch);
          if (isMounted) setDriveDocs(driveList);
        } else {
          if (isMounted) setDriveDocs([]);
        }

        // 3. Load Server fallback docs
        const res = await fetch('/api/documents');
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setServerDocs(data.files || []);
        }
      } catch (err) {
        console.warn('Erreur chargement documents pour modal:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadAll();

    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedBranch]);

  if (!isOpen) return null;

  // Filter server official docs based on branch
  const filteredServerDocs = serverDocs.filter((f) => {
    const nameLower = (f.name || '').toLowerCase();
    const isSm = nameLower.includes('_sm') || nameLower.includes('-sm') || nameLower.includes('sm.');
    const isPc = nameLower.includes('_pc') || nameLower.includes('-pc') || nameLower.includes('pc.');
    if (selectedBranch === 'PC' && isSm && !isPc) return false;
    if (selectedBranch === 'SM' && isPc && !isSm) return false;
    return true;
  });

  // Items to show based on source tab
  const officialItems = [
    ...driveDocs.map((d) => ({
      id: d.id,
      name: d.name,
      size: d.size,
      preview: `Document officiel hébergé sur Google Drive (${d.branch})`,
      source: 'drive' as const,
    })),
    ...filteredServerDocs.map((f) => ({
      id: undefined,
      name: f.name,
      size: f.size,
      preview: f.preview || 'Référentiel officiel du programme',
      source: 'drive' as const,
    })),
  ];

  const localItems = localDocs.map((d) => ({
    id: d.name,
    name: d.name,
    size: d.size,
    preview: d.content?.slice(0, 150) || 'Document enregistré dans votre coffre local',
    source: 'local' as const,
    content: d.content,
  }));

  const currentItems = source === 'drive' ? officialItems : localItems;
  const filteredItems = currentItems.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  const handlePick = async (item: typeof selectedItem) => {
    if (!item) return;

    try {
      let textContent = item.preview || '';

      if (item.source === 'drive' && item.id) {
        try {
          textContent = await downloadDriveDocumentText(item.id);
        } catch {
          textContent = `[Document Google Drive: ${item.name}]\nFilière: ${selectedBranch}`;
        }
      } else if (item.source === 'local') {
        textContent = item.content || item.preview || '';
      } else {
        // Server doc
        const res = await fetch(`/api/documents/file?name=${encodeURIComponent(item.name)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.content) textContent = data.content;
        }
      }

      const attachment: ChatAttachment = {
        id: `doc_${Date.now()}`,
        name: item.name,
        type: item.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'text',
        mimeType: item.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'text/plain',
        size: item.size || 0,
        text: textContent,
      };

      onSelectDoc(attachment);
      onClose();
    } catch (err) {
      console.warn('Erreur sélection doc:', err);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Choisir un document du programme"
        tabIndex={-1}
        className="bg-[#18191b] border border-[#282a2c] rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#282a2c] flex items-center justify-between bg-[#131314]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Sélectionner un Document de Référence
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                  Filière {selectedBranch}
                </span>
              </div>
              <p className="text-xs text-[#9aa0a6]">
                Attachez un document officiel (Google Drive) ou une fiche personnelle (Local) pour que Si Driss s'y réfère.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Branch toggle */}
            <div className="hidden sm:flex items-center gap-1 bg-[#1e1f20] p-1 rounded-xl border border-[#282a2c]">
              <button
                type="button"
                onClick={() => setSelectedBranch('PC')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  selectedBranch === 'PC'
                    ? 'bg-sky-500 text-slate-950'
                    : 'text-[#9aa0a6] hover:text-white'
                }`}
              >
                PC
              </button>
              <button
                type="button"
                onClick={() => setSelectedBranch('SM')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  selectedBranch === 'SM'
                    ? 'bg-purple-500 text-white'
                    : 'text-[#9aa0a6] hover:text-white'
                }`}
              >
                SM
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-[#9aa0a6] hover:text-white rounded-xl hover:bg-[#202124] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Source Tabs: Google Drive vs Local Vault */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#282a2c] bg-[#16171a]">
          <button
            type="button"
            onClick={() => {
              setSource('drive');
              setSelectedItem(null);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
              source === 'drive'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                : 'text-[#9aa0a6] hover:text-white hover:bg-[#202124]'
            }`}
          >
            <Cloud className="w-4 h-4 text-sky-400" />
            <span>Documents Officiels (Google Drive — {selectedBranch})</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-sky-500/20 text-sky-300">
              {officialItems.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSource('local');
              setSelectedItem(null);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
              source === 'local'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-[#9aa0a6] hover:text-white hover:bg-[#202124]'
            }`}
          >
            <HardDrive className="w-4 h-4 text-emerald-400" />
            <span>Mes Documents Locaux (Élève — {selectedBranch})</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300">
              {localItems.length}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="p-3 sm:p-4 border-b border-[#282a2c] bg-[#131314]">
          <div className="relative">
            <Search className="w-4 h-4 text-[#8e918f] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Rechercher un document ${source === 'drive' ? 'officiel' : 'local'} de la filière ${selectedBranch}…`}
              className="w-full pl-9 pr-3 py-2 bg-[#18191b] border border-[#282a2c] rounded-xl text-xs text-white placeholder:text-[#8e918f] focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Main 2-Columns */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-0">
          {/* List column */}
          <div className="md:col-span-5 border-r border-[#282a2c] overflow-y-auto p-3 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-xs text-[#9aa0a6] gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                Chargement des documents…
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-10 text-xs text-[#8e918f]">
                Aucun document trouvé pour la filière {selectedBranch} dans cet onglet.
              </div>
            ) : (
              filteredItems.map((item) => {
                const isSelected = selectedItem?.name === item.name;
                const isPdf = item.name.toLowerCase().endsWith('.pdf');
                return (
                  <div
                    key={item.name}
                    onClick={() => setSelectedItem(item)}
                    className={`p-3 rounded-2xl border cursor-pointer transition flex items-start gap-2.5 ${
                      isSelected
                        ? source === 'drive'
                          ? 'bg-sky-500/10 border-sky-500/50 shadow-sm'
                          : 'bg-emerald-500/10 border-emerald-500/50 shadow-sm'
                        : 'bg-[#18191b] border-[#282a2c] hover:border-[#3c4043]'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-xl shrink-0 ${
                        source === 'drive' ? 'bg-sky-500/10 text-sky-400' : 'bg-emerald-500/10 text-emerald-400'
                      }`}
                    >
                      {isPdf ? <FileText className="w-4 h-4" /> : <FileCode className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">{item.name}</h4>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-[#9aa0a6]">
                        <span className="uppercase font-bold px-1.5 py-0.2 rounded bg-[#202124] text-[#c4c7c5]">
                          {isPdf ? 'PDF' : 'Texte'}
                        </span>
                        {item.size ? <span>{(item.size / 1024).toFixed(1)} Ko</span> : null}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Preview column */}
          <div className="md:col-span-7 overflow-y-auto p-4 sm:p-5 flex flex-col bg-[#131314]">
            {selectedItem ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">{selectedItem.name}</h3>
                  <div className="text-xs text-[#9aa0a6] flex items-center gap-2">
                    <span>Source : {selectedItem.source === 'drive' ? 'Google Drive (Professeur)' : 'Stockage Local (Élève)'}</span>
                    <span>•</span>
                    <span>Filière {selectedBranch}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#18191b] border border-[#282a2c] space-y-2">
                  <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    Aperçu du document
                  </div>
                  <div className="text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto p-3 bg-[#131314] rounded-xl border border-[#282a2c]">
                    {selectedItem.content || selectedItem.preview || "Aperçu en cours d'indexation..."}
                  </div>
                </div>

                <button
                  onClick={() => handlePick(selectedItem)}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  <span>Attacher ce document à ma question</span>
                </button>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-[#8e918f]">
                Sélectionnez un document à gauche pour en voir l'aperçu.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
