import React, { useState } from 'react';
import { X, Sparkles, RefreshCw, Send, CheckCircle, BookOpen, Key } from 'lucide-react';
import { MathView } from './MathView';
import { useApiKey } from '../hooks/useApiKey';
import { useBranch } from '../hooks/useBranch';
import { ApiKeyModal } from './ApiKeyModal';
import { ExportResponseButtons } from './ExportResponseButtons';

interface GeneratedExercise {
  title: string;
  domain: string;
  chapter: string;
  duration: string;
  context: string;
  parameters: { symbol: string; name: string; value: string }[];
  questions: {
    number: string;
    text: string;
    points: string;
    hint: string;
    keyFormula: string;
  }[];
  commonPitfall: string;
  professorNote: string;
}

interface ExerciseGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectForPractice: (exercise: GeneratedExercise) => void;
}

export const ExerciseGeneratorModal: React.FC<ExerciseGeneratorModalProps> = ({
  isOpen,
  onClose,
  onSelectForPractice,
}) => {
  const { hasApiKey, getAuthHeaders } = useApiKey();
  const { branch, isSM } = useBranch();
  const [isKeyModalOpen, setIsKeyModalOpen] = useState<boolean>(false);
  const [subject, setSubject] = useState<'Physique' | 'Chimie'>('Physique');
  const [chapter, setChapter] = useState<string>(isSM ? 'Rotation d\'un solide indéformable autour d\'un axe fixe (RFD)' : 'Circuit RLC série');
  const [difficulty, setDifficulty] = useState<string>('Standard Examen National');
  const [topicStyle, setTopicStyle] = useState<string>('Exploitation de graphe et calculs littéraux');
  const [loading, setLoading] = useState<boolean>(false);
  const [generated, setGenerated] = useState<GeneratedExercise | null>(null);

  if (!isOpen) return null;

  const physicsChaptersPC = [
    'Ondes mécaniques progressives et périodiques',
    'Diffraction des ondes lumineuses',
    'Décroissance radioactive et datation',
    'Noyaux, masse et énergie nucléaire',
    'Dipôle RC (Charge et décharge)',
    'Dipôle RL (Établissement du courant)',
    'Circuit RLC série et bilan énergétique',
    'Modulation et démodulation d\'amplitude AM',
    'Lois de Newton et chute verticale avec frottement',
    'Mouvement de projectiles dans le champ de pesanteur',
    'Particules chargées dans un condensateur plan',
    'Pendule élastique horizontal et vertical',
    'Modèle de Bohr et atome d\'hydrogène',
  ];

  const physicsChaptersSM = [
    'Rotation d\'un solide indéformable autour d\'un axe fixe (RFD)',
    'Oscillations mécaniques forcées et résonance',
    'Oscillations électriques forcées RLC série (GBF, impédance Z, bande passante)',
    'Ondes mécaniques progressives et périodiques',
    'Diffraction des ondes lumineuses',
    'Décroissance radioactive et datation',
    'Noyaux, masse et énergie nucléaire',
    'Dipôle RC (Charge et décharge)',
    'Dipôle RL (Établissement du courant)',
    'Circuit RLC série libre et amortissement',
    'Lois de Newton et chute verticale avec frottement',
    'Mouvement de projectiles dans le champ de pesanteur',
    'Particules chargées dans un champ électrostatique',
    'Systèmes oscillants mécaniques (Pendule élastique, de torsion, pesant)',
  ];

  const physicsChapters = isSM ? physicsChaptersSM : physicsChaptersPC;

  const chemistryChapters = [
    'Suivi temporel et vitesse volumique de réaction',
    'Conductimétrie et temps de demi-réaction t1/2',
    'Taux d\'avancement final tau et équilibre chimique',
    'Réactions acido-basiques et calcul du pH',
    'Dosage pH-métrique de l\'acide éthanoïque et pKa',
    'Sens d\'évolution spontanée et critère Qr vs K',
    'Piles électrochimiques et capacité électrique Q',
    'Électrolyse et transformations forcées',
    'Estérification, hydrolyse et saponification',
    'Synthèse par anhydride d\'acide',
  ];

  const handleGenerate = async () => {
    if (!hasApiKey) {
      setIsKeyModalOpen(true);
      return;
    }

    setLoading(true);
    setGenerated(null);

    try {
      const res = await fetch('/api/generate-exercise', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          subject,
          chapter,
          difficulty,
          topicStyle,
          branch,
        }),
      });

      if (res.status === 401) {
        setIsKeyModalOpen(true);
        throw new Error('API_KEY_REQUIRED');
      }

      if (!res.ok) throw new Error('Erreur');
      const data = await res.json();
      setGenerated(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-white text-base">Générateur d'Exercice National Type (IA Si Driss)</h3>
              <p className="text-xs text-slate-400">Génère un sujet inédit conforme au Cadre de Référence 2ème Bac {branch} (BIOF)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body content */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
            {/* Subject */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Matière :</label>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSubject('Physique');
                    setChapter('Circuit RLC série');
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                    subject === 'Physique'
                      ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  Physique
                </button>
                <button
                  onClick={() => {
                    setSubject('Chimie');
                    setChapter('Réactions acido-basiques et calcul du pH');
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                    subject === 'Chimie'
                      ? 'bg-purple-600 border-purple-500 text-white shadow-md'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  Chimie
                </button>
              </div>
            </div>

            {/* Chapter */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Chapitre ciblé :</label>
              <select
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                {(subject === 'Physique' ? physicsChapters : chemistryChapters).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Difficulty */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Niveau de difficulté :</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="Standard Examen National">Standard Examen National (Classique)</option>
                <option value="Sujet de Distinction (Mention Très Bien)">Sujet de Distinction (Mention Très Bien)</option>
                <option value="Session Rattrapage (Technique & Calcul)">Session Rattrapage (Technique & Calcul)</option>
              </select>
            </div>

            {/* Style */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Style de questions :</label>
              <select
                value={topicStyle}
                onChange={(e) => setTopicStyle(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="Exploitation de graphe et calculs littéraux">Exploitation de graphe et calculs littéraux</option>
                <option value="Équation différentielle et intégration">Équation différentielle et intégration</option>
                <option value="Bilan énergétique et rendement">Bilan énergétique et rendement</option>
                <option value="Question piège et analyse dimensionnelle">Question piège et analyse dimensionnelle</option>
              </select>
            </div>
          </div>

          {/* Action button */}
          <div className="flex justify-end">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-xs transition-all flex items-center gap-2 shadow-lg disabled:opacity-40"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Conception de l'énoncé par Si Driss...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Générer l'épreuve type</span>
                </>
              )}
            </button>
          </div>

          {/* Generated Result */}
          {generated && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4 animate-fadeIn">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                    {generated.domain} • {generated.chapter}
                  </span>
                  <h4 className="text-sm font-bold text-white mt-0.5">
                    <MathView content={generated.title} className="inline" />
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                    Durée : {generated.duration}
                  </span>
                  <ExportResponseButtons
                    content={`# ${generated.title}\n**Matière :** ${generated.domain} | **Chapitre :** ${generated.chapter} | **Filière :** 2ème Bac ${branch}\n**Durée :** ${generated.duration}\n\n## Énoncé de l'exercice :\n${generated.context}\n\n${generated.parameters?.length ? '### Paramètres et données :\n' + generated.parameters.map((p) => `- **${p.name} (${p.symbol})** : ${p.value}`).join('\n') : ''}\n\n## Questions de l'épreuve :\n${generated.questions.map((q) => `### Question ${q.number} (${q.points})\n${q.text}\n\n*Indice socratique :* ${q.hint}\n*Formule clé :* ${q.keyFormula}`).join('\n\n')}\n\n${generated.commonPitfall ? '### Piège classique à éviter :\n' + generated.commonPitfall : ''}\n\n${generated.professorNote ? '### Note de Si Driss :\n' + generated.professorNote : ''}`}
                    title={generated.title}
                    branch={branch}
                  />
                </div>
              </div>

              {/* Statement */}
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-300">Énoncé de l'exercice :</span>
                <MathView content={generated.context} className="text-xs text-slate-300 leading-relaxed" />
              </div>

              {/* Parameters */}
              {generated.parameters && generated.parameters.length > 0 && (
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {generated.parameters.map((p, i) => (
                    <div key={i} className="text-slate-400 font-mono">
                      <span>
                        <MathView content={p.name} className="inline" /> (
                        <MathView content={p.symbol} className="inline" />) :{' '}
                      </span>
                      <span className="text-amber-300 font-bold">
                        <MathView content={p.value} className="inline" />
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Questions */}
              <div className="space-y-3 pt-2">
                <span className="text-xs font-bold text-slate-300">Questions de l'épreuve :</span>
                {generated.questions.map((q, idx) => (
                  <div key={idx} className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-400 font-mono">Question {q.number}</span>
                      <span className="text-[11px] text-emerald-400 font-mono">{q.points}</span>
                    </div>
                    <MathView content={q.text} className="text-slate-200" />
                    {q.hint && (
                      <div className="text-[11px] text-slate-400 bg-slate-950/70 p-2 rounded border border-slate-800/80 flex items-start gap-1.5">
                        <span className="text-amber-400 font-bold shrink-0">Indice Prof :</span>
                        <MathView content={q.hint} className="inline" />
                      </div>
                    )}
                    {q.keyFormula && (
                      <div className="text-[11px] text-sky-300 bg-slate-950/70 p-2 rounded border border-slate-800/80 flex items-center gap-1.5">
                        <span className="text-sky-400 font-bold shrink-0">Formule clé :</span>
                        <MathView content={q.keyFormula} className="inline" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Trap notice */}
              {generated.commonPitfall && (
                <div className="bg-rose-950/40 border border-rose-500/30 p-3 rounded-xl text-xs text-rose-200">
                  <span className="font-bold text-rose-300">Piège classique à éviter : </span>
                  <MathView content={generated.commonPitfall} className="inline" />
                </div>
              )}

              {/* Professor Note */}
              {generated.professorNote && (
                <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl text-xs text-amber-200">
                  <span className="font-bold text-amber-300">Note de Si Driss : </span>
                  <MathView content={generated.professorNote} className="inline" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ApiKeyModal isOpen={isKeyModalOpen} onClose={() => setIsKeyModalOpen(false)} />
    </div>
  );
};
