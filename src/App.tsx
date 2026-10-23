import React, { useState } from 'react';
import { SocraticChat } from './components/SocraticChat';
import { AuditWorkspace } from './components/AuditWorkspace';
import { FormulaCheatSheet } from './components/FormulaCheatSheet';
import { PitfallsVault } from './components/PitfallsVault';
import { RlcSimulator } from './components/simulators/RlcSimulator';
import { AmModulationSimulator } from './components/simulators/AmModulationSimulator';
import { MechanicsFallSimulator } from './components/simulators/MechanicsFallSimulator';
import { TitrationSimulator } from './components/simulators/TitrationSimulator';
import { ExerciseGeneratorModal } from './components/ExerciseGeneratorModal';
import { DocumentManager } from './components/DocumentManager';
import { ApiKeyStatusBadge } from './components/ApiKeyStatusBadge';
import { PWAInstallButton } from './components/PWAInstallButton';
import { AndroidBottomNav } from './components/AndroidBottomNav';
import { ApiKeyModal } from './components/ApiKeyModal';
import { ChapterInfo } from './data/curriculum';
import { TrapItem } from './data/pitfalls';
import {
  MessageSquare,
  ShieldCheck,
  Zap,
  BookOpen,
  AlertTriangle,
  Sparkles,
  Calendar,
  GraduationCap,
  Award,
  Radio,
  Compass,
  FlaskConical,
  FolderOpen,
  Smartphone,
  Key,
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'audit' | 'simulators' | 'formulas' | 'pitfalls' | 'documents'>('chat');
  const [activeSimulator, setActiveSimulator] = useState<'rlc' | 'am' | 'mechanics' | 'titration'>('rlc');
  const [chatInitialPrompt, setChatInitialPrompt] = useState<string>('');
  const [isGeneratorOpen, setIsGeneratorOpen] = useState<boolean>(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-slate-950 font-black shadow-lg text-lg">
                SD
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold text-white tracking-tight">Si Driss</h1>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    2ème Bac PC BIOF
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Préparation Intensive à l'Examen National de Physique-Chimie (Maroc)
                </p>
              </div>
            </div>

            {/* Android PWA, Student API Key & AI Generator Buttons */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden lg:flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs text-slate-300">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span className="font-mono font-bold text-amber-300">Examen National 2026</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">2BAC PC</span>
              </div>

              {/* Android App Button */}
              <PWAInstallButton variant="nav" />

              {/* Student API Key status & settings */}
              <ApiKeyStatusBadge />

              <button
                onClick={() => setIsGeneratorOpen(true)}
                className="hidden sm:flex px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-xs items-center gap-1.5 transition-all shadow-md shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Générer un sujet</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto py-2 border-t border-slate-800/80 text-xs no-scrollbar">
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-3.5 py-2 rounded-xl font-semibold flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === 'chat'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Coaching Socratique (Si Driss)
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3.5 py-2 rounded-xl font-semibold flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === 'audit'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Audit de Rédaction (Barème National)
            </button>

            <button
              onClick={() => setActiveTab('simulators')}
              className={`px-3.5 py-2 rounded-xl font-semibold flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === 'simulators'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Zap className="w-4 h-4" />
              Laboratoires Virtuels (Mini-Labs)
            </button>

            <button
              onClick={() => setActiveTab('formulas')}
              className={`px-3.5 py-2 rounded-xl font-semibold flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === 'formulas'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Mémento Formules & Cadre
            </button>

            <button
              onClick={() => setActiveTab('pitfalls')}
              className={`px-3.5 py-2 rounded-xl font-semibold flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === 'pitfalls'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              Pièges Fatals au National
            </button>

            <button
              onClick={() => setActiveTab('documents')}
              className={`px-3.5 py-2 rounded-xl font-semibold flex items-center gap-2 whitespace-nowrap transition-all ${
                activeTab === 'documents'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              Documents du Programme (/docs)
            </button>
          </div>
        </div>
      </header>

      {/* Moroccan Motivation Ticker */}
      <div className="bg-slate-900/60 border-b border-slate-800/80 py-1.5 px-4 text-center text-[11px] text-amber-300 font-medium">
        ✨ <em>"Rkkez m3aya f had l-étape • Formule littérale avant les chiffres • Système & Référentiel galiléen d'abord • 20/20 incha'Allah au National !"</em>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-8">
        {/* Tab 1: Socratic Chat */}
        {activeTab === 'chat' && (
          <div className="space-y-4">
            {/* Android App Install Banner */}
            <PWAInstallButton variant="banner" />

            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-amber-400" />
                <span className="text-slate-300">
                  <strong className="text-white">Sessions & Sauvegardes :</strong> Ta session est conservée automatiquement. Tu peux l'archiver, l'exporter en fiche Markdown (.md) ou télécharger un backup complet (.json) via le bouton <em>« Historique & Sauvegardes »</em>.
                </span>
              </div>
              <div className="text-[11px] text-emerald-400 font-mono flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Sauvegarde automatique active</span>
              </div>
            </div>

            <SocraticChat initialPrompt={chatInitialPrompt} />
          </div>
        )}

        {/* Tab 2: National Exam Audit Workspace */}
        {activeTab === 'audit' && <AuditWorkspace />}

        {/* Tab 3: Virtual Labs */}
        {activeTab === 'simulators' && (
          <div className="space-y-6">
            {/* Simulator sub-selector */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
              <button
                onClick={() => setActiveSimulator('rlc')}
                className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all ${
                  activeSimulator === 'rlc'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <Zap className="w-4 h-4" />
                Oscillateur RC & RLC (Oscilloscope & Énergies)
              </button>

              <button
                onClick={() => setActiveSimulator('am')}
                className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all ${
                  activeSimulator === 'am'
                    ? 'bg-emerald-600 text-white shadow-lg'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <Radio className="w-4 h-4" />
                Modulation AM & Mode XY (Spécifique PC)
              </button>

              <button
                onClick={() => setActiveSimulator('mechanics')}
                className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all ${
                  activeSimulator === 'mechanics'
                    ? 'bg-sky-600 text-white shadow-lg'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <Compass className="w-4 h-4" />
                Chute Verticale & Méthode d'Euler
              </button>

              <button
                onClick={() => setActiveSimulator('titration')}
                className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all ${
                  activeSimulator === 'titration'
                    ? 'bg-purple-600 text-white shadow-lg'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <FlaskConical className="w-4 h-4" />
                Titrage pH-métrique & Virage Coloré
              </button>
            </div>

            {/* Selected Simulator */}
            {activeSimulator === 'rlc' && <RlcSimulator />}
            {activeSimulator === 'am' && <AmModulationSimulator />}
            {activeSimulator === 'mechanics' && <MechanicsFallSimulator />}
            {activeSimulator === 'titration' && <TitrationSimulator />}
          </div>
        )}

        {/* Tab 4: Formula Cheatsheet */}
        {activeTab === 'formulas' && (
          <FormulaCheatSheet onAskProfAboutChapter={handleAskProfFromChapter} />
        )}

        {/* Tab 5: Pitfalls Vault */}
        {activeTab === 'pitfalls' && (
          <PitfallsVault onChallengeTrap={handleChallengeTrap} />
        )}

        {/* Tab 6: Document Manager */}
        {activeTab === 'documents' && (
          <DocumentManager
            onAskQuestionAboutDoc={(docName) => {
              setChatInitialPrompt(`Si Driss, explique-moi les notions clés du document "${docName}" indexé dans /docs/programme/`);
              setActiveTab('chat');
            }}
          />
        )}
      </main>

      {/* Mobile Android Bottom Navigation Bar */}
      <AndroidBottomNav activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* Modal Generator */}
      <ExerciseGeneratorModal
        isOpen={isGeneratorOpen}
        onClose={() => setIsGeneratorOpen(false)}
        onSelectForPractice={() => {
          setIsGeneratorOpen(false);
          setActiveTab('audit');
        }}
      />

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
      />
    </div>
  );
}
