import React, { useState } from 'react';
import {
  useMementoHistory,
  MementoCalculationRecord,
} from '../hooks/useMementoHistory';
import { MathView } from './MathView';
import {
  History,
  Trash2,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Search,
  ArrowRight,
  Database,
  Calendar,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface MementoHistoryPanelProps {
  onReuseCalculation: (formulaId: string, inputValues: Record<string, number>) => void;
  onAskProf?: (question: string) => void;
  onOpenCalculator: () => void;
}

export const MementoHistoryPanel: React.FC<MementoHistoryPanelProps> = ({
  onReuseCalculation,
  onAskProf,
  onOpenCalculator,
}) => {
  const { history, removeCalculation, clearHistory, totalCount } = useMementoHistory();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedDomain, setSelectedDomain] = useState<string>('Tous');
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);

  const domains = ['Tous', 'Ondes', 'Électricité', 'Chimie', 'Nucléaire', 'Mécanique'];

  // Filter history
  const filteredHistory = history.filter((item) => {
    const matchesDomain =
      selectedDomain === 'Tous' ||
      item.domain.toLowerCase().includes(selectedDomain.toLowerCase());
    const matchesSearch =
      item.formulaName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.resultFormatted.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.substitutionLatex.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesDomain && matchesSearch;
  });

  const handleCopy = (item: MementoCalculationRecord) => {
    const text = `${item.formulaName} : ${item.resultFormatted}\nCalcul : ${item.substitutionLatex}`;
    navigator.clipboard.writeText(text);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleAskProfFromHistory = (item: MementoCalculationRecord) => {
    if (onAskProf) {
      const prompt = `Si Driss, j'ai sauvegardé ce calcul dans mon historique pour "${item.formulaName}" :
Formule : $${item.latexFormula}$
Application : $${item.substitutionLatex}$
Résultat : ${item.resultFormatted}
Peux-tu m'expliquer ce que signifie physiquement cette valeur pour l'épreuve du Bac ?`;
      onAskProf(prompt);
    }
  };

  const formatTimestamp = (ts: number) => {
    const diffMs = Date.now() - ts;
    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMs / (3600 * 1000));
    const diffDays = Math.floor(diffMs / (86400 * 1000));

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    if (diffDays === 1) return 'Hier';
    return new Date(ts).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Controls Bar */}
      <div className="bg-[#18191b] border border-[#2e3034] rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Historique des Formules & Résultats
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#282a2c] text-amber-400">
                  {totalCount} calcul{totalCount > 1 ? 's' : ''}
                </span>
              </h3>
              <p className="text-[11px] text-[#8e918f] flex items-center gap-1">
                <Database className="w-3 h-3 text-emerald-400" />
                Sauvegardé automatiquement dans votre navigateur (localStorage)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenCalculator}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <span>+ Nouveau calcul</span>
            </button>

            {totalCount > 0 && (
              <>
                {showClearConfirm ? (
                  <div className="flex items-center gap-1 bg-rose-500/10 border border-rose-500/30 px-2 py-1 rounded-xl">
                    <span className="text-[10px] text-rose-300 font-medium">Tout effacer ?</span>
                    <button
                      onClick={() => {
                        clearHistory();
                        setShowClearConfirm(false);
                      }}
                      className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold"
                    >
                      Oui
                    </button>
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      className="px-1.5 py-0.5 bg-[#282a2c] hover:bg-[#323639] text-[#c4c7c5] rounded text-[10px]"
                    >
                      Non
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="p-2 rounded-xl text-[#8e918f] hover:text-rose-400 hover:bg-rose-500/10 transition"
                    title="Effacer tout l'historique"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Search & Domain Filter */}
        {totalCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#282a2c]">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#8e918f]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrer l'historique (ex: tau, pH, onde, 0.02)..."
                className="w-full bg-[#131314] border border-[#2e3034] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {domains.map((d) => (
                <button
                  key={d}
                  onClick={() => setSelectedDomain(d)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition ${
                    selectedDomain === d
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-[#1e1f20] text-[#8e918f] hover:text-white border border-[#2e3034]'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* History Items List or Empty State */}
      {filteredHistory.length === 0 ? (
        <div className="bg-[#18191b] border border-[#2e3034] rounded-2xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#1e1f20] border border-[#2e3034] flex items-center justify-center mx-auto text-[#8e918f]">
            <History className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-white">
              {totalCount === 0
                ? 'Aucun calcul enregistré pour le moment'
                : 'Aucun résultat ne correspond à votre filtre'}
            </h4>
            <p className="text-xs text-[#8e918f] max-w-md mx-auto">
              Utilisez le calculateur pour évaluer vos formules (constante de temps τ, longueur d'onde λ, pH, vitesse limite). Vos calculs seront conservés localement pour les réutiliser d'un simple clic !
            </p>
          </div>

          <div className="pt-2 flex flex-wrap justify-center gap-2">
            <button
              onClick={() => onReuseCalculation('electricite-rc-tau', { R_ohm: 1000, C_uF: 47 })}
              className="px-3 py-1.5 rounded-xl bg-[#1e1f20] hover:bg-[#282a2c] border border-[#2e3034] text-xs text-sky-300 font-medium transition"
            >
              Calculer <MathView content="$\tau = R \cdot C$" className="inline" />
            </button>
            <button
              onClick={() => onReuseCalculation('ondes-longueur-onde', { v: 20, N: 50 })}
              className="px-3 py-1.5 rounded-xl bg-[#1e1f20] hover:bg-[#282a2c] border border-[#2e3034] text-xs text-emerald-300 font-medium transition"
            >
              Calculer <MathView content="$\lambda = \frac{v}{N}$" className="inline" />
            </button>
            <button
              onClick={() => onReuseCalculation('chimie-ph-h3o', { h3o_mM: 2.5 })}
              className="px-3 py-1.5 rounded-xl bg-[#1e1f20] hover:bg-[#282a2c] border border-[#2e3034] text-xs text-amber-300 font-medium transition"
            >
              Calculer <MathView content="$pH = -\log[H_3O^+]$" className="inline" />
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredHistory.map((item) => (
            <div
              key={item.id}
              className="bg-[#18191b] border border-[#2e3034] hover:border-[#3c4043] rounded-2xl p-4 shadow-lg flex flex-col justify-between space-y-3 transition-all"
            >
              <div className="space-y-2.5">
                {/* Header: domain, formula name, relative date */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-amber-400">
                      {item.domain}
                    </span>
                    <h4 className="text-sm font-bold text-white mt-0.5 leading-snug">
                      {item.formulaName}
                    </h4>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-mono text-[#8e918f] bg-[#1e1f20] px-2 py-0.5 rounded-full border border-[#2e3034]">
                      {formatTimestamp(item.timestamp)}
                    </span>
                    <button
                      onClick={() => removeCalculation(item.id)}
                      className="p-1 rounded-lg text-[#8e918f] hover:text-rose-400 hover:bg-rose-500/10 transition"
                      title="Supprimer ce calcul"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Highlighted Result Strip */}
                <div className="bg-[#131314] border border-[#2e3034] rounded-xl p-3 flex items-center justify-between gap-3">
                  <div className="overflow-x-auto space-y-0.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Résultat calculé :
                    </div>
                    <div className="text-base font-bold font-mono text-emerald-400">
                      {item.resultFormatted}
                    </div>
                    {item.resultScientific && (
                      <div className="text-[10px] font-mono text-[#8e918f]">
                        <MathView content={`$${item.resultScientific}$`} className="inline" />
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleCopy(item)}
                    className="p-2 rounded-xl bg-[#1e1f20] hover:bg-[#282a2c] text-[#c4c7c5] hover:text-white border border-[#2e3034] transition shrink-0"
                    title="Copier le résultat et le calcul"
                  >
                    {copiedId === item.id ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Mathematical Substitution Step */}
                <div className="bg-[#1e1f20]/60 border border-[#2e3034]/70 rounded-xl p-2.5 text-xs">
                  <div className="text-[10px] text-[#8e918f] font-semibold mb-0.5">
                    Application numérique :
                  </div>
                  <div className="overflow-x-auto text-sky-300 font-mono py-0.5">
                    <MathView content={`$${item.substitutionLatex}$`} />
                  </div>
                </div>

                {/* Inputs badge list */}
                <div className="flex flex-wrap items-center gap-1 text-[11px] font-mono text-[#8e918f]">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Variables :</span>
                  {Object.entries(item.inputValues).map(([key, val]) => (
                    <span
                      key={key}
                      className="bg-[#1e1f20] px-2 py-0.5 rounded-md border border-[#2e3034] text-slate-200"
                    >
                      {key} = {val} {item.inputUnits?.[key] || ''}
                    </span>
                  ))}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-2 border-t border-[#282a2c] flex items-center justify-between gap-2">
                <button
                  onClick={() => onReuseCalculation(item.formulaId, item.inputValues)}
                  className="flex-1 py-1.5 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                  title="Charger ces paramètres dans le calculateur pour les recalculer ou les modifier"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Réutiliser ce calcul</span>
                </button>

                {onAskProf && (
                  <button
                    onClick={() => handleAskProfFromHistory(item)}
                    className="p-2 rounded-xl bg-[#1e1f20] hover:bg-[#282a2c] text-sky-400 hover:text-sky-300 border border-[#2e3034] transition shrink-0"
                    title="Demander une explication à Si Driss sur ce résultat"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
