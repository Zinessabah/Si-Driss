import React, { useState } from 'react';
import {
  X,
  TrendingUp,
  GitFork,
  Send,
  Sliders,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { CURVE_PRESETS, MINDMAP_PRESETS, CurvePreset } from '../data/graphicsPresets';
import {
  ScientificGraphicsRenderer,
  CurveChartSpec,
  MindMapSpec,
} from './ScientificGraphicsRenderer';
import { useModalA11y } from '../hooks/useModalA11y';

interface GraphicsGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCurveForPrompt?: (promptText: string, curveSpecJson?: string) => void;
  userBranch?: 'PC' | 'SM';
}

export const GraphicsGalleryModal: React.FC<GraphicsGalleryModalProps> = ({
  isOpen,
  onClose,
  onSelectCurveForPrompt,
  userBranch = 'PC',
}) => {
  const modalRef = useModalA11y(isOpen, onClose);
  const [activeTab, setActiveTab] = useState<'curves' | 'mindmaps' | 'custom'>('curves');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('rc-charge');
  const [selectedMindMapIndex, setSelectedMindMapIndex] = useState<number>(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Custom function editor state
  const [customTitle, setCustomTitle] = useState<string>('Courbe personnalisée');
  const [customFn, setCustomFn] = useState<string>('4 * Math.sin(2 * x) * Math.exp(-0.2 * x)');
  const [customXLabel, setCustomXLabel] = useState<string>('t (s)');
  const [customYLabel, setCustomYLabel] = useState<string>('y (m)');
  const [customXMin, setCustomXMin] = useState<number>(0);
  const [customXMax, setCustomXMax] = useState<number>(10);
  const [customYMin, setCustomYMin] = useState<number>(-5);
  const [customYMax, setCustomYMax] = useState<number>(5);

  if (!isOpen) return null;

  const filteredPresets = CURVE_PRESETS.filter((p) => {
    if (selectedCategory !== 'ALL' && p.category !== selectedCategory) return false;
    if (p.branch !== 'ALL' && p.branch !== userBranch) return false;
    return true;
  });

  const activeCurvePreset =
    CURVE_PRESETS.find((p) => p.id === selectedPresetId) || CURVE_PRESETS[0];

  const currentCustomSpec: CurveChartSpec = {
    type: 'curve',
    title: customTitle,
    xLabel: customXLabel,
    yLabel: customYLabel,
    xMin: customXMin,
    xMax: customXMax,
    yMin: customYMin,
    yMax: customYMax,
    function: customFn,
    color: '#38bdf8',
  };

  const handleAskAboutCurve = (preset: CurvePreset) => {
    const specBlock = `\`\`\`curve\n${JSON.stringify(preset.spec, null, 2)}\n\`\`\``;
    const fullText = `${preset.suggestedPrompt}\n\n${specBlock}`;
    onSelectCurveForPrompt?.(fullText, JSON.stringify(preset.spec));
    onClose();
  };

  const handleAskAboutCustom = () => {
    const specBlock = `\`\`\`curve\n${JSON.stringify(currentCustomSpec, null, 2)}\n\`\`\``;
    const fullText = `Si Driss, analyse et explique le comportement physique de cette fonction $f(x) = ${customFn}$ :\n\n${specBlock}`;
    onSelectCurveForPrompt?.(fullText, JSON.stringify(currentCustomSpec));
    onClose();
  };

  const handleAskAboutMindmap = (mm: MindMapSpec) => {
    const specBlock = `\`\`\`mindmap\n${JSON.stringify(mm, null, 2)}\n\`\`\``;
    const fullText = `Si Driss, développe et détaille les liens de cette carte mentale sur "${mm.title}" :\n\n${specBlock}`;
    onSelectCurveForPrompt?.(fullText, JSON.stringify(mm));
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Galerie des Courbes & Graphiques Scientifiques"
        tabIndex={-1}
        className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-[#131314] border border-[#3c4043] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#282a2c] bg-[#1a1b1e]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Tracer & Analyser des Courbes Graphiques
                <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30">
                  2ème Bac {userBranch}
                </span>
              </h3>
              <p className="text-xs text-[#9aa0a6]">
                Générez, explorez et insérez les graphiques d’examens nationaux (tangentes, asymptotes, résonance).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[#282a2c] text-[#9aa0a6] hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-[#282a2c] bg-[#16171a] overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('curves')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
              activeTab === 'curves'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-xs'
                : 'text-[#9aa0a6] hover:text-white hover:bg-[#282a2c]'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Courbes du Bac ({filteredPresets.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('mindmaps')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
              activeTab === 'mindmaps'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                : 'text-[#9aa0a6] hover:text-white hover:bg-[#282a2c]'
            }`}
          >
            <GitFork className="w-4 h-4" />
            Cartes Mentales (Mindmaps)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('custom')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
              activeTab === 'custom'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                : 'text-[#9aa0a6] hover:text-white hover:bg-[#282a2c]'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Tracer f(x) sur mesure
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {activeTab === 'curves' && (
            <div className="space-y-4">
              {/* Category Pills Filter */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {['ALL', 'Électricité', 'Nucléaire', 'Chimie', 'Mécanique'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                      selectedCategory === cat
                        ? 'bg-[#282a2c] text-white border border-[#3c4043]'
                        : 'text-[#9aa0a6] hover:text-white hover:bg-[#1e1f20]'
                    }`}
                  >
                    {cat === 'ALL' ? 'Toutes les matières' : cat}
                  </button>
                ))}
              </div>

              {/* Presets Horizontal Selector */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {filteredPresets.map((p) => {
                  const isSelected = p.id === activeCurvePreset.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPresetId(p.id)}
                      className={`p-2.5 rounded-2xl border text-left transition flex flex-col justify-between ${
                        isSelected
                          ? 'border-sky-500 bg-sky-500/10 shadow-md ring-1 ring-sky-500/50'
                          : 'border-[#282a2c] bg-[#1e1f20]/60 hover:bg-[#1e1f20] hover:border-[#3c4043]'
                      }`}
                    >
                      <div className="text-xs font-bold text-white line-clamp-1">{p.spec.title}</div>
                      <div className="text-[11px] text-[#9aa0a6] line-clamp-2 mt-1">{p.description}</div>
                      <div className="mt-2 text-[10px] text-sky-400 font-semibold flex items-center gap-1">
                        <span>{p.category}</span>
                        {p.branch === 'SM' && (
                          <span className="px-1 py-0.2 rounded bg-indigo-500/30 text-indigo-300">SM</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Render Selected Preset */}
              <div className="pt-2">
                <ScientificGraphicsRenderer spec={activeCurvePreset.spec} />
              </div>

              {/* Action Bar */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-[#1e1f20] border border-[#282a2c]">
                <div className="text-xs text-[#c4c7c5] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Poser une question ou demander l'audit de cette courbe à Si Driss</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleAskAboutCurve(activeCurvePreset)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  Demander à Si Driss
                </button>
              </div>
            </div>
          )}

          {activeTab === 'mindmaps' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {MINDMAP_PRESETS.map((mm, idx) => (
                  <button
                    key={mm.title}
                    type="button"
                    onClick={() => setSelectedMindMapIndex(idx)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                      selectedMindMapIndex === idx
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                        : 'border-[#282a2c] bg-[#1e1f20] text-[#9aa0a6] hover:text-white'
                    }`}
                  >
                    {mm.title}
                  </button>
                ))}
              </div>

              <ScientificGraphicsRenderer spec={MINDMAP_PRESETS[selectedMindMapIndex]} />

              <div className="flex items-center justify-between p-3 rounded-2xl bg-[#1e1f20] border border-[#282a2c]">
                <div className="text-xs text-[#c4c7c5] flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Insérer cette carte mentale pour réviser avec Si Driss</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleAskAboutMindmap(MINDMAP_PRESETS[selectedMindMapIndex])}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  Réviser ce chapitre
                </button>
              </div>
            </div>
          )}

          {activeTab === 'custom' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#1e1f20] border border-[#282a2c] space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#c4c7c5] mb-1">Titre du graphique</label>
                    <input
                      type="text"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#131314] border border-[#3c4043] text-xs text-white outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#c4c7c5] mb-1">
                      Fonction f(x) (ex: Math.exp(-x/2), Math.sin(x), etc.)
                    </label>
                    <input
                      type="text"
                      value={customFn}
                      onChange={(e) => setCustomFn(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#131314] border border-[#3c4043] text-xs text-amber-300 font-mono outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[11px] text-[#9aa0a6] mb-1">Nom Axe X</label>
                    <input
                      type="text"
                      value={customXLabel}
                      onChange={(e) => setCustomXLabel(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#131314] border border-[#3c4043] text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#9aa0a6] mb-1">Nom Axe Y</label>
                    <input
                      type="text"
                      value={customYLabel}
                      onChange={(e) => setCustomYLabel(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#131314] border border-[#3c4043] text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#9aa0a6] mb-1">X Min / Max</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={customXMin}
                        onChange={(e) => setCustomXMin(Number(e.target.value))}
                        className="w-1/2 px-2 py-1.5 rounded-lg bg-[#131314] border border-[#3c4043] text-xs text-white"
                      />
                      <input
                        type="number"
                        value={customXMax}
                        onChange={(e) => setCustomXMax(Number(e.target.value))}
                        className="w-1/2 px-2 py-1.5 rounded-lg bg-[#131314] border border-[#3c4043] text-xs text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#9aa0a6] mb-1">Y Min / Max</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={customYMin}
                        onChange={(e) => setCustomYMin(Number(e.target.value))}
                        className="w-1/2 px-2 py-1.5 rounded-lg bg-[#131314] border border-[#3c4043] text-xs text-white"
                      />
                      <input
                        type="number"
                        value={customYMax}
                        onChange={(e) => setCustomYMax(Number(e.target.value))}
                        className="w-1/2 px-2 py-1.5 rounded-lg bg-[#131314] border border-[#3c4043] text-xs text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Preview */}
              <ScientificGraphicsRenderer spec={currentCustomSpec} />

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleAskAboutCustom}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  Analyser cette fonction personnalisée
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
