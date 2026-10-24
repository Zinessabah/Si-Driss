import React, { useState } from 'react';
import {
  X,
  BookOpen,
  Search,
  CheckCircle,
  Clock,
  Award,
  Zap,
  GraduationCap,
  ChevronRight,
  AlertTriangle,
  Plus,
  Send,
} from 'lucide-react';
import { NATIONAL_EXERCISES, NationalExercise } from '../data/nationalExercises';
import { MathView } from './MathView';
import { ChatAttachment } from './SessionManagerModal';
import { useBranch } from '../hooks/useBranch';

interface ExercisePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectExercise: (attachment: ChatAttachment, defaultPrompt?: string) => void;
}

export const ExercisePickerModal: React.FC<ExercisePickerModalProps> = ({
  isOpen,
  onClose,
  onSelectExercise,
}) => {
  const { branch, isSM } = useBranch();
  const [selectedDomain, setSelectedDomain] = useState<'Tous' | 'Physique' | 'Chimie'>('Tous');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const branchExercises = NATIONAL_EXERCISES.filter(
    (ex) => !ex.branches || ex.branches.includes(branch)
  );

  const [previewExercise, setPreviewExercise] = useState<NationalExercise | null>(
    branchExercises[0] || NATIONAL_EXERCISES[0] || null
  );

  if (!isOpen) return null;

  const filteredExercises = branchExercises.filter((ex) => {
    const matchDomain = selectedDomain === 'Tous' || ex.domain === selectedDomain;
    const matchSearch =
      !searchQuery.trim() ||
      ex.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ex.chapter.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ex.session.toLowerCase().includes(searchQuery.toLowerCase());
    return matchDomain && matchSearch;
  });

  const handlePick = (ex: NationalExercise, askNow = false) => {
    // Format full exercise text representation for Gemini
    const questionsText = ex.questions
      .map(
        (q) =>
          `Question ${q.number} (${q.points} pt) :\n${q.text}\n[Indice Socratique prévu : ${q.socraticHint}]`
      )
      .join('\n\n');

    const dataText = ex.givenData.map((d) => `- ${d.label} = ${d.value} ${d.unit}`).join('\n');

    const fullStatement = `SUJET D'EXERCICE : ${ex.title} (${ex.session})
CHAPITRE : ${ex.chapter}
BARÈME : ${ex.totalPoints} points (${ex.recommendedDuration})

ÉNONCÉ :
${ex.statementIntro}

DONNÉES DU PROBLÈME :
${dataText}

QUESTIONS DU SUJET :
${questionsText}

ATTENTION PIÈGE DU NATIONAL :
${ex.professorTrapAlert}`;

    const attachment: ChatAttachment = {
      id: `ex_${ex.id}_${Date.now()}`,
      name: `${ex.title.slice(0, 40)}...`,
      type: 'exercise',
      exerciseId: ex.id,
      chapter: ex.chapter,
      text: fullStatement,
    };

    const prompt = askNow
      ? `Si Driss, j'ai sélectionné l'exercice du National "${ex.title}". Peux-tu me guider socratiquement sur la première question sans me donner la solution directe ?`
      : undefined;

    onSelectExercise(attachment, prompt);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Bibliothèque d'Exercices Officiels 2BAC
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  National PC & SM
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Choisis un exercice type du Bac à attacher directement à ta question pour Si Driss.
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

        {/* Filters & Search */}
        <div className="p-3 sm:p-4 border-b border-slate-800/80 bg-slate-950/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {(['Tous', 'Physique', 'Chimie'] as const).map((dom) => (
              <button
                key={dom}
                onClick={() => setSelectedDomain(dom)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  selectedDomain === dom
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {dom}
              </button>
            ))}
          </div>

          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par chapitre (RC, RLC, Newton, pH...)..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Main Content: 2-Columns */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-0">
          {/* List column */}
          <div className="md:col-span-5 border-r border-slate-800 overflow-y-auto p-3 space-y-2">
            {filteredExercises.map((ex) => {
              const isSelected = previewExercise?.id === ex.id;
              return (
                <div
                  key={ex.id}
                  onClick={() => setPreviewExercise(ex)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500/50 shadow-sm'
                      : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-semibold px-2 py-0.5 rounded bg-slate-800 text-amber-300">
                      {ex.domain}
                    </span>
                    <span className="text-slate-400">{ex.session}</span>
                  </div>
                  <h4 className="text-xs font-bold text-white mb-1.5 leading-snug line-clamp-2">
                    {ex.title}
                  </h4>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Award className="w-3 h-3 text-amber-400" />
                      {ex.totalPoints} pts
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-cyan-400" />
                      {ex.recommendedDuration}
                    </span>
                  </div>
                </div>
              );
            })}

            {filteredExercises.length === 0 && (
              <div className="text-center py-10 text-xs text-slate-500">
                Aucun exercice ne correspond à ta recherche.
              </div>
            )}
          </div>

          {/* Preview column */}
          <div className="md:col-span-7 overflow-y-auto p-4 sm:p-5 flex flex-col bg-slate-950/40">
            {previewExercise ? (
              <div className="space-y-4">
                {/* Meta info */}
                <div>
                  <div className="flex items-center gap-2 mb-1 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">
                      {previewExercise.chapter}
                    </span>
                    <span className="text-slate-400 text-[11px]">{previewExercise.session}</span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-white leading-snug">
                    {previewExercise.title}
                  </h3>
                </div>

                {/* Statement box */}
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5" />
                    Énoncé officiel du sujet
                  </div>
                  <MathView
                    content={previewExercise.statementIntro}
                    className="text-xs text-slate-200 leading-relaxed"
                  />
                </div>

                {/* Given data pills */}
                {previewExercise.givenData.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Données fournies :
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {previewExercise.givenData.map((d, i) => (
                        <div
                          key={i}
                          className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300 flex items-center justify-between"
                        >
                          <span className="text-slate-400">{d.label}</span>
                          <span className="font-mono text-cyan-300 font-bold">
                            <MathView content={`$${d.value}\\ ${d.unit}$`} className="inline" />
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Questions count */}
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Questions du sujet ({previewExercise.questions.length}) :
                  </div>
                  <div className="space-y-2">
                    {previewExercise.questions.map((q) => (
                      <div
                        key={q.id}
                        className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-amber-300">Question {q.number}</span>
                          <span className="text-slate-400">{q.points} pt</span>
                        </div>
                        <MathView
                          content={q.text}
                          className="text-xs text-slate-200 leading-relaxed"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Professor trap alert */}
                <div className="p-3 rounded-xl bg-red-950/20 border border-red-800/40 text-red-300 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Avertissement de Si Driss : </span>
                    {previewExercise.professorTrapAlert}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <button
                    onClick={() => handlePick(previewExercise, false)}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition-all shadow"
                  >
                    <Plus className="w-4 h-4 text-amber-400" />
                    <span>Attacher à ma question</span>
                  </button>

                  <button
                    onClick={() => handlePick(previewExercise, true)}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md"
                  >
                    <Send className="w-4 h-4" />
                    <span>Poser directement à Si Driss</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
                Sélectionne un exercice à gauche pour prévisualiser son contenu.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
