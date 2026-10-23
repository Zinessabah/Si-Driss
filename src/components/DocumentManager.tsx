import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { MathView } from './MathView';

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
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // New text file creation modal/form
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newFileName, setNewFileName] = useState<string>('');
  const [newFileContent, setNewFileContent] = useState<string>('');
  const [previewContent, setPreviewContent] = useState<{ name: string; content: string } | null>(null);
  const [copiedPath, setCopiedPath] = useState<boolean>(false);

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

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    setUploading(true);
    setStatusMsg(null);

    try {
      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        let bodyPayload: { filename: string; content?: string; base64?: string } = { filename: file.name };

        if (file.name.toLowerCase().endsWith('.pdf')) {
          const arrayBuffer = await file.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          // Convert in chunks to prevent callstack limits
          const chunkSize = 8192;
          for (let b = 0; b < bytes.byteLength; b += chunkSize) {
            const chunk = bytes.subarray(b, Math.min(b + chunkSize, bytes.byteLength));
            binary += String.fromCharCode.apply(null, Array.from(chunk));
          }
          bodyPayload.base64 = btoa(binary);
        } else {
          bodyPayload.content = await file.text();
        }

        const res = await fetch('/api/documents/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload),
        });

        if (!res.ok) throw new Error(`Erreur lors de l'upload de ${file.name}`);
      }

      setStatusMsg({
        text: `Fichier(s) indexé(s) avec succès dans /docs/programme/ ! Si Driss y a accès immédiatement.`,
        type: 'success',
      });
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
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: finalName,
          content: newFileContent,
        }),
      });

      if (res.ok) {
        setStatusMsg({ text: `Document "${finalName}" enregistré et indexé avec succès !`, type: 'success' });
        setShowCreateModal(false);
        setNewFileName('');
        setNewFileContent('');
        await fetchDocuments();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (filename: string) => {
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setFiles((prev) => prev.filter((f) => f.name !== filename));
        setStatusMsg({ text: `Le document "${filename}" a été supprimé de /docs/programme/.`, type: 'success' });
      }
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

  return (
    <div className="space-y-6">
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
              <span>Téléverser des fichiers (.pdf, .md, .txt)</span>
              <input
                type="file"
                multiple
                accept=".pdf,.md,.txt,.json,.csv"
                onChange={handleFileUpload}
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
            💡 <strong>Pourquoi les réponses deviennent instantanées ?</strong> Lorsque des documents sont présents dans ce répertoire, Si Driss extrait immédiatement le paragraphe exact au lieu de réfléchir de zéro. Le streaming mot-par-mot évite toute latence.
          </div>
        </div>

        {statusMsg && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              statusMsg.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
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
            onClick={fetchDocuments}
            disabled={loading}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors text-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Chargement des documents du répertoire...
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-4 p-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-400" />
                Créer un document dans /docs/programme/
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
