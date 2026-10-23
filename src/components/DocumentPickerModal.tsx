import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Search,
  CheckCircle,
  FolderOpen,
  Plus,
  RefreshCw,
  BookOpen,
} from 'lucide-react';
import { ChatAttachment } from './SessionManagerModal';

interface DocItem {
  name: string;
  size: number;
  preview: string;
}

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
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedDoc, setSelectedDoc] = useState<DocItem | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch('/api/documents')
      .then((res) => res.json())
      .then((data) => {
        setDocs(data.files || []);
        if (data.files && data.files.length > 0) {
          setSelectedDoc(data.files[0]);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredDocs = docs.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  const handlePick = async (doc: DocItem) => {
    try {
      // Fetch full content if it's a text/md doc
      let textContent = doc.preview;
      const res = await fetch(`/api/documents/file?name=${encodeURIComponent(doc.name)}`);
      if (res.ok) {
        const fullData = await res.json();
        if (fullData.content) {
          textContent = fullData.content;
        }
      }

      const attachment: ChatAttachment = {
        id: `doc_${Date.now()}`,
        name: doc.name,
        type: doc.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'text',
        mimeType: doc.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'text/plain',
        size: doc.size,
        text: textContent,
      };

      onSelectDoc(attachment);
      onClose();
    } catch {
      // Fallback with preview
      const attachment: ChatAttachment = {
        id: `doc_${Date.now()}`,
        name: doc.name,
        type: 'text',
        size: doc.size,
        text: doc.preview,
      };
      onSelectDoc(attachment);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Documents du Programme Officiel
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  /docs/programme/
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Attache un document ou un cadre de référence officiel pour que Si Driss s'y réfère.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 sm:p-4 border-b border-slate-800 bg-slate-950/30">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un cours, mémo ou cadre officiel..."
              className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* List & Preview */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-0">
          <div className="md:col-span-5 border-r border-slate-800 overflow-y-auto p-3 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-xs text-slate-400 gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                Chargement des documents...
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500">
                Aucun document trouvé.
              </div>
            ) : (
              filteredDocs.map((doc) => {
                const isSelected = selectedDoc?.name === doc.name;
                const isPdf = doc.name.toLowerCase().endsWith('.pdf');
                return (
                  <div
                    key={doc.name}
                    onClick={() => setSelectedDoc(doc)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-cyan-500/10 border-cyan-500/50 shadow-sm'
                        : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="p-2 rounded-lg bg-slate-800 text-cyan-400 shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-white truncate">{doc.name}</h4>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                          <span className="uppercase text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                            {isPdf ? 'PDF' : 'Texte'}
                          </span>
                          <span>{(doc.size / 1024).toFixed(1)} Ko</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="md:col-span-7 overflow-y-auto p-4 sm:p-5 flex flex-col bg-slate-950/40">
            {selectedDoc ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">{selectedDoc.name}</h3>
                  <div className="text-xs text-slate-400">
                    Taille : {(selectedDoc.size / 1024).toFixed(1)} Ko
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    Aperçu du contenu
                  </div>
                  <div className="text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap max-h-52 overflow-y-auto p-2 bg-slate-950/60 rounded-lg border border-slate-800/80">
                    {selectedDoc.preview || "Aperçu en cours d'indexation..."}
                  </div>
                </div>

                <button
                  onClick={() => handlePick(selectedDoc)}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  <span>Attacher ce document à ma question</span>
                </button>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
                Sélectionne un document pour le prévisualiser.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
