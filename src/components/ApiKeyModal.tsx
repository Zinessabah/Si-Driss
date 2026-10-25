import React, { useState, useEffect } from 'react';
import {
  Key,
  X,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ClipboardPaste,
  Trash2,
  ShieldCheck,
  Sparkles,
  HelpCircle,
  Loader2,
  Smartphone,
  Check,
} from 'lucide-react';
import { useApiKey, sanitizeGeminiKey } from '../hooks/useApiKey';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { apiKey, saveApiKey, removeApiKey, validateApiKey } = useApiKey();

  const [inputVal, setInputVal] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
    canSaveAnyway?: boolean;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setInputVal(apiKey || '');
      setStatusMessage(null);
      setShowKey(false);
    }
  }, [isOpen, apiKey]);

  if (!isOpen) return null;

  const handlePaste = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          const cleaned = sanitizeGeminiKey(text);
          setInputVal(cleaned);
          setStatusMessage(null);
        }
      }
    } catch {
      // Clipboard access denied or unsupported
    }
  };

  const handleDirectSave = () => {
    const cleaned = sanitizeGeminiKey(inputVal);
    if (!cleaned) {
      setStatusMessage({ type: 'error', text: 'Veuillez saisir votre clé API Gemini.' });
      return;
    }

    saveApiKey(cleaned);
    setStatusMessage({
      type: 'success',
      text: 'Clé enregistrée avec succès sur votre appareil ! Vous pouvez discuter avec Si Driss.',
    });
    setTimeout(() => {
      onSuccess?.();
      onClose();
    }, 1000);
  };

  const handleSaveAndTest = async () => {
    const cleaned = sanitizeGeminiKey(inputVal);
    if (!cleaned) {
      setStatusMessage({ type: 'error', text: 'Veuillez saisir votre clé API Gemini.' });
      return;
    }

    // Update input with sanitized version
    setInputVal(cleaned);

    setIsValidating(true);
    setStatusMessage(null);

    const result = await validateApiKey(cleaned);
    setIsValidating(false);

    if (result.valid) {
      saveApiKey(result.sanitizedKey || cleaned);
      setStatusMessage({
        type: 'success',
        text: result.message || 'Tbarkellah 3lik ! Clé vérifiée et enregistrée avec succès.',
      });
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1200);
    } else {
      setStatusMessage({
        type: 'error',
        text: result.message || 'La vérification en ligne a échoué.',
        canSaveAnyway: true,
      });
    }
  };

  const handleRemove = () => {
    removeApiKey();
    setInputVal('');
    setStatusMessage({ type: 'success', text: 'Clé API supprimée de cet appareil.' });
  };

  const cleanedPreview = sanitizeGeminiKey(inputVal);
  const isLikelyAIPattern = cleanedPreview.startsWith('AIzaSy');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-slate-900 p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Clé API Gemini de l'Élève
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  100% Gratuit
                </span>
              </h2>
              <p className="text-xs text-slate-400">Chaque élève utilise son quota personnel Google AI Studio</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-300">
          {/* Why student key card */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
              <Sparkles className="w-4 h-4" />
              <span>Pourquoi chaque élève a sa propre clé ?</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Pour garantir que le service reste <strong>libre, illimité et totalement gratuit</strong> pour chacun sans bloquer les autres élèves. Google offre gratuitement des milliers de requêtes par jour à tout détenteur d'un compte Google (Gmail).
            </p>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-1">
              <span className="flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Aucune carte bancaire requise
              </span>
              <span className="flex items-center gap-1 text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" /> Clé stockée uniquement sur ton appareil
              </span>
            </div>
          </div>

          {/* Quick steps to get a free key */}
          <div className="space-y-2">
            <span className="font-bold text-slate-200 block text-xs">
              Comment obtenir ta clé gratuite en 1 minute ?
            </span>
            <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-300 pl-1">
              <li>
                Ouvre{' '}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 underline hover:text-amber-300 inline-flex items-center gap-0.5 font-medium"
                >
                  aistudio.google.com/app/apikey <ExternalLink className="w-3 h-3" />
                </a>{' '}
                et connecte-toi avec ton compte Google.
              </li>
              <li>Clique sur le bouton bleu <strong>« Create API key »</strong> (Créer une clé API).</li>
              <li>Copie la clé générée (elle commence par <code>AIzaSy...</code>) et colle-la ci-dessous.</li>
            </ol>
          </div>

          {/* Input field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-200">
                Ta clé API Gemini (Google AI Studio) :
              </label>
              {cleanedPreview && (
                <span className="text-[10px] text-slate-400 font-mono">
                  {cleanedPreview.length} caractères
                </span>
              )}
            </div>

            <div className="relative flex items-center">
              <input
                type={showKey ? 'text' : 'password'}
                value={inputVal}
                onChange={(e) => {
                  setInputVal(e.target.value);
                  setStatusMessage(null);
                }}
                placeholder="Exemple : AIzaSyB..."
                className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 font-mono pr-24 transition outline-none"
              />

              <div className="absolute right-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="p-1.5 text-slate-400 hover:text-slate-200 transition"
                  title={showKey ? 'Masquer la clé' : 'Afficher la clé'}
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>

                <button
                  type="button"
                  onClick={handlePaste}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition flex items-center gap-1 text-[10px] font-medium"
                  title="Coller depuis le presse-papier"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Coller</span>
                </button>
              </div>
            </div>

            {/* Live Key Helper Badges */}
            {cleanedPreview.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                {isLikelyAIPattern ? (
                  <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                    <CheckCircle2 className="w-3 h-3" />
                    Format Google AI Studio valide (commence par AIzaSy)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                    <AlertCircle className="w-3 h-3" />
                    Note : les clés Gemini commencent habituellement par AIzaSy
                  </span>
                )}

                {inputVal !== cleanedPreview && (
                  <span className="inline-flex items-center gap-1 text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-md">
                    <Sparkles className="w-3 h-3" />
                    Guillemets/espaces superflus nettoyés
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl text-xs space-y-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                  : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                )}
                <div className="flex-1 leading-relaxed">{statusMessage.text}</div>
              </div>

              {/* If error occurred, offer instant one-click save without forcing online test */}
              {statusMessage.type === 'error' && (
                <div className="pt-1 border-t border-rose-500/20 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDirectSave}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/30 text-xs font-semibold transition"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Enregistrer quand même cette clé et continuer</span>
                  </button>
                  <span className="text-[11px] text-slate-400">
                    (Utile si la connexion de ton lycée/maison est lente)
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Quick link button */}
          <div className="pt-1">
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-amber-300 hover:text-amber-200 border border-slate-700/60 font-medium text-[11px] flex items-center justify-center gap-2 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Ouvrir Google AI Studio pour générer ma clé gratuite</span>
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
          {apiKey ? (
            <button
              onClick={handleRemove}
              className="px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition"
              title="Supprimer la clé enregistrée"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Supprimer</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-medium transition"
            >
              Fermer
            </button>

            {/* Direct save button (never traps the user) */}
            <button
              type="button"
              onClick={handleDirectSave}
              disabled={!inputVal.trim()}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700/60 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Enregistrer directement sans test de connexion préalable"
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Enregistrer directement</span>
            </button>

            {/* Test and save button */}
            <button
              onClick={handleSaveAndTest}
              disabled={isValidating || !inputVal.trim()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isValidating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Test en cours...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Tester & Enregistrer</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
