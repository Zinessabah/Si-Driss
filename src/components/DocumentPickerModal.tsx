import React, { useState, useEffect, useRef } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';
import {
  X,
  FileText,
  Search,
  CheckCircle,
  FolderOpen,
  Plus,
  RefreshCw,
  HardDrive,
  FileCode,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { ChatAttachment } from '../types/chat';
import { useBranch, StudentBranch } from '../hooks/useBranch';
import { getAllDocumentsFromVault, saveDocumentToVault, VaultDocument } from '../utils/documentVault';

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

  // Student local docs from IndexedDB
  const [localDocs, setLocalDocs] = useState<VaultDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<{
    name: string;
    size?: number;
    preview?: string;
    content?: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useModalA11y(isOpen, onClose);

  useEffect(() => {
    if (activeBranch) {
      setSelectedBranch(activeBranch);
    }
  }, [activeBranch]);

  const loadLocalDocs = async () => {
    setLoading(true);
    try {
      const vault = await getAllDocumentsFromVault(selectedBranch);
      setLocalDocs(vault);
    } catch (err) {
      console.warn('Erreur chargement documents locaux:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    loadLocalDocs();
  }, [isOpen, selectedBranch]);

  if (!isOpen) return null;

  const localItems = localDocs.map((d) => ({
    name: d.name,
    size: d.size,
    preview: d.content?.slice(0, 180) || 'Fiche personnelle enregistrée localement',
    content: d.content,
  }));

  const filteredItems = localItems.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  const handlePick = (item: typeof selectedItem) => {
    if (!item) return;

    const isPdf = item.name.toLowerCase().endsWith('.pdf');
    const attachment: ChatAttachment = {
      id: `doc_${Date.now()}`,
      name: item.name,
      type: isPdf ? 'pdf' : 'text',
      mimeType: isPdf ? 'application/pdf' : 'text/plain',
      size: item.size || 0,
      text: item.content || item.preview || '',
    };

    onSelectDoc(attachment);
    onClose();
  };

  const handleDeviceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const isPdf = file.name.toLowerCase().endsWith('.pdf');
      let textContent = '';

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

        textContent = `[Fichier PDF joint : ${file.name}]`;
      } else {
        textContent = await file.text();
        await saveDocumentToVault({
          name: file.name,
          isPdf: false,
          content: textContent,
          size: file.size,
          branch: selectedBranch,
        });
      }

      await loadLocalDocs();

      const attachment: ChatAttachment = {
        id: `doc_${Date.now()}`,
        name: file.name,
        type: isPdf ? 'pdf' : 'text',
        mimeType: isPdf ? 'application/pdf' : 'text/plain',
        size: file.size,
        text: textContent,
      };

      onSelectDoc(attachment);
      onClose();
    } catch (err: any) {
      console.warn('Erreur téléversement fichier local:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Joindre une fiche personnelle"
        tabIndex={-1}
        className="bg-[#18191b] border border-[#282a2c] rounded-3xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#282a2c] flex items-center justify-between bg-[#131314]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Joindre une Fiche ou un Document
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                  2BAC {selectedBranch}
                </span>
              </div>
              <p className="text-xs text-[#9aa0a6]">
                Vos documents personnels restent 100% privés dans votre navigateur.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#9aa0a6] hover:text-white rounded-xl hover:bg-[#202124] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Banner: RAG status */}
        <div className="bg-sky-950/30 border-b border-sky-500/20 px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-sky-200">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0" />
            <span>
              <strong>Référentiel Officiel 2BAC :</strong> Le programme officiel de Physique-Chimie et Sciences Maths est déjà indexé par Si Driss à chaque réponse.
            </span>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shrink-0 transition"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importer un fichier</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleDeviceUpload}
            accept=".pdf,.txt,.md"
            className="hidden"
          />
        </div>

        {/* Search */}
        <div className="p-3 sm:p-4 border-b border-[#282a2c] bg-[#131314]">
          <div className="relative">
            <Search className="w-4 h-4 text-[#8e918f] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher dans mes fiches personnelles…"
              className="w-full pl-9 pr-3 py-2 bg-[#18191b] border border-[#282a2c] rounded-xl text-xs text-white placeholder:text-[#8e918f] focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-0">
          {/* List column */}
          <div className="md:col-span-5 border-r border-[#282a2c] overflow-y-auto p-3 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-xs text-[#9aa0a6] gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                Chargement de vos fiches…
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-10 text-xs text-[#8e918f] space-y-2">
                <p>Aucune fiche trouvée dans votre coffre local ({selectedBranch}).</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-[#202124] hover:bg-[#282a2c] text-emerald-400 border border-[#3c4043] text-xs font-semibold inline-flex items-center gap-1.5 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter une fiche ou un PDF</span>
                </button>
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
                        ? 'bg-emerald-500/10 border-emerald-500/50 shadow-sm'
                        : 'bg-[#18191b] border-[#282a2c] hover:border-[#3c4043]'
                    }`}
                  >
                    <div className="p-2 rounded-xl shrink-0 bg-emerald-500/10 text-emerald-400">
                      {isPdf ? <FileText className="w-4 h-4" /> : <FileCode className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">{item.name}</h4>
                      <p className="text-[11px] text-[#9aa0a6] line-clamp-1 mt-0.5">{item.preview}</p>
                      {item.size && (
                        <span className="text-[10px] text-[#8e918f] mt-1 block">
                          {(item.size / 1024).toFixed(1)} Ko
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Preview column */}
          <div className="md:col-span-7 p-4 flex flex-col justify-between bg-[#141517] overflow-y-auto">
            {selectedItem ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <span>{selectedItem.name}</span>
                  </h3>
                  <p className="text-[11px] text-[#9aa0a6] mt-0.5">
                    Stocké localement sur cet appareil dans votre coffre IndexedDB.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#18191b] border border-[#282a2c] text-xs text-[#c4c7c5] max-h-60 overflow-y-auto whitespace-pre-wrap font-sans leading-relaxed">
                  {selectedItem.content || selectedItem.preview}
                </div>

                <div className="pt-3 border-t border-[#282a2c] flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedItem(null)}
                    className="px-3 py-1.5 rounded-xl text-xs text-[#9aa0a6] hover:text-white hover:bg-[#202124] transition"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePick(selectedItem)}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-md"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Joindre à ma question</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-xs text-[#8e918f] space-y-2">
                <FolderOpen className="w-8 h-8 opacity-40 text-emerald-400" />
                <p className="font-semibold text-white">Sélectionnez une fiche personnelle</p>
                <p className="max-w-xs text-[#9aa0a6]">
                  Cliquez sur un document à gauche pour en voir l'aperçu et le joindre à votre échange avec Si Driss.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
