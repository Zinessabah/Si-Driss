import React, { useState, useRef } from 'react';
import {
  Save,
  Download,
  Upload,
  FolderOpen,
  Trash2,
  Plus,
  Clock,
  MessageSquare,
  CheckCircle,
  AlertTriangle,
  X,
  FileText,
  Copy,
  ExternalLink,
  Bookmark,
} from 'lucide-react';

export interface ChatAttachment {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'text' | 'exercise' | 'document';
  mimeType?: string;
  data?: string; // base64 Data URL or raw base64
  text?: string;
  size?: number;
  previewUrl?: string;
  exerciseId?: string;
  chapter?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode?: 'socratic' | 'direct' | 'review' | 'trap';
  timestamp: string;
  attachments?: ChatAttachment[];
}

export interface SavedSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  socraticEnabled: boolean;
  coachingMode: 'socratic' | 'direct' | 'review' | 'trap';
}

interface SessionManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMessages: ChatMessage[];
  socraticEnabled: boolean;
  coachingMode: 'socratic' | 'direct' | 'review' | 'trap';
  savedSessions: SavedSession[];
  currentSessionId: string | null;
  onLoadSession: (session: SavedSession) => void;
  onSaveCurrentSession: (customTitle?: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  onImportSessions: (imported: SavedSession[]) => void;
}

export const SessionManagerModal: React.FC<SessionManagerModalProps> = ({
  isOpen,
  onClose,
  currentMessages,
  socraticEnabled,
  coachingMode,
  savedSessions,
  currentSessionId,
  onLoadSession,
  onSaveCurrentSession,
  onNewSession,
  onDeleteSession,
  onImportSessions,
}) => {
  const [sessionTitleInput, setSessionTitleInput] = useState('');
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [activeTab, setActiveTab] = useState<'sessions' | 'export' | 'import'>('sessions');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Derive a smart default title from the first student message
  const firstUserMsg = currentMessages.find((m) => m.role === 'user');
  const defaultTitle =
    firstUserMsg?.content.slice(0, 45).replace(/\n/g, ' ') ||
    `Session du ${new Date().toLocaleDateString('fr-FR')} (${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })})`;

  const handleSaveActive = () => {
    const finalTitle = sessionTitleInput.trim() || defaultTitle;
    onSaveCurrentSession(finalTitle);
    setSessionTitleInput('');
  };

  // Export current session as clean Markdown revision sheet
  const handleExportMarkdown = (sessionToExport?: SavedSession) => {
    const msgs = sessionToExport ? sessionToExport.messages : currentMessages;
    const title = sessionToExport ? sessionToExport.title : sessionTitleInput.trim() || defaultTitle;
    const dateStr = sessionToExport
      ? new Date(sessionToExport.createdAt).toLocaleDateString('fr-FR')
      : new Date().toLocaleDateString('fr-FR');

    let md = `# 📘 Fiche de Révision Physique-Chimie 2ème BAC BIOF\n`;
    md += `**Sujet / Session :** ${title}\n`;
    md += `**Date :** ${dateStr}\n`;
    md += `**Professeur Référent :** Si Driss (Spécialiste Examen National Maroc)\n`;
    md += `**Programme :** 2ème Année Baccalauréat - Sciences Physiques / SVT / SM\n\n`;
    md += `---\n\n`;

    msgs.forEach((m, idx) => {
      if (m.id === 'welcome') return;
      if (m.role === 'user') {
        md += `### ❓ Question de l'élève (Question #${idx})\n`;
        if (m.attachments && m.attachments.length > 0) {
          md += `📎 **Documents / Exercices joints :** ${m.attachments.map((a) => a.name).join(', ')}\n\n`;
        }
        md += `> ${m.content.replace(/\n/g, '\n> ')}\n\n`;
      } else {
        md += `### 👨‍🏫 Réponse & Guidage de Si Driss\n`;
        md += `${m.content}\n\n`;
        md += `---\n\n`;
      }
    });

    md += `\n*Fiche générée automatiquement depuis l'application Si Driss - 2ème Bac PC BIOF Maroc.*\n`;

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `revision_${title.toLowerCase().replace(/[^a-z0-9]/gi, '_')}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export session as JSON backup
  const handleExportJSON = (sessionToExport?: SavedSession) => {
    const dataToExport = sessionToExport
      ? sessionToExport
      : {
          id: currentSessionId || `session_${Date.now()}`,
          title: sessionTitleInput.trim() || defaultTitle,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: currentMessages,
          socraticEnabled,
          coachingMode,
        };

    const jsonString = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sauvegarde_si_driss_${dataToExport.title.toLowerCase().replace(/[^a-z0-9]/gi, '_')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export all saved sessions at once
  const handleExportAllSessionsJSON = () => {
    const backup = {
      app: 'Si Driss - 2eme Bac PC BIOF',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      sessionsCount: savedSessions.length,
      sessions: savedSessions,
    };

    const jsonString = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_complet_sessions_si_driss_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Copy full chat text to clipboard
  const handleCopyToClipboard = () => {
    let text = `--- SESSION SI DRISS (2ème BAC BIOF) ---\n\n`;
    currentMessages.forEach((m) => {
      const sender = m.role === 'assistant' ? 'Si Driss' : 'Élève';
      text += `[${m.timestamp}] ${sender}:\n${m.content}\n\n`;
    });

    navigator.clipboard.writeText(text);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2500);
  };

  // Handle JSON file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        let sessionsToAdd: SavedSession[] = [];
        if (Array.isArray(parsed.sessions)) {
          sessionsToAdd = parsed.sessions;
        } else if (parsed.messages && Array.isArray(parsed.messages)) {
          sessionsToAdd = [parsed as SavedSession];
        } else {
          alert("Format de fichier non reconnu. Veuillez sélectionner un fichier .json exporté depuis l'application.");
          return;
        }

        onImportSessions(sessionsToAdd);
        alert(`Succès : ${sessionsToAdd.length} session(s) restaurée(s) !`);
        setActiveTab('sessions');
      } catch (err) {
        console.error('Import error:', err);
        alert('Erreur lors de la lecture du fichier JSON.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Modal Header */}
        <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Historique & Sauvegardes de Sessions
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                  {savedSessions.length} enregistrée(s)
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Garde tes discussions avec Si Driss, sauvegarde tes fiches et reprends tes révisions à tout moment.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 bg-slate-950/60 border-b border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('sessions')}
            className={`pb-2.5 px-3 font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'sessions'
                ? 'border-amber-500 text-amber-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            Mes Sessions ({savedSessions.length})
          </button>

          <button
            onClick={() => setActiveTab('export')}
            className={`pb-2.5 px-3 font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'export'
                ? 'border-amber-500 text-amber-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Download className="w-4 h-4" />
            Exporter la session active
          </button>

          <button
            onClick={() => setActiveTab('import')}
            className={`pb-2.5 px-3 font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'import'
                ? 'border-amber-500 text-amber-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Upload className="w-4 h-4" />
            Restaurer un fichier de backup
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'sessions' && (
            <>
              {/* Quick Save Current Session Section */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Save className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-bold text-white">Sauvegarder la session en cours</h3>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Sauvegarde auto active
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <input
                    type="text"
                    value={sessionTitleInput}
                    onChange={(e) => setSessionTitleInput(e.target.value)}
                    placeholder={`Titre : "${defaultTitle}"`}
                    className="w-full sm:flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={handleSaveActive}
                      className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Enregistrer</span>
                    </button>

                    <button
                      onClick={() => {
                        if (confirm('Voulez-vous commencer une nouvelle session ? La session en cours sera archivée dans vos sauvegardes.')) {
                          onNewSession();
                          onClose();
                        }
                      }}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all"
                      title="Commencer une discussion vierge"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-400" />
                      <span>Nouveau chat</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Saved Sessions List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Sessions archivées ({savedSessions.length})
                  </h3>
                  {savedSessions.length > 0 && (
                    <button
                      onClick={handleExportAllSessionsJSON}
                      className="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      Exporter toutes les sessions (.json)
                    </button>
                  )}
                </div>

                {savedSessions.length === 0 ? (
                  <div className="text-center py-10 px-4 rounded-xl border border-dashed border-slate-800 bg-slate-950/40">
                    <MessageSquare className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-400 font-semibold">Aucune session enregistrée pour le moment</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Clique sur "Enregistrer" ci-dessus pour archiver ta discussion actuelle avec Si Driss.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {savedSessions.map((session) => {
                      const isCurrent = session.id === currentSessionId;
                      const userMsgCount = session.messages.filter((m) => m.role === 'user').length;

                      return (
                        <div
                          key={session.id}
                          className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isCurrent
                              ? 'bg-amber-500/10 border-amber-500/40 text-white'
                              : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 text-slate-200'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-xs text-white">{session.title}</span>
                              {isCurrent && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-slate-950">
                                  En cours
                                </span>
                              )}
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400">
                                {userMsgCount} question{userMsgCount > 1 ? 's' : ''}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-[11px] text-slate-400">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-500" />
                                {new Date(session.updatedAt || session.createdAt).toLocaleDateString('fr-FR', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              <span>•</span>
                              <span>Mode : {session.socraticEnabled ? 'Socratique' : 'Direct'}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 self-end sm:self-auto">
                            {!isCurrent && (
                              <button
                                onClick={() => {
                                  onLoadSession(session);
                                  onClose();
                                }}
                                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all flex items-center gap-1 shadow-sm"
                                title="Reprendre cette discussion"
                              >
                                <FolderOpen className="w-3.5 h-3.5" />
                                <span>Charger</span>
                              </button>
                            )}

                            <button
                              onClick={() => handleExportMarkdown(session)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
                              title="Télécharger en fiche de révision (.md)"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleExportJSON(session)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
                              title="Télécharger la sauvegarde (.json)"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => {
                                if (confirm(`Supprimer la session "${session.title}" ?`)) {
                                  onDeleteSession(session.id);
                                }
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950 hover:text-red-400 text-slate-400 transition-all"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'export' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  Exporter la discussion actuelle
                </h3>
                <p className="text-xs text-slate-400">
                  Choisis le format qui te convient pour conserver tes notes de cours, tes formules et les conseils de Si Driss.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Export Markdown */}
                <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 hover:border-amber-500/50 transition-all space-y-3">
                  <div className="flex items-center gap-2 text-amber-400">
                    <FileText className="w-5 h-5" />
                    <h4 className="font-bold text-xs text-white">Fiche de Révision (Markdown .md)</h4>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Mise en page prête à être lue, imprimée ou importée dans Notion / Obsidian / Word avec les formules mathématiques KaTeX.
                  </p>
                  <button
                    onClick={() => handleExportMarkdown()}
                    className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Télécharger la fiche (.md)</span>
                  </button>
                </div>

                {/* Export JSON Backup */}
                <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 hover:border-amber-500/50 transition-all space-y-3">
                  <div className="flex items-center gap-2 text-cyan-400">
                    <Download className="w-5 h-5" />
                    <h4 className="font-bold text-xs text-white">Sauvegarde Complète (.json)</h4>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Format technique contenant tous les messages, le mode de guidage et les métadonnées pour pouvoir restaurer la session plus tard sur n'importe quel appareil.
                  </p>
                  <button
                    onClick={() => handleExportJSON()}
                    className="w-full py-2 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Télécharger la sauvegarde (.json)</span>
                  </button>
                </div>
              </div>

              {/* Quick Copy to Clipboard */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-white">Copier toute la discussion</h4>
                  <p className="text-[11px] text-slate-400">Copie l'intégralité du texte dans ton presse-papier.</p>
                </div>
                <button
                  onClick={handleCopyToClipboard}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  {copiedNotification ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400">Copié !</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-400" />
                      <span>Copier le texte</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'import' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Upload className="w-4 h-4 text-amber-400" />
                  Restaurer une sauvegarde de session
                </h3>
                <p className="text-xs text-slate-400">
                  Sélectionne un fichier de sauvegarde <code>.json</code> téléchargé précédemment pour recharger tes questions et les explications de Si Driss.
                </p>
              </div>

              <div className="p-8 border-2 border-dashed border-slate-800 hover:border-amber-500/50 rounded-2xl bg-slate-950/40 text-center space-y-3 transition-colors">
                <Upload className="w-10 h-10 text-amber-400 mx-auto" />
                <div>
                  <p className="text-xs font-bold text-white">Glisse ton fichier .json ici ou clique pour parcourir</p>
                  <p className="text-[11px] text-slate-500 mt-1">Fichiers acceptés : .json (exporté depuis Si Driss)</p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  className="hidden"
                  id="session-file-input"
                />

                <label
                  htmlFor="session-file-input"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer shadow-md transition-all"
                >
                  <Upload className="w-4 h-4" />
                  <span>Choisir un fichier de sauvegarde (.json)</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Toutes vos sessions sont conservées en mémoire locale sécurisée sur votre navigateur.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
