import React, { useState, useEffect, useMemo } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';
import {
  CALCULABLE_FORMULAS,
  CalculableFormula,
} from '../data/calculableFormulas';
import { MathView } from './MathView';
import {
  X,
  Calculator,
  Save,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Info,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { useMementoHistory } from '../hooks/useMementoHistory';

interface FormulaCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFormulaId?: string | null;
  initialValues?: Record<string, number> | null;
  onAskProf?: (question: string) => void;
}

export const FormulaCalculatorModal: React.FC<FormulaCalculatorModalProps> = ({
  isOpen,
  onClose,
  initialFormulaId,
  initialValues,
  onAskProf,
}) => {
  const { addCalculation } = useMementoHistory();

  // Selected formula
  const [selectedFormulaId, setSelectedFormulaId] = useState<string>(
    initialFormulaId || CALCULABLE_FORMULAS[0].id
  );

  const formula: CalculableFormula = useMemo(() => {
    return (
      CALCULABLE_FORMULAS.find((f) => f.id === selectedFormulaId) ||
      CALCULABLE_FORMULAS[0]
    );
  }, [selectedFormulaId]);

  // Input states
  const [inputs, setInputs] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    formula.variables.forEach((v) => {
      initial[v.symbol] = initialValues?.[v.symbol] ?? v.defaultVal;
    });
    return initial;
  });

  // Keep track of copied state
  const [copied, setCopied] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Sync inputs when formula changes or initial values change
  useEffect(() => {
    if (initialFormulaId) {
      setSelectedFormulaId(initialFormulaId);
    }
  }, [initialFormulaId]);

  useEffect(() => {
    const nextInputs: Record<string, number> = {};
    formula.variables.forEach((v) => {
      if (initialValues && initialValues[v.symbol] !== undefined) {
        nextInputs[v.symbol] = initialValues[v.symbol];
      } else {
        nextInputs[v.symbol] = v.defaultVal;
      }
    });
    setInputs(nextInputs);
  }, [formula, initialValues]);

  // Compute live result safely
  const calculationResult = useMemo(() => {
    try {
      return formula.compute(inputs);
    } catch {
      return {
        value: 0,
        formatted: 'Erreur de calcul',
        scientific: '---',
        unit: formula.targetUnit,
        substitutionLatex: '\\text{Erreur de calcul}',
      };
    }
  }, [formula, inputs]);

  // (M14) Accessibilité : rôle dialog, Échap, piège de focus
  const dialogRef = useModalA11y(isOpen, onClose);

  if (!isOpen) return null;

  const handleInputChange = (symbol: string, val: string) => {
    const num = parseFloat(val);
    setInputs((prev) => ({
      ...prev,
      [symbol]: isNaN(num) ? 0 : num,
    }));
  };

  const handleReset = () => {
    const defaultInputs: Record<string, number> = {};
    formula.variables.forEach((v) => {
      defaultInputs[v.symbol] = v.defaultVal;
    });
    setInputs(defaultInputs);
  };

  const handleSaveToHistory = () => {
    const inputUnits: Record<string, string> = {};
    const inputLabels: Record<string, string> = {};

    formula.variables.forEach((v) => {
      inputUnits[v.symbol] = v.unit;
      inputLabels[v.symbol] = v.label;
    });

    addCalculation({
      formulaId: formula.id,
      formulaName: formula.name,
      domain: formula.domain,
      latexFormula: formula.latex,
      inputValues: { ...inputs },
      inputUnits,
      inputLabels,
      resultValue: calculationResult.value,
      resultFormatted: calculationResult.formatted,
      resultScientific: calculationResult.scientific,
      resultUnit: calculationResult.unit,
      substitutionLatex: calculationResult.substitutionLatex,
    });

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2200);
  };

  const handleCopyResult = () => {
    const textToCopy = `${formula.name} : ${calculationResult.formatted} (Étape : ${calculationResult.substitutionLatex})`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAskSiDriss = () => {
    if (onAskProf) {
      const prompt = `Si Driss, j'ai effectué le calcul suivant avec la formule "${formula.name}" :
Application numérique : $${calculationResult.substitutionLatex}$
Résultat : ${calculationResult.formatted} (${calculationResult.scientific}).
Peux-tu me confirmer si les unités sont conformes au barème du Bac et si cet ordre de grandeur est réaliste au National ?`;
      onAskProf(prompt);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Calculateur de formules"
        tabIndex={-1}
        className="bg-[#18191b] border border-[#2e3034] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#282a2c] flex items-center justify-between bg-[#131314]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Calculateur Express du Mémento</h3>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-[#282a2c] text-amber-400 font-bold">
                  {formula.domain}
                </span>
              </div>
              <p className="text-xs text-[#8e918f]">
                Calcul numérique avec conversion automatique et sauvegarde locale
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-[#8e918f] hover:text-white hover:bg-[#282a2c] transition"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 no-scrollbar">
          {/* Formula Selector Bar */}
          <div>
            <label className="block text-xs font-semibold text-[#c4c7c5] mb-1.5">
              Choisir la formule à calculer :
            </label>
            <select
              value={selectedFormulaId}
              onChange={(e) => setSelectedFormulaId(e.target.value)}
              className="w-full bg-[#1e1f20] border border-[#3c4043] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 transition"
            >
              {CALCULABLE_FORMULAS.map((f) => (
                <option key={f.id} value={f.id}>
                  [{f.domain}] {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Formula Preview */}
          <div className="py-3 flex flex-col items-center justify-center text-center space-y-2">
            <div className="text-xs text-amber-400 font-medium">{formula.description}</div>
            <div className="py-2.5">
              <MathView content={`$$${formula.latex}$$`} block className="text-sky-300 font-bold text-lg" />
            </div>
            {formula.examNote && (
              <div className="flex items-center gap-1.5 text-[11px] text-[#8e918f] bg-[#131314]/80 px-3 py-1.5 rounded-lg border border-[#2e3034]">
                <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{formula.examNote}</span>
              </div>
            )}
          </div>

          {/* Variables Input Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#c4c7c5]">
                Variables d'entrée :
              </span>
              <button
                onClick={handleReset}
                className="flex items-center gap-1 text-[11px] text-[#8e918f] hover:text-white transition"
                title="Rétablir les valeurs par défaut"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Valeurs types Bac</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {formula.variables.map((variable) => (
                <div
                  key={variable.symbol}
                  className="bg-[#1e1f20] border border-[#2e3034] rounded-xl p-3 space-y-1.5 focus-within:border-amber-500/60 transition"
                >
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-medium text-slate-200">
                      {variable.label}
                    </label>
                    <span className="font-mono text-[11px] text-amber-400 font-semibold">
                      [{variable.unit}]
                    </span>
                  </div>

                  <div className="relative flex items-center">
                    <input
                      type="number"
                      step={variable.step ?? 'any'}
                      min={variable.min}
                      value={inputs[variable.symbol] ?? ''}
                      onChange={(e) => handleInputChange(variable.symbol, e.target.value)}
                      className="w-full bg-[#131314] border border-[#3c4043] rounded-lg px-3 py-2 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                    />
                    <span className="absolute right-3 text-xs text-[#8e918f] font-mono pointer-events-none">
                      {variable.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Result Presentation Box */}
          <div className="bg-gradient-to-br from-amber-500/10 via-[#1e1f20] to-emerald-500/10 border border-amber-500/30 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Résultat calculé
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCopyResult}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1e1f20] hover:bg-[#282a2c] text-[11px] font-medium text-[#c4c7c5] hover:text-white border border-[#3c4043] transition"
                  title="Copier le résultat"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copié</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copier</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Big Result Output */}
            <div className="text-center py-2 space-y-1">
              <div className="text-2xl sm:text-3xl font-bold font-mono text-emerald-400 tracking-tight">
                {calculationResult.formatted}
              </div>
              <div className="text-xs font-mono text-[#8e918f]">
                Écriture scientifique :{' '}
                <MathView content={`$${calculationResult.scientific}$`} className="inline text-white font-bold" />
              </div>
            </div>

            {/* Substitution step without constraining frame */}
            <div className="py-2 text-xs space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Application Numérique (Rédaction recommandée) :
              </div>
              <div className="text-sky-300 font-bold py-2 leading-relaxed">
                <MathView content={`$${calculationResult.substitutionLatex}$`} block={false} className="font-bold" />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-[#282a2c] bg-[#131314] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveToHistory}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                saveSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold'
              }`}
            >
              {saveSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Enregistré dans l'historique !</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Conserver dans l'Historique (localStorage)</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {onAskProf && (
              <button
                onClick={handleAskSiDriss}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1e1f20] hover:bg-[#282a2c] border border-[#3c4043] text-xs font-medium text-sky-400 hover:text-sky-300 transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Vérifier avec Si Driss</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-[#282a2c] hover:bg-[#323639] text-xs font-medium text-white transition"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
