import React, { useState } from 'react';
import { CURRICULUM, ChapterInfo } from '../data/curriculum';
import { MathView } from './MathView';
import {
  Search,
  Copy,
  Check,
  Sparkles,
  ArrowUpRight,
  Calculator,
  History,
  BookOpen,
} from 'lucide-react';
import { useBranch } from '../hooks/useBranch';
import { useMementoHistory } from '../hooks/useMementoHistory';
import { FormulaCalculatorModal } from './FormulaCalculatorModal';
import { MementoHistoryPanel } from './MementoHistoryPanel';
import { CALCULABLE_FORMULAS } from '../data/calculableFormulas';

interface FormulaCheatSheetProps {
  onAskProfAboutChapter: (chapter: ChapterInfo) => void;
  onAskProfCustom?: (prompt: string) => void;
}

export const FormulaCheatSheet: React.FC<FormulaCheatSheetProps> = ({
  onAskProfAboutChapter,
  onAskProfCustom,
}) => {
  const { branch } = useBranch();
  const { history, totalCount } = useMementoHistory();

  // Navigation tab inside Mémento
  const [activeSubTab, setActiveSubTab] = useState<'formulas' | 'history'>('formulas');

  // Search & domain filters for formulas
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedDomain, setSelectedDomain] = useState<string>('Tous');
  const [copiedFormula, setCopiedFormula] = useState<string | null>(null);

  // Calculator modal state
  const [isCalculatorOpen, setIsCalculatorOpen] = useState<boolean>(false);
  const [calculatorFormulaId, setCalculatorFormulaId] = useState<string | null>(null);
  const [calculatorInitialValues, setCalculatorInitialValues] = useState<Record<string, number> | null>(null);

  const domains = [
    'Tous',
    'Ondes',
    'Nucléaire',
    'Électricité',
    'Mécanique',
    'Cinétique Chimique',
    'Équilibre & Acido-basique',
    'Électrochimie',
    'Chimie Organique',
  ];

  const filteredChapters = CURRICULUM.filter((c) => {
    const matchesBranch = !c.branches || c.branches.includes(branch);
    const matchesDomain =
      selectedDomain === 'Tous' ||
      c.domain.toLowerCase().includes(selectedDomain.toLowerCase());
    const matchesSearch =
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.keyFormulas.some(
        (f) =>
          f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          f.latex.toLowerCase().includes(searchTerm.toLowerCase())
      );
    return matchesBranch && matchesDomain && matchesSearch;
  });

  const handleCopy = (latex: string) => {
    navigator.clipboard.writeText(`$${latex}$`);
    setCopiedFormula(latex);
    setTimeout(() => setCopiedFormula(null), 1500);
  };

  const findCalculableFormulaId = (fName: string, latex: string): string | null => {
    const lower = (fName + ' ' + latex).toLowerCase();
    if (lower.includes('célérité') || lower.includes('v = \\frac{d}')) return 'ondes-celerite';
    if (lower.includes('longueur') || lower.includes('\\lambda = \\frac{v}')) return 'ondes-longueur-onde';
    if (lower.includes('écart angulaire') || lower.includes('\\theta = \\frac{\\lambda}{a}')) return 'ondes-diffraction-fente';
    if (lower.includes('constante de temps tau') || lower.includes('\\tau = r \\cdot c') || lower.includes('\\tau = rc')) return 'electricite-rc-tau';
    if (lower.includes('dipôle rl') || lower.includes('\\tau = \\frac{l}{r')) return 'electricite-rl-tau';
    if (lower.includes('période propre') || lower.includes('t_0 = 2\\pi \\sqrt{l')) return 'electricite-rlc-t0';
    if (lower.includes('demi-vie') || lower.includes('t_{1/2}')) return 'nucleaire-demi-vie';
    if (lower.includes('décroissance') || lower.includes('n_0 \\cdot e')) return 'nucleaire-decroissance';
    if (lower.includes('ph') && lower.includes('\\log')) return 'chimie-ph-h3o';
    if (lower.includes('tau') && lower.includes('avancement')) return 'chimie-tau-avancement';
    if (lower.includes('henderson') || lower.includes('pk_a')) return 'chimie-henderson-ph';
    if (lower.includes('vitesse limite') || lower.includes('v_{lim}')) return 'meca-poids-chute';
    if (lower.includes('cinétique') || lower.includes('\\frac{1}{2} m v^2')) return 'meca-energie-cinetique';
    if (lower.includes('modulation') || lower.includes('u_{max} - u_{min}')) return 'electricite-am-taux';
    return null;
  };

  const handleOpenCalculatorWithFormula = (formulaId: string | null = null) => {
    setCalculatorFormulaId(formulaId);
    setCalculatorInitialValues(null);
    setIsCalculatorOpen(true);
  };

  const handleReuseCalculation = (formulaId: string, inputValues: Record<string, number>) => {
    setCalculatorFormulaId(formulaId);
    setCalculatorInitialValues(inputValues);
    setIsCalculatorOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Nav Strip: Fiches vs Historique vs Calculateur */}
      <div className="bg-[#18191b] border border-[#282a2c] rounded-2xl p-2.5 flex flex-wrap items-center justify-between gap-2 shadow-lg">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveSubTab('formulas')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
              activeSubTab === 'formulas'
                ? 'bg-[#282a2c] text-white shadow-sm border border-[#3c4043]'
                : 'text-[#8e918f] hover:text-white hover:bg-[#1e1f20]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>Formules du Cadre ({filteredChapters.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('history')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
              activeSubTab === 'history'
                ? 'bg-[#282a2c] text-white shadow-sm border border-[#3c4043]'
                : 'text-[#8e918f] hover:text-white hover:bg-[#1e1f20]'
            }`}
          >
            <History className="w-3.5 h-3.5 text-sky-400" />
            <span>Historique des Calculs</span>
            {totalCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {totalCount}
              </span>
            )}
          </button>
        </div>

        <button
          onClick={() => handleOpenCalculatorWithFormula(null)}
          className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-sm ml-auto"
        >
          <Calculator className="w-3.5 h-3.5" />
          <span>Calculateur Express</span>
        </button>
      </div>

      {/* Quick History Banner (shown on Formulas tab if history has items) */}
      {activeSubTab === 'formulas' && history.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-[#18191b] to-sky-500/10 border border-amber-500/30 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-[#8e918f] text-[11px] shrink-0">Dernier calcul sauvegardé :</span>
            <span className="text-white font-medium truncate">{history[0].formulaName}</span>
            <span className="text-emerald-400 font-mono font-bold shrink-0">{history[0].resultFormatted}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleReuseCalculation(history[0].formulaId, history[0].inputValues)}
              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold text-[11px] border border-amber-500/40 transition"
            >
              Réutiliser
            </button>
            <button
              onClick={() => setActiveSubTab('history')}
              className="text-[#8e918f] hover:text-white text-[11px] underline"
            >
              Historique complet ({history.length})
            </button>
          </div>
        </div>
      )}

      {/* TAB CONTENT: HISTORY PANEL */}
      {activeSubTab === 'history' && (
        <MementoHistoryPanel
          onReuseCalculation={handleReuseCalculation}
          onAskProf={onAskProfCustom}
          onOpenCalculator={() => handleOpenCalculatorWithFormula(null)}
        />
      )}

      {/* TAB CONTENT: FORMULAS CHEATSHEET */}
      {activeSubTab === 'formulas' && (
        <div className="space-y-6">
          {/* Search & Domain Filter Bar */}
          <div className="bg-[#18191b] border border-[#282a2c] rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#8e918f]" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Rechercher une formule, un chapitre, une grandeur (ex: tau, v_lim, pH, lambda)..."
                  className="w-full bg-[#131314] border border-[#2e3034] rounded-xl pl-10 pr-4 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs text-[#8e918f] font-mono">
                <span>{filteredChapters.length} chapitres du Cadre de Référence</span>
              </div>
            </div>

            {/* Domain Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
              {domains.map((d) => (
                <button
                  key={d}
                  onClick={() => setSelectedDomain(d)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedDomain === d
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                      : 'bg-[#131314] text-[#8e918f] hover:text-white border border-[#282a2c]'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Chapters & Formulas Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredChapters.map((chapter) => (
              <div
                key={chapter.id}
                className="bg-[#18191b] border border-[#282a2c] rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-4 hover:border-[#3c4043] transition-all"
              >
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 font-mono">
                        {chapter.subject} • {chapter.domain}
                      </span>
                      <h3 className="text-base font-bold text-white mt-0.5 leading-snug">
                        {chapter.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {chapter.branches && chapter.branches.length === 1 && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            chapter.branches.includes('SM')
                              ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                              : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          }`}
                        >
                          Spécifique {chapter.branches[0]}
                        </span>
                      )}
                      <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        {chapter.weightInExam}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-[#8e918f] leading-relaxed">
                    {chapter.summary}
                  </p>

                  {/* Key Formulas Section */}
                  <div className="space-y-2 pt-1">
                    <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wide">
                      Formules Clés du Cadre de Référence :
                    </span>
                    <div className="space-y-2">
                      {chapter.keyFormulas.map((f, i) => {
                        const calculableId = findCalculableFormulaId(f.name, f.latex);
                        return (
                          <div
                            key={i}
                            className="bg-[#131314] p-3 rounded-xl border border-[#282a2c] flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="space-y-0.5 overflow-x-auto min-w-0">
                              <div className="text-[10px] text-slate-400 font-semibold truncate">
                                {f.name}
                              </div>
                              <MathView
                                content={`$${f.latex}$`}
                                className="font-bold text-sky-300"
                              />
                              <div className="text-[10px] text-[#8e918f] font-mono">
                                <MathView content={f.units} className="inline" />
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {calculableId && (
                                <button
                                  onClick={() => handleOpenCalculatorWithFormula(calculableId)}
                                  className="px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-semibold flex items-center gap-1 transition"
                                  title="Calculer avec cette formule"
                                >
                                  <Calculator className="w-3 h-3" />
                                  <span>Calculer</span>
                                </button>
                              )}

                              <button
                                onClick={() => handleCopy(f.latex)}
                                className="p-1.5 rounded-lg bg-[#1e1f20] hover:bg-[#282a2c] text-[#8e918f] hover:text-white transition-colors shrink-0"
                                title="Copier le code LaTeX"
                              >
                                {copiedFormula === f.latex ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* National Checklist */}
                  <div className="bg-[#131314]/70 p-3 rounded-xl border border-[#282a2c]/80 space-y-1 text-xs">
                    <span className="text-[11px] font-bold text-amber-300">
                      Exigences officielles du National :
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-[#c4c7c5] text-[11px]">
                      {chapter.nationalChecklist.slice(0, 2).map((item, idx) => (
                        <li key={idx}>
                          <MathView content={item} className="inline" />
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Bottom Action */}
                <button
                  onClick={() => onAskProfAboutChapter(chapter)}
                  className="w-full py-2 px-3 rounded-xl bg-[#131314] hover:bg-amber-500/10 border border-[#282a2c] hover:border-amber-500/40 text-xs font-semibold text-amber-400 flex items-center justify-center gap-1.5 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Poser une question à Si Driss sur ce chapitre
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formula Calculator Modal */}
      <FormulaCalculatorModal
        isOpen={isCalculatorOpen}
        onClose={() => setIsCalculatorOpen(false)}
        initialFormulaId={calculatorFormulaId}
        initialValues={calculatorInitialValues}
        onAskProf={onAskProfCustom}
      />
    </div>
  );
};
