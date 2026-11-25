import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Brain,
  CheckCircle,
  RotateCcw,
  Download,
  AlertTriangle,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';
import { useModalA11y } from '../hooks/useModalA11y';
import { useBranch } from '../hooks/useBranch';
import { CURRICULUM } from '../data/curriculum';
import { NATIONAL_PITFALLS } from '../data/pitfalls';
import {
  STUDENT_GOAL_OPTIONS,
  STUDENT_STYLE_OPTIONS,
  STUDENT_LANG_OPTIONS,
  loadStudentProfile,
  saveStudentProfile,
  loadStudentMemory,
  saveStudentMemory,
  resetStudentProfileAndMemory,
  formatUserProfileMarkdown,
  formatStudentMemoryMarkdown,
  type StudentProfile,
  type StudentMemory,
  type ChapterStatusId,
} from '../utils/studentMemory';

interface StudentProfileModalProps {
  isOpen: boolean;
  initialTab?: 'profile' | 'memory';
  onClose: () => void;
}

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({
  isOpen,
  initialTab = 'profile',
  onClose,
}) => {
  const { branch } = useBranch();
  const [activeTab, setActiveTab] = useState<'profile' | 'memory'>(initialTab);
  const [showMarkdownPreview, setShowMarkdownPreview] = useState<boolean>(false);
  const [profile, setProfile] = useState<StudentProfile>(() => loadStudentProfile());
  const [memory, setMemory] = useState<StudentMemory>(() => loadStudentMemory(branch));

  const modalRef = useModalA11y(isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setShowMarkdownPreview(false);
      setProfile(loadStudentProfile());
      setMemory(loadStudentMemory(branch));
    }
  }, [isOpen, initialTab, branch]);

  if (!isOpen) return null;

  const branchChapters = CURRICULUM.filter((c) => !c.branches || c.branches.includes(branch));
  const branchPitfalls = NATIONAL_PITFALLS.filter((p) => !p.branches || p.branches.includes(branch));

  const handleProfileChange = (patch: Partial<StudentProfile>) => {
    const next = saveStudentProfile({ ...profile, ...patch });
    setProfile(next);
  };

  const getChapterStatus = (chapterId: string): ChapterStatusId | null => {
    return memory.chapterStates.find((c) => c.chapterId === chapterId)?.status || null;
  };

  const handleSetChapterStatus = (chapterId: string, status: ChapterStatusId) => {
    const current = getChapterStatus(chapterId);
    const filtered = memory.chapterStates.filter((c) => c.chapterId !== chapterId);
    if (current !== status) {
      filtered.push({ chapterId, status });
    }
    const next = saveStudentMemory({ ...memory, chapterStates: filtered });
    setMemory(next);
  };

  const handleTogglePitfall = (pitfallId: string) => {
    const exists = memory.activePitfalls.includes(pitfallId);
    const activePitfalls = exists
      ? memory.activePitfalls.filter((id) => id !== pitfallId)
      : [...memory.activePitfalls, pitfallId];
    const next = saveStudentMemory({ ...memory, activePitfalls });
    setMemory(next);
  };

  const handleExportMarkdown = () => {
    const content =
      activeTab === 'profile'
        ? formatUserProfileMarkdown(profile, branch)
        : formatStudentMemoryMarkdown(memory, branch);
    const filename = activeTab === 'profile' ? `USER_${branch}.md` : `MEMORY_${branch}.md`;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    resetStudentProfileAndMemory();
    setProfile(loadStudentProfile());
    setMemory(loadStudentMemory(branch));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Profil et mémoire de révision Si Driss"
        tabIndex={-1}
        className="bg-[#18191b] border border-[#282a2c] rounded-3xl w-full max-w-3xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#282a2c] flex items-center justify-between gap-3 bg-[#1e1f20]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0">
              {activeTab === 'profile' ? <User className="w-4 h-4" /> : <Brain className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate">
                Personnalisation & Mémoire Locale (2BAC {branch})
              </h3>
              <p className="text-[11px] text-[#8e918f] truncate">
                Choix prédéfinis & tags officiels uniquement — 100 % privé dans votre navigateur
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#9aa0a6] hover:text-white hover:bg-[#282a2c] transition"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs & Preview Switch */}
        <div className="px-5 py-2.5 border-b border-[#282a2c] flex flex-wrap items-center justify-between gap-2 bg-[#141517]">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'profile'
                  ? 'bg-[#282a2c] text-white border border-[#3c4043]'
                  : 'text-[#8e918f] hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5 text-sky-400" />
              <span>USER.md (Profil)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('memory')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'memory'
                  ? 'bg-[#282a2c] text-white border border-[#3c4043]'
                  : 'text-[#8e918f] hover:text-white'
              }`}
            >
              <Brain className="w-3.5 h-3.5 text-purple-400" />
              <span>MEMORY.md (Progression)</span>
              {(memory.chapterStates.length > 0 || memory.activePitfalls.length > 0) && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 font-mono">
                  {memory.chapterStates.length + memory.activePitfalls.length}
                </span>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowMarkdownPreview((prev) => !prev)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1.5 border transition ${
              showMarkdownPreview
                ? 'bg-sky-500/15 border-sky-500/30 text-sky-300'
                : 'bg-[#1e1f20] border-[#282a2c] text-[#9aa0a6] hover:text-white'
            }`}
          >
            {showMarkdownPreview ? <SlidersHorizontal className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            <span>{showMarkdownPreview ? 'Mode Édition' : 'Aperçu .md'}</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {showMarkdownPreview ? (
            <pre className="p-4 rounded-2xl bg-[#111214] border border-[#282a2c] text-xs text-[#c4c7c5] whitespace-pre-wrap font-mono leading-relaxed">
              {activeTab === 'profile'
                ? formatUserProfileMarkdown(profile, branch)
                : formatStudentMemoryMarkdown(memory, branch)}
            </pre>
          ) : activeTab === 'profile' ? (
            <div className="space-y-5">
              {/* Goal */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  1. Objectif au Baccalauréat
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {STUDENT_GOAL_OPTIONS.map((opt) => {
                    const active = profile.goal === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleProfileChange({ goal: opt.id })}
                        className={`p-3 rounded-2xl border text-left transition ${
                          active
                            ? 'bg-sky-500/15 border-sky-500/50 text-white'
                            : 'bg-[#131314] border-[#282a2c] text-[#9aa0a6] hover:border-[#3c4043] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold">{opt.label}</span>
                          {active && <CheckCircle className="w-3.5 h-3.5 text-sky-400" />}
                        </div>
                        <p className="text-[11px] opacity-80 mt-0.5">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Style */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  2. Style d'explication préféré
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {STUDENT_STYLE_OPTIONS.map((opt) => {
                    const active = profile.style === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleProfileChange({ style: opt.id })}
                        className={`p-3 rounded-2xl border text-left transition ${
                          active
                            ? 'bg-emerald-500/15 border-emerald-500/50 text-white'
                            : 'bg-[#131314] border-[#282a2c] text-[#9aa0a6] hover:border-[#3c4043] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold">{opt.label}</span>
                          {active && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                        </div>
                        <p className="text-[11px] opacity-80 mt-0.5">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Language */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  3. Ton & langue
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {STUDENT_LANG_OPTIONS.map((opt) => {
                    const active = profile.language === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleProfileChange({ language: opt.id })}
                        className={`p-3 rounded-2xl border text-left transition ${
                          active
                            ? 'bg-amber-500/15 border-amber-500/50 text-white'
                            : 'bg-[#131314] border-[#282a2c] text-[#9aa0a6] hover:border-[#3c4043] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold">{opt.label}</span>
                          {active && <CheckCircle className="w-3.5 h-3.5 text-amber-400" />}
                        </div>
                        <p className="text-[11px] opacity-80 mt-0.5">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Chapters progress tags */}
              <div className="space-y-2">
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Chapitres du programme 2BAC {branch}
                  </h4>
                  <p className="text-[11px] text-[#8e918f]">
                    Cliquez sur un statut pour orienter Si Driss sur vos priorités (recliquer pour retirer).
                  </p>
                </div>

                <div className="space-y-1.5">
                  {branchChapters.map((ch) => {
                    const status = getChapterStatus(ch.id);
                    return (
                      <div
                        key={ch.id}
                        className="p-2.5 rounded-xl bg-[#131314] border border-[#282a2c] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <span className="text-xs font-medium text-white block truncate">
                            {ch.title}
                          </span>
                          <span className="text-[10px] text-[#8e918f]">
                            {ch.subject} · {ch.weightInExam}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {(
                            [
                              { id: 'a_revoir', label: 'À revoir', cls: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
                              { id: 'en_cours', label: 'En cours', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
                              { id: 'maitrise', label: 'Maîtrisé', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
                            ] as { id: ChapterStatusId; label: string; cls: string }[]
                          ).map((btn) => {
                            const active = status === btn.id;
                            return (
                              <button
                                key={btn.id}
                                type="button"
                                onClick={() => handleSetChapterStatus(ch.id, btn.id)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition ${
                                  active
                                    ? btn.cls
                                    : 'bg-[#1e1f20] border-[#282a2c] text-[#8e918f] hover:text-white'
                                }`}
                              >
                                {btn.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recurring Pitfall tags */}
              <div className="space-y-2">
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Pièges à surveiller particulièrement</span>
                  </h4>
                  <p className="text-[11px] text-[#8e918f]">
                    Si Driss vous rappellera ces points de vigilance dès qu’un exercice s’y prête.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {branchPitfalls.map((trap) => {
                    const active = memory.activePitfalls.includes(trap.id);
                    return (
                      <button
                        key={trap.id}
                        type="button"
                        onClick={() => handleTogglePitfall(trap.id)}
                        className={`p-2.5 rounded-xl border text-left transition ${
                          active
                            ? 'bg-amber-500/15 border-amber-500/40 text-white'
                            : 'bg-[#131314] border-[#282a2c] text-[#9aa0a6] hover:border-[#3c4043] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold leading-snug">{trap.title}</span>
                          {active && <CheckCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                        </div>
                        <span className="text-[10px] text-[#8e918f] block mt-0.5">
                          {trap.category} · {trap.penaltyEstimate}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#282a2c] bg-[#1e1f20] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 rounded-xl bg-[#282a2c] hover:bg-rose-950/50 text-[#9aa0a6] hover:text-rose-300 text-xs font-medium flex items-center gap-1.5 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Réinitialiser</span>
            </button>
            <button
              type="button"
              onClick={handleExportMarkdown}
              className="px-3 py-1.5 rounded-xl bg-[#282a2c] hover:bg-[#323538] text-[#c4c7c5] hover:text-white text-xs font-medium flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span>Exporter .md</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition"
          >
            Enregistrer & Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

