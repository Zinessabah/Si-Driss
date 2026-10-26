import React, { useState, useEffect } from 'react';
import { SocraticChat } from './components/SocraticChat';
import { AuditWorkspace } from './components/AuditWorkspace';
import { FormulaCheatSheet } from './components/FormulaCheatSheet';
import { PitfallsVault } from './components/PitfallsVault';
import { WavesSimulator } from './components/simulators/WavesSimulator';
import { RlcSimulator } from './components/simulators/RlcSimulator';
import { AmModulationSimulator } from './components/simulators/AmModulationSimulator';
import { MechanicsFallSimulator } from './components/simulators/MechanicsFallSimulator';
import { TitrationSimulator } from './components/simulators/TitrationSimulator';
import { ExerciseGeneratorModal } from './components/ExerciseGeneratorModal';
import { DocumentManager } from './components/DocumentManager';
import { ApiKeyStatusBadge } from './components/ApiKeyStatusBadge';
import { PWAInstallButton } from './components/PWAInstallButton';
import { ApiKeyModal } from './components/ApiKeyModal';
import { AndroidInstallModal } from './components/AndroidInstallModal';
import { ChapterInfo } from './data/curriculum';
import { TrapItem } from './data/pitfalls';
import { useBranch } from './hooks/useBranch';
import { useApiKey } from './hooks/useApiKey';
import { BranchSelectorModal } from './components/BranchSelectorModal';
import { GeminiSidebar } from './components/GeminiSidebar';
import { SavedSession } from './components/SessionManagerModal';
import {
  Menu,
  Sparkles,
  Zap,
  Radio,
  Compass,
  FlaskConical,
  ArrowLeft,
  ChevronDown,
  SquarePen,
  Waves,
} from 'lucide-react';

export default function App() {
  const { branch, hasSelectedBranch, isSM } = useBranch();
  const { hasApiKey } = useApiKey();

  const [activeTab, setActiveTab] = useState<'chat' | 'audit' | 'simulators' | 'formulas' | 'pitfalls' | 'documents'>('chat');
  const [activeSimulator, setActiveSimulator] = useState<'waves' | 'rlc' | 'am' | 'mechanics' | 'titration'>('waves');
  const [chatInitialPrompt, setChatInitialPrompt] = useState<string>('');
  const [isGeneratorOpen, setIsGeneratorOpen] = useState<boolean>(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState<boolean>(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState<boolean>(false);

  // Gemini Sidebar Drawer state (open by default on desktop, closed on mobile)
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return true;
  });

  // Saved sessions for the sidebar list
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>(() => {
    try {
      const raw = localStorage.getItem('sidriss_saved_sessions_v1');
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [externalLoadSession, setExternalLoadSession] = useState<SavedSession | null>(null);
  const [newChatTrigger, setNewChatTrigger] = useState<number>(0);

  const handleAskProfFromChapter = (chapter: ChapterInfo) => {
    setChatInitialPrompt(chapter.suggestedPrompt);
    setActiveTab('chat');
  };

  const handleChallengeTrap = (trap: TrapItem) => {
    setChatInitialPrompt(
      `Si Driss, teste-moi sur ce piège du National : "${trap.title}". Pose-moi une question où les élèves tombent souvent dans ce piège !`
    );
    setActiveTab('chat');
  };

  const handleNewChat = () => {
    setActiveTab('chat');
    setNewChatTrigger((prev) => prev + 1);
  };

  const handleLoadSession = (session: SavedSession) => {
    setExternalLoadSession(session);
    setCurrentSessionId(session.id);
    setActiveTab('chat');
  };

  const handleDeleteSession = (id: string) => {
    const updated = savedSessions.filter((s) => s.id !== id);
    setSavedSessions(updated);
    try {
      localStorage.setItem('sidriss_saved_sessions_v1', JSON.stringify(updated));
    } catch {}
    if (currentSessionId === id) {
      handleNewChat();
    }
  };

  const handleSessionsUpdated = (sessions: SavedSession[], activeId: string) => {
    setSavedSessions(sessions);
    setCurrentSessionId(activeId);
  };

  return (
    <div className="flex h-screen w-full bg-[#131314] text-[#e3e3e3] overflow-hidden font-sans">
      {/* GEMINI SIDEBAR */}
      <GeminiSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
        }}
        onNewChat={handleNewChat}
        currentSessionId={currentSessionId}
        onLoadSession={handleLoadSession}
        onDeleteSession={handleDeleteSession}
        savedSessions={savedSessions}
        branch={branch}
        onOpenBranchModal={() => setIsBranchModalOpen(true)}
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
        hasApiKey={hasApiKey}
      />

      {/* MAIN VIEW AREA */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* GEMINI TOP BAR (Single row, clean & uncluttered) */}
        <header className="h-14 border-b border-[#282a2c] bg-[#131314]/95 backdrop-blur-md px-3 sm:px-5 flex items-center justify-between shrink-0 z-30">
          {/* Left: Hamburger menu toggle + Logo + Filière switch */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-full hover:bg-[#202124] text-[#c4c7c5] hover:text-white transition"
              title="Afficher/Masquer le menu latéral"
              aria-label="Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* App Wordmark with Gemini Spark */}
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold tracking-tight text-white flex items-center gap-1.5">
                <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#4285f4] via-[#9b72cb] to-[#f59e0b] flex items-center justify-center shadow-xs">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </span>
                Si Driss
              </span>

              {/* Branch Selector Dropdown Pill (Gemini model selector style) */}
              <button
                onClick={() => setIsBranchModalOpen(true)}
                className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1e1f20] hover:bg-[#282a2c] text-xs text-[#c4c7c5] hover:text-white border border-[#282a2c] transition"
                title="Changer de filière (PC / SM)"
              >
                <span className="font-medium">2BAC {branch}</span>
                <ChevronDown className="w-3 h-3 text-[#8e918f]" />
              </button>
            </div>
          </div>

          {/* Center: Contextual Return Button if in another tool */}
          {activeTab !== 'chat' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('chat')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1e1f20] hover:bg-[#282a2c] text-xs text-[#8ab4f8] hover:text-white transition border border-[#282a2c]"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="font-medium">Retour à la discussion</span>
              </button>
            </div>
          )}

          {/* Right: API Key Badge + New Chat Icon */}
          <div className="flex items-center gap-2">
            <PWAInstallButton variant="nav" />

            <ApiKeyStatusBadge compact />

            <button
              onClick={handleNewChat}
              className="p-2 rounded-full hover:bg-[#202124] text-[#c4c7c5] hover:text-white transition"
              title="Nouvelle discussion"
              aria-label="Nouvelle discussion"
            >
              <SquarePen className="w-4 h-4 text-[#8ab4f8]" />
            </button>
          </div>
        </header>

        {/* CONTENT STAGE */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {/* 1. Socratic Chat (Full Canvas) */}
          {activeTab === 'chat' && (
            <SocraticChat
              initialPrompt={chatInitialPrompt}
              externalLoadSession={externalLoadSession}
              externalNewChatTrigger={newChatTrigger}
              onSessionsUpdated={handleSessionsUpdated}
            />
          )}

          {/* 2. National Exam Audit Workspace */}
          {activeTab === 'audit' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 no-scrollbar">
              <div className="max-w-4xl mx-auto space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#282a2c]">
                  <div>
                    <h2 className="text-xl font-bold text-white">Audit de Rédaction</h2>
                    <p className="text-xs text-[#8e918f]">
                      Évaluez votre réponse selon le barème officiel de l'Examen National (BIOF Maroc)
                    </p>
                  </div>
                </div>
                <AuditWorkspace />
              </div>
            </div>
          )}

          {/* 3. Virtual Labs */}
          {activeTab === 'simulators' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 no-scrollbar">
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between pb-2 border-b border-[#282a2c]">
                  <div>
                    <h2 className="text-xl font-bold text-white">Laboratoires Virtuels</h2>
                    <p className="text-xs text-[#8e918f]">
                      Expérimentez les circuits et phénomènes physiques du programme 2BAC
                    </p>
                  </div>
                </div>

                {/* Simulator Selector Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
                  <button
                    onClick={() => setActiveSimulator('waves')}
                    className={`px-3.5 py-1.5 rounded-full font-medium flex items-center gap-1.5 transition ${
                      activeSimulator === 'waves'
                        ? 'bg-[#282a2c] text-white border border-[#3c4043]'
                        : 'bg-[#1e1f20] text-[#8e918f] hover:text-white'
                    }`}
                  >
                    <Waves className="w-3.5 h-3.5 text-sky-400" />
                    Ondes (Transversales & Longitudinales)
                  </button>

                  <button
                    onClick={() => setActiveSimulator('rlc')}
                    className={`px-3.5 py-1.5 rounded-full font-medium flex items-center gap-1.5 transition ${
                      activeSimulator === 'rlc'
                        ? 'bg-[#282a2c] text-white border border-[#3c4043]'
                        : 'bg-[#1e1f20] text-[#8e918f] hover:text-white'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5 text-blue-400" />
                    RC & RLC
                  </button>

                  <button
                    onClick={() => setActiveSimulator('am')}
                    className={`px-3.5 py-1.5 rounded-full font-medium flex items-center gap-1.5 transition ${
                      activeSimulator === 'am'
                        ? 'bg-[#282a2c] text-white border border-[#3c4043]'
                        : 'bg-[#1e1f20] text-[#8e918f] hover:text-white'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5 text-emerald-400" />
                    Modulation AM (PC)
                  </button>

                  <button
                    onClick={() => setActiveSimulator('mechanics')}
                    className={`px-3.5 py-1.5 rounded-full font-medium flex items-center gap-1.5 transition ${
                      activeSimulator === 'mechanics'
                        ? 'bg-[#282a2c] text-white border border-[#3c4043]'
                        : 'bg-[#1e1f20] text-[#8e918f] hover:text-white'
                    }`}
                  >
                    <Compass className="w-3.5 h-3.5 text-sky-400" />
                    Chute & Euler
                  </button>

                  <button
                    onClick={() => setActiveSimulator('titration')}
                    className={`px-3.5 py-1.5 rounded-full font-medium flex items-center gap-1.5 transition ${
                      activeSimulator === 'titration'
                        ? 'bg-[#282a2c] text-white border border-[#3c4043]'
                        : 'bg-[#1e1f20] text-[#8e918f] hover:text-white'
                    }`}
                  >
                    <FlaskConical className="w-3.5 h-3.5 text-purple-400" />
                    Titrage pH
                  </button>
                </div>

                {/* Render Selected Simulator */}
                {activeSimulator === 'waves' && <WavesSimulator />}
                {activeSimulator === 'rlc' && <RlcSimulator />}
                {activeSimulator === 'am' && <AmModulationSimulator />}
                {activeSimulator === 'mechanics' && <MechanicsFallSimulator />}
                {activeSimulator === 'titration' && <TitrationSimulator />}
              </div>
            </div>
          )}

          {/* 4. Formula Cheatsheet */}
          {activeTab === 'formulas' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 no-scrollbar">
              <div className="max-w-4xl mx-auto space-y-4">
                <div className="pb-2 border-b border-[#282a2c]">
                  <h2 className="text-xl font-bold text-white">Mémento des Formules & Cadre</h2>
                  <p className="text-xs text-[#8e918f]">
                    Toutes les formules exigibles au Baccalauréat 2BAC {branch} (BIOF)
                  </p>
                </div>
                <FormulaCheatSheet onAskProfAboutChapter={handleAskProfFromChapter} />
              </div>
            </div>
          )}

          {/* 5. Pitfalls Vault */}
          {activeTab === 'pitfalls' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 no-scrollbar">
              <div className="max-w-4xl mx-auto space-y-4">
                <div className="pb-2 border-b border-[#282a2c]">
                  <h2 className="text-xl font-bold text-white">Pièges Fatals au National</h2>
                  <p className="text-xs text-[#8e918f]">
                    Les erreurs classiques repérées par les correcteurs du Bac marocain
                  </p>
                </div>
                <PitfallsVault onChallengeTrap={handleChallengeTrap} />
              </div>
            </div>
          )}

          {/* 6. Document Manager */}
          {activeTab === 'documents' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 no-scrollbar">
              <div className="max-w-4xl mx-auto space-y-4">
                <div className="pb-2 border-b border-[#282a2c]">
                  <h2 className="text-xl font-bold text-white">Documents du Programme</h2>
                  <p className="text-xs text-[#8e918f]">
                    Indexation et consultation des fichiers du dossier /docs/programme/
                  </p>
                </div>
                <DocumentManager
                  onAskQuestionAboutDoc={(docName) => {
                    setChatInitialPrompt(`Si Driss, explique-moi les notions clés du document "${docName}" indexé dans /docs/programme/`);
                    setActiveTab('chat');
                  }}
                />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Generator Modal */}
      <ExerciseGeneratorModal
        isOpen={isGeneratorOpen}
        onClose={() => setIsGeneratorOpen(false)}
        onSelectForPractice={() => {
          setIsGeneratorOpen(false);
          setActiveTab('audit');
        }}
      />

      {/* API Key Modal */}
      <ApiKeyModal isOpen={isApiKeyModalOpen} onClose={() => setIsApiKeyModalOpen(false)} />

      {/* App Install Modal (iOS / Android) */}
      <AndroidInstallModal isOpen={isInstallModalOpen} onClose={() => setIsInstallModalOpen(false)} />

      {/* Branch Selector Modal */}
      <BranchSelectorModal
        isOpen={isBranchModalOpen || !hasSelectedBranch}
        canClose={hasSelectedBranch}
        onClose={() => setIsBranchModalOpen(false)}
      />
    </div>
  );
}
