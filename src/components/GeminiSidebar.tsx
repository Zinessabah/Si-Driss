import React from 'react';
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
  Sparkles,
  Smartphone,
  ChevronRight,
  GraduationCap,
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
  savedSessions,
  branch,
  onOpenBranchModal,
  onOpenApiKeyModal,
  onOpenInstallModal,
  hasApiKey,
}) => {
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
      name: 'Documents du Programme',
      desc: 'Fichiers officiels /docs',
      icon: FolderOpen,
      color: 'text-purple-400',
    },
  ];

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
            onClick={() => {
              onNewChat();
              if (window.innerWidth < 768) onClose();
            }}
            className="flex-1 flex items-center gap-3 px-3.5 py-2.5 rounded-full bg-[#202124] hover:bg-[#282a2c] text-[#e3e3e3] text-xs font-semibold transition border border-[#3c4043]/50 shadow-sm group"
          >
            <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-blue-500 via-purple-500 to-amber-400 flex items-center justify-center text-slate-950 font-black shrink-0">
              <Plus className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="truncate">Nouvelle discussion</span>
          </button>

          {/* Close drawer button on mobile */}
          <button
            onClick={onClose}
            className="md:hidden p-2 rounded-full hover:bg-[#282a2c] text-slate-400 hover:text-white transition"
            title="Fermer le menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Middle: Recent Chats & Tools */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5 text-xs no-scrollbar">
          {/* Recent Conversations */}
          <div>
            <div className="px-2 pb-1.5 text-[11px] font-semibold text-[#8e918f] uppercase tracking-wider flex items-center justify-between">
              <span>Récent</span>
              <span className="text-[10px] text-[#8e918f] font-mono">
                {savedSessions.length}
              </span>
            </div>

            {savedSessions.length === 0 ? (
              <div className="px-2 py-3 text-[11px] text-[#8e918f] italic">
                Aucune discussion archivée. Vos échanges s'enregistrent ici automatiquement.
              </div>
            ) : (
              <div className="space-y-0.5">
                {savedSessions.slice(0, 15).map((session) => {
                  const isActive = activeTab === 'chat' && currentSessionId === session.id;
                  return (
                    <div
                      key={session.id}
                      className={`group flex items-center justify-between rounded-xl px-2.5 py-2 transition text-xs ${
                        isActive
                          ? 'bg-[#282a2c] text-white font-medium'
                          : 'text-[#c4c7c5] hover:bg-[#202124] hover:text-[#e3e3e3]'
                      }`}
                    >
                      <button
                        onClick={() => {
                          onLoadSession(session);
                          onSelectTab('chat');
                          if (window.innerWidth < 768) onClose();
                        }}
                        className="flex-1 flex items-center gap-2.5 text-left truncate pr-1"
                        title={session.title}
                      >
                        <MessageSquare className="w-3.5 h-3.5 shrink-0 text-[#8ab4f8]" />
                        <span className="truncate">{session.title}</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Supprimer la discussion "${session.title}" ?`)) {
                            onDeleteSession(session.id);
                          }
                        }}
                        className="opacity-60 group-hover:opacity-100 focus:opacity-100 p-1 rounded-md hover:bg-[#3c4043] text-[#8e918f] hover:text-rose-400 transition"
                        title="Supprimer cette discussion"
                        aria-label={`Supprimer la discussion ${session.title}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Outils d'Examen National (Gemini Extensions style) */}
          <div className="pt-2 border-t border-[#282a2c]/60">
            <div className="px-2 pb-1.5 text-[11px] font-semibold text-[#8e918f] uppercase tracking-wider">
              Outils & Révision National
            </div>

            <div className="space-y-0.5">
              {tools.map((t) => {
                const Icon = t.icon;
                const isActive = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      onSelectTab(t.id);
                      if (window.innerWidth < 768) onClose();
                    }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition ${
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
          </div>
        </div>

        {/* Footer: Filière Switcher & API Key */}
        <div className="p-3 border-t border-[#282a2c]/60 space-y-2 bg-[#17181c]">
          {/* Filière Switcher */}
          <button
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
