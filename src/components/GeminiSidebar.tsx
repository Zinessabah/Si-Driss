import React, { useState, useMemo } from 'react';
import {
  Plus,
  MessageSquare,
  ShieldCheck,
  Zap,
  BookOpen,
  AlertTriangle,
  FolderOpen,
  Key,
  Trash2,
  X,
  Smartphone,
  ChevronRight,
  ChevronDown,
  GraduationCap,
  Pencil,
  Check,
  Search,
} from 'lucide-react';
import { SavedSession } from '../types/chat';

interface GeminiSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: 'chat' | 'audit' | 'simulators' | 'formulas' | 'pitfalls' | 'documents';
  onSelectTab: (tab: 'chat' | 'audit' | 'simulators' | 'formulas' | 'pitfalls' | 'documents') => void;
  onNewChat: () => void;
  currentSessionId: string | null;
  onLoadSession: (session: SavedSession) => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession?: (sessionId: string, newTitle: string) => void;
  savedSessions: SavedSession[];
  branch: 'PC' | 'SM';
  onOpenBranchModal: () => void;
  onOpenApiKeyModal: () => void;
  onOpenInstallModal?: () => void;
  hasApiKey: boolean;
}

export const GeminiSidebar: React.FC<GeminiSidebarProps> = ({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  onNewChat,
  currentSessionId,
  onLoadSession,
  onDeleteSession,
  onRenameSession,
  savedSessions,
  branch,
  onOpenBranchModal,
  onOpenApiKeyModal,
  onOpenInstallModal,
  hasApiKey,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [isToolsOpen, setIsToolsOpen] = useState<boolean>(true);

  const tools = [
    {
      id: 'audit' as const,
      name: 'Audit de Rédaction',
      desc: 'Barème Examen National',
      icon: ShieldCheck,
      color: 'text-amber-400',
    },
    {
      id: 'simulators' as const,
      name: 'Laboratoires Virtuels',
      desc: 'RLC, AM, Mécanique, Titrage',
      icon: Zap,
      color: 'text-sky-400',
    },
    {
      id: 'formulas' as const,
      name: 'Mémento & Formules',
      desc: 'Cadre de Référence 2BAC',
      icon: BookOpen,
      color: 'text-emerald-400',
    },
    {
      id: 'pitfalls' as const,
      name: 'Pièges du National',
      desc: 'Flashcards des erreurs fatales',
      icon: AlertTriangle,
      color: 'text-rose-400',
    },
    {
      id: 'documents' as const,
      name: 'Mon Classeur & Fiches',
      desc: 'Fiches perso & RAG Officiel',
      icon: FolderOpen,
      color: 'text-purple-400',
    },
  ];

  // Regroupement chronologique des discussions façon Gemini (Aujourd'hui, Hier, 7 derniers jours, etc.)
  const groupedSessions = useMemo(() => {
    // Trier par date la plus récente en premier
    const sorted = [...savedSessions].sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    const filtered = searchQuery.trim()
      ? sorted.filter((s) => s.title.toLowerCase().includes(searchQuery.toLowerCase().trim()))
      : sorted;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const startOfYesterday = startOfToday - oneDayMs;
    const startOf7Days = startOfToday - 7 * oneDayMs;
    const startOf30Days = startOfToday - 30 * oneDayMs;

    const today: SavedSession[] = [];
    const yesterday: SavedSession[] = [];
    const last7Days: SavedSession[] = [];
    const last30Days: SavedSession[] = [];
    const older: SavedSession[] = [];

    for (const session of filtered) {
      const time = new Date(session.updatedAt || session.createdAt || 0).getTime();
      if (isNaN(time) || time >= startOfToday) {
        today.push(session);
      } else if (time >= startOfYesterday) {
        yesterday.push(session);
      } else if (time >= startOf7Days) {
        last7Days.push(session);
      } else if (time >= startOf30Days) {
        last30Days.push(session);
      } else {
        older.push(session);
      }
    }

    const groups = [
      { label: "Aujourd'hui", sessions: today },
      { label: 'Hier', sessions: yesterday },
      { label: '7 derniers jours', sessions: last7Days },
      { label: '30 derniers jours', sessions: last30Days },
      { label: 'Plus ancien', sessions: older },
    ];

    return groups.filter((g) => g.sessions.length > 0);
  }, [savedSessions, searchQuery]);

  const handleStartRename = (session: SavedSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditTitle(session.title);
  };

  const handleSaveRename = (sessionId: string) => {
    if (onRenameSession && editTitle.trim()) {
      onRenameSession(sessionId, editTitle.trim());
    }
    setEditingSessionId(null);
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`ios-safe-header fixed md:static inset-y-0 left-0 z-50 flex flex-col w-72 bg-[#17181c] border-r border-[#282a2c] text-[#e3e3e3] transition-transform duration-300 ease-in-out pb-[max(env(safe-area-inset-bottom,0px),0.5rem)] ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0 md:overflow-hidden md:border-r-0'
        }`}
      >
        {/* Header: New Chat CTA */}
        <div className="p-3 border-b border-[#282a2c]/60 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onNewChat();
              if (window.innerWidth < 768) onClose();
            }}
            className="flex-1 flex items-center gap-3 px-3.5 py-2.5 rounded-full bg-[#202124] hover:bg-[#282a2c] text-[#e3e3e3] hover:text-white text-xs font-semibold transition border border-[#3c4043]/50 shadow-sm group"
          >
            <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-blue-500 via-purple-500 to-amber-400 flex items-center justify-center text-slate-950 font-black shrink-0">
              <Plus className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="truncate">Nouvelle discussion</span>
          </button>

          {/* Close drawer button on mobile */}
          <button
            type="button"
            onClick={onClose}
            className="md:hidden p-2 rounded-full hover:bg-[#282a2c] text-slate-400 hover:text-white transition"
            title="Fermer le menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Middle: Chat History & Exam Tools */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4 text-xs no-scrollbar">
          {/* SEARCH BAR (Visible si plus de 3 discussions) */}
          {savedSessions.length > 3 && (
            <div className="relative pt-1">
              <Search className="w-3.5 h-3.5 text-[#8e918f] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher une discussion..."
                className="w-full bg-[#202124] text-xs text-white placeholder:text-[#8e918f] pl-8 pr-7 py-1.5 rounded-xl border border-[#282a2c] focus:border-[#8ab4f8] outline-none transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8e918f] hover:text-white p-0.5"
                  title="Effacer la recherche"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* HISTORIQUE DES DISCUSSIONS (Style Gemini) */}
          <div>
            <div className="px-2 pb-1 text-[11px] font-semibold text-[#8e918f] uppercase tracking-wider flex items-center justify-between">
              <span>Historique des discussions</span>
              <span className="text-[10px] text-[#8e918f] font-mono px-1.5 py-0.2 rounded-full bg-[#202124]">
                {savedSessions.length}
              </span>
            </div>

            {savedSessions.length === 0 ? (
              <div className="px-3 py-6 text-center space-y-2">
                <div className="w-8 h-8 rounded-full bg-[#202124] text-[#8e918f] flex items-center justify-center mx-auto">
                  <MessageSquare className="w-4 h-4 text-[#8ab4f8]" />
                </div>
                <div className="text-xs text-[#c4c7c5] font-medium">Aucune discussion enregistrée</div>
                <div className="text-[11px] text-[#8e918f] leading-relaxed">
                  Posez votre première question à Si Driss. Vos échanges s'archiveront automatiquement ici comme sur Gemini.
                </div>
              </div>
            ) : groupedSessions.length === 0 ? (
              <div className="px-2 py-4 text-[11px] text-[#8e918f] italic text-center">
                Aucune discussion ne correspond à "{searchQuery}".
              </div>
            ) : (
              <div className="space-y-3">
                {groupedSessions.map((group) => (
                  <div key={group.label} className="space-y-0.5">
                    <div className="px-2.5 pt-2 pb-1 text-[10px] font-semibold text-[#8e918f] tracking-wide uppercase">
                      {group.label}
                    </div>

                    {group.sessions.map((session) => {
                      const isActive = activeTab === 'chat' && currentSessionId === session.id;
                      const isEditing = editingSessionId === session.id;

                      return (
                        <div
                          key={session.id}
                          className={`group flex items-center justify-between rounded-xl px-2.5 py-1.5 transition text-xs relative ${
                            isActive
                              ? 'bg-[#282a2c] text-white font-medium shadow-xs border border-[#3c4043]/40'
                              : 'text-[#c4c7c5] hover:bg-[#202124] hover:text-[#e3e3e3]'
                          }`}
                        >
                          {isEditing ? (
                            <div className="flex items-center gap-1.5 w-full py-0.5">
                              <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveRename(session.id);
                                  if (e.key === 'Escape') setEditingSessionId(null);
                                }}
                                autoFocus
                                className="flex-1 bg-[#1e1f20] text-xs text-white px-2 py-1 rounded-lg border border-[#8ab4f8] outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveRename(session.id)}
                                className="p-1 rounded-md text-emerald-400 hover:bg-[#3c4043] transition"
                                title="Valider"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingSessionId(null)}
                                className="p-1 rounded-md text-[#8e918f] hover:text-white hover:bg-[#3c4043] transition"
                                title="Annuler"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  onLoadSession(session);
                                  onSelectTab('chat');
                                  if (window.innerWidth < 768) onClose();
                                }}
                                className="flex-1 flex items-center gap-2.5 text-left truncate pr-1 py-0.5"
                                title={session.title}
                              >
                                <MessageSquare
                                  className={`w-3.5 h-3.5 shrink-0 ${
                                    isActive ? 'text-[#8ab4f8]' : 'text-[#8e918f] group-hover:text-[#c4c7c5]'
                                  }`}
                                />
                                <span className="truncate text-xs">{session.title}</span>
                              </button>

                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={(e) => handleStartRename(session, e)}
                                  className="p-1 rounded-md hover:bg-[#3c4043] text-[#8e918f] hover:text-[#8ab4f8] transition"
                                  title="Renommer la discussion"
                                  aria-label={`Renommer ${session.title}`}
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm(`Supprimer la discussion "${session.title}" ?`)) {
                                      onDeleteSession(session.id);
                                    }
                                  }}
                                  className="p-1 rounded-md hover:bg-[#3c4043] text-[#8e918f] hover:text-rose-400 transition"
                                  title="Supprimer cette discussion"
                                  aria-label={`Supprimer ${session.title}`}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* OUTILS D'EXAMEN NATIONAL (Section dépliable) */}
          <div className="pt-2 border-t border-[#282a2c]/60">
            <button
              type="button"
              onClick={() => setIsToolsOpen(!isToolsOpen)}
              className="w-full px-2 py-1 text-[11px] font-semibold text-[#8e918f] uppercase tracking-wider flex items-center justify-between hover:text-[#e3e3e3] transition group"
            >
              <span className="flex items-center gap-1.5">
                <span>Outils & Révision</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#202124] text-[#8e918f] font-mono">
                  {tools.length}
                </span>
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 text-[#8e918f] group-hover:text-white ${
                  isToolsOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isToolsOpen && (
              <div className="space-y-0.5 mt-1.5">
                {tools.map((t) => {
                  const Icon = t.icon;
                  const isActive = activeTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        onSelectTab(t.id);
                        if (window.innerWidth < 768) onClose();
                      }}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-left transition ${
                        isActive
                          ? 'bg-[#282a2c] text-white font-medium'
                          : 'text-[#c4c7c5] hover:bg-[#202124] hover:text-[#e3e3e3]'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${t.color}`} />
                      <div className="flex-1 truncate">
                        <div className="text-xs truncate">{t.name}</div>
                        <div className="text-[10px] text-[#8e918f] truncate">{t.desc}</div>
                      </div>
                      {isActive && <ChevronRight className="w-3.5 h-3.5 text-[#8ab4f8] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer: Filière Switcher & API Key */}
        <div className="p-3 border-t border-[#282a2c]/60 space-y-2 bg-[#17181c]">
          {/* Filière Switcher */}
          <button
            type="button"
            onClick={onOpenBranchModal}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#202124] hover:bg-[#282a2c] text-xs transition border border-[#282a2c]"
          >
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-amber-400" />
              <span className="font-semibold text-slate-200">
                2ème Bac {branch === 'SM' ? 'Sciences Maths (SM)' : 'Sciences Physiques (PC)'}
              </span>
            </div>
            <span className="text-[10px] text-amber-400 underline">Changer</span>
          </button>

          {/* Install Mobile App Button */}
          {onOpenInstallModal && (
            <button
              type="button"
              onClick={onOpenInstallModal}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#202124] hover:bg-[#282a2c] text-xs transition border border-[#282a2c]"
            >
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span className="text-slate-200">Installer l'Application</span>
              </div>
              <span className="text-[10px] text-[#8e918f]">iPhone / Android</span>
            </button>
          )}

          {/* API Key Status Pill */}
          <button
            type="button"
            onClick={onOpenApiKeyModal}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#202124] hover:bg-[#282a2c] text-xs transition border border-[#282a2c]"
          >
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-[#8ab4f8]" />
              <span className="text-slate-200">Clé API Gemini</span>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                hasApiKey
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-300 border border-amber-500/20 animate-pulse'
              }`}
            >
              {hasApiKey ? 'Active' : 'Configurer'}
            </span>
          </button>
        </div>
      </aside>
    </>
  );
};
