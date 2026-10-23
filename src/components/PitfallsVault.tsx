import React, { useState } from 'react';
import { NATIONAL_PITFALLS, TrapItem } from '../data/pitfalls';
import { MathView } from './MathView';
import { AlertTriangle, ShieldAlert, CheckCircle2, XCircle, Sparkles, Filter } from 'lucide-react';

interface PitfallsVaultProps {
  onChallengeTrap: (trap: TrapItem) => void;
}

export const PitfallsVault: React.FC<PitfallsVaultProps> = ({ onChallengeTrap }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Tous');

  const categories = ['Tous', 'Mécanique', 'Électricité', 'Chimie', 'Ondes & Nucléaire', 'Rédaction Générale'];

  const filtered = NATIONAL_PITFALLS.filter(
    (t) => selectedCategory === 'Tous' || t.category === selectedCategory
  );

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-rose-950/60 via-slate-900 to-amber-950/40 border border-rose-500/30 rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-500/20 text-rose-400 rounded-2xl border border-rose-500/30">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Le Coffre des Pièges Fatals du National (2ème Bac PC)</h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Les 20 erreurs récurrentes sanctionnées impitoyablement par les correcteurs ministériels
            </p>
          </div>
        </div>

        {/* Categories */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCategory(c)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === c
                  ? 'bg-rose-600 text-white font-bold shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Traps Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filtered.map((trap) => (
          <div
            key={trap.id}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-4 hover:border-slate-700 transition-all"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 font-mono">
                  {trap.category}
                </span>
                <span className="text-[11px] font-mono font-bold text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                  Pénalité : {trap.penaltyEstimate}
                </span>
              </div>

              <h4 className="text-base font-bold text-white leading-snug">{trap.title}</h4>

              <MathView content={trap.trapDescription} className="text-xs text-slate-400 leading-relaxed" />

              {/* Bad vs Good Draft Comparison */}
              <div className="space-y-2 pt-1">
                {/* Bad draft */}
                <div className="bg-rose-950/30 border border-rose-500/20 p-3 rounded-xl text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-rose-400 font-bold text-[11px]">
                    <XCircle className="w-3.5 h-3.5" />
                    Rédaction bâclée (Sanctionnée au barème) :
                  </div>
                  <MathView content={trap.badDraft} className="text-slate-300 font-mono text-[11px]" />
                </div>

                {/* Good draft */}
                <div className="bg-emerald-950/30 border border-emerald-500/20 p-3 rounded-xl text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Rédaction type attendue (100% des points) :
                  </div>
                  <MathView content={trap.correctDraft} className="text-slate-200 font-mono text-[11px]" />
                </div>
              </div>

              {/* Si Driss tip */}
              <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl text-xs text-amber-200 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-300">Conseil de Si Driss : </span>
                  <MathView content={trap.siDrissTip} className="inline text-slate-300" />
                </div>
              </div>
            </div>

            <button
              onClick={() => onChallengeTrap(trap)}
              className="w-full py-2 px-3 rounded-xl bg-slate-950 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 text-xs font-semibold text-rose-300 flex items-center justify-center gap-1.5 transition-all"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              S'entraîner sur ce piège avec Si Driss
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
