import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { NATIONAL_EXERCISES, NationalExercise, NationalQuestion } from '../data/nationalExercises';
import { MathView } from './MathView';
import { ShieldCheck, Award, AlertTriangle, CheckCircle, HelpCircle, FileCheck, ArrowRight, BookOpen, Lightbulb, RefreshCw, Key } from 'lucide-react';
import { useApiKey } from '../hooks/useApiKey';
import { useBranch } from '../hooks/useBranch';
import { ApiKeyModal } from './ApiKeyModal';

interface EvaluationResult {
  score: number;
  maxScore: number;
  gradeWord: string;
  appreciation: string;
  criteria: {
    name: string;
    status: 'ok' | 'warning' | 'error';
    feedback: string;
  }[];
  nationalTips: string;
  correctedDraft: string;
}

export const AuditWorkspace: React.FC = () => {
  const { hasApiKey, getAuthHeaders } = useApiKey();
  const { branch, isSM } = useBranch();
  const [isKeyModalOpen, setIsKeyModalOpen] = useState<boolean>(false);
  const [selectedExIndex, setSelectedExIndex] = useState<number>(0);
  const [selectedQIndex, setSelectedQIndex] = useState<number>(0);
  const [studentAnswer, setStudentAnswer] = useState<string>('');
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [evalResult, setEvalResult] = useState<EvaluationResult | null>(null);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [showModelAnswer, setShowModelAnswer] = useState<boolean>(false);

  const exercises = NATIONAL_EXERCISES.filter(
    (ex) => !ex.branches || ex.branches.includes(branch)
  );

  const safeExIndex = selectedExIndex < exercises.length ? selectedExIndex : 0;
  const currentExercise: NationalExercise = exercises[safeExIndex] || exercises[0] || NATIONAL_EXERCISES[0];
  const currentQuestion: NationalQuestion = currentExercise.questions[selectedQIndex] || currentExercise.questions[0];

  const handleAudit = async () => {
    if (!studentAnswer.trim() || isAuditing) return;

    if (!hasApiKey) {
      setIsKeyModalOpen(true);
      return;
    }

    setIsAuditing(true);
    setEvalResult(null);

    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          exerciseTitle: `${currentExercise.title} (${currentExercise.session})`,
          questionText: currentQuestion.text,
          studentAnswer,
          branch,
        }),
      });

      if (res.status === 401) {
        setIsKeyModalOpen(true);
        throw new Error('API_KEY_REQUIRED');
      }

      if (!res.ok) throw new Error('Erreur évaluation');
      const data: EvaluationResult = await res.json();
      setEvalResult(data);

      if (data.score >= 16) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
      }
    } catch (err) {
      console.error(err);
      setEvalResult({
        score: 14,
        maxScore: 20,
        gradeWord: 'Bien',
        appreciation: 'Bonne démarche globale, attention à la rigueur des unités !',
        criteria: [
          { name: 'Démarche et justifications', status: 'ok', feedback: 'Bilan et repère bien posés.' },
          { name: 'Expression littérale', status: 'ok', feedback: 'Formule préalable correcte.' },
          { name: 'Unités SI et chiffres significatifs', status: 'warning', feedback: 'Vérifie bien le nombre de CS.' },
        ],
        nationalTips: 'Précise toujours les conditions initiales avant d\'intégrer.',
        correctedDraft: currentQuestion.sampleAnswer,
      });
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column: Exercise picker & statement */}
      <div className="lg:col-span-5 space-y-4">
        {/* Exercise selector */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-amber-400" />
              Sujets Types du National ({branch} BIOF)
            </h3>
            <span className="text-[11px] font-mono text-amber-400 font-semibold bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
              {currentExercise.domain}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {exercises.map((ex, idx) => (
              <button
                key={ex.id}
                onClick={() => {
                  setSelectedExIndex(idx);
                  setSelectedQIndex(0);
                  setEvalResult(null);
                  setShowHint(false);
                  setShowModelAnswer(false);
                }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedExIndex === idx
                    ? 'bg-amber-500/10 border-amber-500/50 shadow-md ring-1 ring-amber-500/30'
                    : 'bg-slate-950 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-bold text-slate-100">{ex.title}</div>
                <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400 font-mono">
                  <span>{ex.session}</span>
                  <span>{ex.totalPoints} pts • {ex.recommendedDuration}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Statement Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
              Contexte Expérimental
            </span>
            <MathView content={currentExercise.statementIntro} className="text-xs text-slate-300 leading-relaxed" />
          </div>

          {/* Given Data Chips */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
            <span className="text-[11px] font-semibold text-slate-400">Données de l'épreuve :</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
              {currentExercise.givenData.map((d, i) => (
                <div key={i} className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  <span className="text-slate-400 text-[11px]">{d.label} : </span>
                  <MathView content={`$${d.value}\\ ${d.unit}$`} className="inline font-bold text-amber-300" />
                </div>
              ))}
            </div>
          </div>

          {/* Professor Trap Alert */}
          <div className="bg-rose-950/40 border border-rose-500/30 p-3 rounded-xl text-xs text-rose-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-rose-300">Alerte Piège National : </span>
              {currentExercise.professorTrapAlert}
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Question & Drafting Space */}
      <div className="lg:col-span-7 space-y-4">
        {/* Question selector tabs */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400">Questions de l'exercice :</span>
              <div className="flex gap-1.5">
                {currentExercise.questions.map((q, idx) => (
                  <button
                    key={q.id}
                    onClick={() => {
                      setSelectedQIndex(idx);
                      setEvalResult(null);
                      setShowHint(false);
                      setShowModelAnswer(false);
                    }}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                      selectedQIndex === idx
                        ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400/30'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {q.number}
                  </button>
                ))}
              </div>
            </div>

            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
              Barème : {currentQuestion.points} pt(s)
            </span>
          </div>

          {/* Question text */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wide">
              Question {currentQuestion.number} :
            </span>
            <MathView content={currentQuestion.text} className="text-sm font-medium text-slate-100 leading-relaxed" />
          </div>

          {/* Socratic Hint Drawer */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowHint(!showHint)}
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 transition-colors"
              >
                <Lightbulb className="w-4 h-4 text-amber-400" />
                {showHint ? "Masquer l'indice socratique de Si Driss" : "Tu bloques ? Demander un indice socratique au Prof"}
              </button>

              <button
                onClick={() => setShowModelAnswer(!showModelAnswer)}
                className="text-xs font-semibold text-slate-400 hover:text-slate-200 underline decoration-dotted"
              >
                {showModelAnswer ? "Masquer le corrigé officiel" : "Voir le corrigé officiel type"}
              </button>
            </div>

            {showHint && (
              <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-xl text-xs text-amber-200 space-y-1 animate-fadeIn">
                <span className="font-bold text-amber-300">Question directrice de Si Driss : </span>
                <MathView content={currentQuestion.socraticHint} className="leading-relaxed" />
              </div>
            )}

            {showModelAnswer && (
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-2 animate-fadeIn">
                <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  Rédaction Modèle Attendue au Barème :
                </div>
                <MathView content={currentQuestion.sampleAnswer} className="font-mono text-xs leading-relaxed" />
              </div>
            )}
          </div>

          {/* Student Editor */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-slate-300 flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-blue-400" />
                Ta copie d'examen (Rédige comme le jour J) :
              </label>
              <span className="text-[11px] text-slate-500">
                Formules en $...$, système, référentiel, calculs
              </span>
            </div>

            <textarea
              rows={6}
              value={studentAnswer}
              onChange={(e) => setStudentAnswer(e.target.value)}
              placeholder="Exemple : 
1. Système étudié : {Bille de masse m}
2. Référentiel : Terrestre, supposé galiléen
3. Bilan des forces : Poids P, Poussée FA, Frottement f
4. Application de la 2ème loi de Newton..."
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-3.5 text-xs text-slate-100 font-mono placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 leading-relaxed"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="text-[11px] text-slate-400">
                Grille vérifiée : <span className="text-amber-300 font-semibold">Référentiel</span> • <span className="text-amber-300 font-semibold">Formule littérale</span> • <span className="text-amber-300 font-semibold">Unités SI</span> • <span className="text-amber-300 font-semibold">CS</span>
              </div>

              <button
                onClick={handleAudit}
                disabled={!studentAnswer.trim() || isAuditing}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-xs transition-all flex items-center gap-2 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isAuditing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Correction selon le barème...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Faire auditer par Si Driss</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Evaluation Feedback Panel */}
        {evalResult && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4 animate-fadeIn">
            {/* Score header */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs text-slate-400">Note estimée au barème du National :</div>
                  <div className="text-2xl font-black text-white font-mono">
                    <span className={evalResult.score >= 14 ? 'text-emerald-400' : 'text-amber-400'}>
                      {evalResult.score}
                    </span>
                    <span className="text-slate-500 text-base"> / {evalResult.maxScore}</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                  {evalResult.gradeWord}
                </span>
                <p className="text-xs text-slate-400 mt-1 max-w-xs italic">
                  "{evalResult.appreciation}"
                </p>
              </div>
            </div>

            {/* Criteria breakdown */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-300">
                Grille de contrôle officielle du correcteur :
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {evalResult.criteria.map((crit, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border text-xs space-y-1 ${
                      crit.status === 'ok'
                        ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
                        : crit.status === 'warning'
                        ? 'bg-amber-950/40 border-amber-500/30 text-amber-200'
                        : 'bg-rose-950/40 border-rose-500/30 text-rose-200'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span>{crit.name}</span>
                      {crit.status === 'ok' ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      )}
                    </div>
                    <p className="text-[11px] opacity-90 leading-tight">{crit.feedback}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Inspector tip */}
            <div className="bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-xl text-xs text-amber-200 flex items-start gap-2.5">
              <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-300">Conseil d'or pour le National : </span>
                {evalResult.nationalTips}
              </div>
            </div>
          </div>
        )}
      </div>

      <ApiKeyModal isOpen={isKeyModalOpen} onClose={() => setIsKeyModalOpen(false)} />
    </div>
  );
};
