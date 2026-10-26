import React, { useState } from 'react';
import {
  FlaskConical,
  Compass,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  X,
} from 'lucide-react';
import { StudentBranch, useBranch } from '../hooks/useBranch';

interface BranchSelectorModalProps {
  isOpen: boolean;
  onClose?: () => void;
  canClose?: boolean;
}

export const BranchSelectorModal: React.FC<BranchSelectorModalProps> = ({
  isOpen,
  onClose,
  canClose = false,
}) => {
  const { branch, selectBranch } = useBranch();
  const [selected, setSelected] = useState<StudentBranch>(branch || 'PC');

  if (!isOpen) return null;

  const handleSelectBranch = (b: StudentBranch) => {
    setSelected(b);
    selectBranch(b);
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(15);
      } catch {}
    }
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-slate-900 p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg">
              SD
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white tracking-tight">
                  Bienvenue avec Si Driss
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  National 2026
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Choisis ta filière du Baccalauréat marocain (Option Français - BIOF)
              </p>
            </div>
          </div>

          {canClose && onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          <div className="text-center space-y-1.5">
            <h3 className="text-sm font-bold text-slate-200">
              Dans quelle filière prépares-tu ton Examen National ?
            </h3>
            <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
              Clique directement sur ta filière. Le programme, les formules et les réponses de Si Driss
              s'adapteront immédiatement au Cadre de Référence officiel.
            </p>
          </div>

          {/* Cards Grid - 1-Click Instant Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: 2ème Bac PC */}
            <div
              onClick={() => handleSelectBranch('PC')}
              className={`group cursor-pointer rounded-2xl p-5 border-2 transition-all relative flex flex-col justify-between ${
                selected === 'PC'
                  ? 'bg-amber-500/10 border-amber-500 shadow-lg shadow-amber-500/10'
                  : 'bg-slate-950/60 border-slate-800 hover:border-amber-500/60 hover:bg-slate-900/80'
              }`}
            >
              {selected === 'PC' && (
                <div className="absolute top-4 right-4 text-amber-400">
                  <CheckCircle2 className="w-5 h-5 fill-amber-500 text-slate-950" />
                </div>
              )}

              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  <FlaskConical className="w-5 h-5" />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-white text-base">2ème Bac PC</h4>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      Coeff. 7
                    </span>
                  </div>
                  <p className="text-xs text-amber-400 font-semibold mt-0.5">
                    Sciences Physiques (BIOF)
                  </p>
                </div>

                <ul className="space-y-1.5 text-[11px] text-slate-300 pt-2 border-t border-slate-800/80">
                  <li className="flex items-start gap-1.5">
                    <span className="text-amber-400 font-bold">•</span>
                    <span>Modulation & Démodulation d'amplitude (AM)</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-amber-400 font-bold">•</span>
                    <span>Méthode d'Euler & chute verticale avec frottement</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-amber-400 font-bold">•</span>
                    <span>Analyse dimensionnelle & études graphiques approfondies</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-amber-400 font-bold">•</span>
                    <span>Barème officiel & sujets nationaux de la section PC</span>
                  </li>
                </ul>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-400">Sciences Physiques</span>
                <span className="font-bold text-amber-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                  <span>Choisir PC</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>

            {/* Card 2: 2ème Bac SM */}
            <div
              onClick={() => handleSelectBranch('SM')}
              className={`group cursor-pointer rounded-2xl p-5 border-2 transition-all relative flex flex-col justify-between ${
                selected === 'SM'
                  ? 'bg-blue-500/10 border-blue-500 shadow-lg shadow-blue-500/10'
                  : 'bg-slate-950/60 border-slate-800 hover:border-blue-500/60 hover:bg-slate-900/80'
              }`}
            >
              {selected === 'SM' && (
                <div className="absolute top-4 right-4 text-blue-400">
                  <CheckCircle2 className="w-5 h-5 fill-blue-500 text-slate-950" />
                </div>
              )}

              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                  <Compass className="w-5 h-5" />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-white text-base">2ème Bac SM</h4>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
                      Coeff. 7 • A & B
                    </span>
                  </div>
                  <p className="text-xs text-blue-400 font-semibold mt-0.5">
                    Sciences Mathématiques (BIOF)
                  </p>
                </div>

                <ul className="space-y-1.5 text-[11px] text-slate-300 pt-2 border-t border-slate-800/80">
                  <li className="flex items-start gap-1.5">
                    <span className="text-blue-400 font-bold">•</span>
                    <span>Rotation solide autour d'un axe fixe (RFD : &Sigma;M<sub>&Delta;</sub> = J<sub>&Delta;</sub> &theta;&uml;)</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-blue-400 font-bold">•</span>
                    <span>Oscillations forcées & Résonance électrique et mécanique</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-blue-400 font-bold">•</span>
                    <span>Impédance $Z$, bande passante & facteur de qualité $Q$</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-blue-400 font-bold">•</span>
                    <span>Rigueur mathématique accrue pour l'épreuve SM</span>
                  </li>
                </ul>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-400">Sciences Mathématiques</span>
                <span className="font-bold text-blue-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                  <span>Choisir SM</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3.5 flex items-center gap-3 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Tu pourras basculer entre <strong>PC</strong> et <strong>SM</strong> à tout moment en cliquant sur le badge de ta filière dans le menu principal.
            </span>
          </div>
        </div>

        {/* Footer (Simplified - No redundant confirm button) */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between gap-3 text-xs text-slate-400">
          <span>
            Clique directement sur une carte pour valider ton choix instantanément.
          </span>
          {canClose && onClose && (
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition"
            >
              Fermer
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
