import React, { useState } from 'react';
import { CURRICULUM, ChapterInfo } from '../data/curriculum';
import { MathView } from './MathView';
import { Search, Filter, Copy, Check, Sparkles, BookMarked, ArrowUpRight } from 'lucide-react';
import { useBranch } from '../hooks/useBranch';

interface FormulaCheatSheetProps {
  onAskProfAboutChapter: (chapter: ChapterInfo) => void;
}

export const FormulaCheatSheet: React.FC<FormulaCheatSheetProps> = ({ onAskProfAboutChapter }) => {
  const { branch, isSM } = useBranch();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedDomain, setSelectedDomain] = useState<string>('Tous');
  const [copiedFormula, setCopiedFormula] = useState<string | null>(null);

  const domains = ['Tous', 'Ondes', 'Nucléaire', 'Électricité', 'Mécanique', 'Cinétique Chimique', 'Équilibre & Acido-basique', 'Électrochimie', 'Chimie Organique'];

  const filteredChapters = CURRICULUM.filter((c) => {
    const matchesBranch = !c.branches || c.branches.includes(branch);
    const matchesDomain = selectedDomain === 'Tous' || c.domain.toLowerCase().includes(selectedDomain.toLowerCase());
    const matchesSearch =
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.keyFormulas.some((f) => f.name.toLowerCase().includes(searchTerm.toLowerCase()) || f.latex.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesBranch && matchesDomain && matchesSearch;
  });

  const handleCopy = (latex: string) => {
    navigator.clipboard.writeText(`$${latex}$`);
    setCopiedFormula(latex);
    setTimeout(() => setCopiedFormula(null), 1500);
  };

  return (
    <div className="space-y-6">
      {/* Search & Domain Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher une formule, un chapitre, une grandeur (ex: tau, v_lim, pH, lambda)..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
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
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
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
            className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-4 hover:border-slate-700 transition-all"
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
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      chapter.branches.includes('SM')
                        ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                        : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    }`}>
                      Spécifique {chapter.branches[0]}
                    </span>
                  )}
                  <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    {chapter.weightInExam}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                {chapter.summary}
              </p>

              {/* Key Formulas Section */}
              <div className="space-y-2 pt-1">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wide">
                  Formules Clés du Cadre de Référence :
                </span>
                <div className="space-y-2">
                  {chapter.keyFormulas.map((f, i) => (
                    <div
                      key={i}
                      className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5 overflow-x-auto">
                        <div className="text-[10px] text-slate-400 font-semibold">{f.name}</div>
                        <MathView content={`$${f.latex}$`} className="font-bold text-sky-300" />
                        <div className="text-[10px] text-slate-500 font-mono">
                          <MathView content={f.units} className="inline" />
                        </div>
                      </div>

                      <button
                        onClick={() => handleCopy(f.latex)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors shrink-0"
                        title="Copier le code LaTeX"
                      >
                        {copiedFormula === f.latex ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* National Checklist */}
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 space-y-1 text-xs">
                <span className="text-[11px] font-bold text-amber-300">
                  Exigences officielles du National :
                </span>
                <ul className="list-disc list-inside space-y-0.5 text-slate-300 text-[11px]">
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
              className="w-full py-2 px-3 rounded-xl bg-slate-950 hover:bg-amber-500/10 border border-slate-800 hover:border-amber-500/40 text-xs font-semibold text-amber-400 flex items-center justify-center gap-1.5 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Poser une question à Si Driss sur ce chapitre
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
