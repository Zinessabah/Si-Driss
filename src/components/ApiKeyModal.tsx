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
  Loader2,
  Check,
  Cpu,
  Server,
  Zap,
  ChevronDown,
  Globe,
  HelpCircle,
  Terminal,
} from 'lucide-react';
import { useApiKey, sanitizeKeyString } from '../hooks/useApiKey';
import {
  AIProviderId,
  AI_PROVIDERS,
  getProviderDef,
} from '../types/aiProviders';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const {
    config,
    serverHasKey,
    serverDefaultProvider,
    saveConfig,
    removeApiKey,
    validateApiKey,
  } = useApiKey();

  const [selectedProvider, setSelectedProvider] = useState<AIProviderId>(config.provider || 'gemini');
  const [apiKeyInput, setApiKeyInput] = useState<string>(config.apiKey || '');
  const [selectedModel, setSelectedModel] = useState<string>(config.model || 'gemini-2.5-flash');
  const [customModelInput, setCustomModelInput] = useState<string>('');
  const [isCustomModelActive, setIsCustomModelActive] = useState<boolean>(false);
  const [baseUrlInput, setBaseUrlInput] = useState<string>(config.baseUrl || '');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [showKey, setShowKey] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
    canSaveAnyway?: boolean;
  } | null>(null);

  const activeProviderDef = getProviderDef(selectedProvider);

  // Sync state on open
  useEffect(() => {
    if (isOpen) {
      const currentProv = config.provider || 'gemini';
      setSelectedProvider(currentProv);
      setApiKeyInput(config.apiKey || '');
      setBaseUrlInput(config.baseUrl || getProviderDef(currentProv).defaultBaseUrl || '');

      const currentModel = config.model || getProviderDef(currentProv).defaultModel;
      const isKnownModel = getProviderDef(currentProv).models.some((m) => m.id === currentModel);

      if (isKnownModel) {
        setSelectedModel(currentModel);
        setIsCustomModelActive(false);
        setCustomModelInput('');
      } else {
        setSelectedModel('__custom__');
        setIsCustomModelActive(true);
        setCustomModelInput(currentModel);
      }

      setStatusMessage(null);
      setShowKey(false);
    }
  }, [isOpen, config]);

  // When changing provider, reset model and baseUrl defaults
  const handleProviderSelect = (providerId: AIProviderId) => {
    setSelectedProvider(providerId);
    const def = getProviderDef(providerId);

    // If switching back to existing config's provider, keep key, else reset if needed
    if (providerId === config.provider) {
      setApiKeyInput(config.apiKey || '');
    } else {
      setApiKeyInput('');
    }

    setSelectedModel(def.defaultModel);
    setIsCustomModelActive(false);
    setCustomModelInput('');
    setBaseUrlInput(def.defaultBaseUrl || '');
    setStatusMessage(null);
  };

  if (!isOpen) return null;

  const handlePaste = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          const cleaned = sanitizeKeyString(text);
          setApiKeyInput(cleaned);
          setStatusMessage(null);
        }
      }
    } catch {
      // Clipboard denied or unsupported
    }
  };

  const getEffectiveModel = (): string => {
    if (isCustomModelActive && customModelInput.trim()) {
      return customModelInput.trim();
    }
    return selectedModel;
  };

  const handleDirectSave = () => {
    const effectiveModel = getEffectiveModel();
    const cleanedKey = sanitizeKeyString(apiKeyInput);

    if (activeProviderDef.requiresKey && !cleanedKey && !serverHasKey) {
      setStatusMessage({
        type: 'error',
        text: `Veuillez renseigner votre clé API pour ${activeProviderDef.name}.`,
      });
      return;
    }

    saveConfig({
      provider: selectedProvider,
      apiKey: cleanedKey,
      model: effectiveModel,
      baseUrl: baseUrlInput.trim() || undefined,
    });

    setStatusMessage({
      type: 'success',
      text: `Configuration ${activeProviderDef.name} enregistrée ! Si Driss est prêt.`,
    });

    setTimeout(() => {
      onSuccess?.();
      onClose();
    }, 900);
  };

  const handleSaveAndTest = async () => {
    const effectiveModel = getEffectiveModel();
    const cleanedKey = sanitizeKeyString(apiKeyInput);

    if (activeProviderDef.requiresKey && !cleanedKey && !serverHasKey) {
      setStatusMessage({
        type: 'error',
        text: `Veuillez renseigner votre clé API pour ${activeProviderDef.name}.`,
      });
      return;
    }

    setIsValidating(true);
    setStatusMessage(null);

    const result = await validateApiKey({
      provider: selectedProvider,
      apiKey: cleanedKey,
      model: effectiveModel,
      baseUrl: baseUrlInput.trim() || undefined,
    });

    setIsValidating(false);

    if (result.valid) {
      saveConfig({
        provider: selectedProvider,
        apiKey: result.sanitizedKey || cleanedKey,
        model: effectiveModel,
        baseUrl: baseUrlInput.trim() || undefined,
      });

      setStatusMessage({
        type: 'success',
        text: result.message || `Test réussi avec ${activeProviderDef.name} ! Tbarkellah 3lik.`,
      });

      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1100);
    } else {
      setStatusMessage({
        type: 'error',
        text: result.message || 'La vérification de connexion a échoué.',
        canSaveAnyway: true,
      });
    }
  };

  const handleRemove = () => {
    removeApiKey();
    setApiKeyInput('');
    setStatusMessage({ type: 'success', text: 'Clé API supprimée de cet appareil.' });
  };

  const cleanedPreview = sanitizeKeyString(apiKeyInput);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-slate-900 p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-yellow-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-white">
                  Moteur IA Universel & Clés API
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Multi-Fournisseurs
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Utilise Gemini, Groq, OpenAI, Claude, DeepSeek, Mistral ou Ollama en local
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Server key alert if pre-configured */}
        {serverHasKey && (
          <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2 flex items-center gap-2 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Serveur configuré :</strong> Une clé par défaut ({serverDefaultProvider.toUpperCase()}) est déjà active sur le serveur. Tu peux l'utiliser sans rien configurer ou brancher ta propre clé ci-dessous.
            </span>
          </div>
        )}

        {/* Content body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs text-slate-300">
          {/* Provider Selection Tabs */}
          <div>
            <label className="block text-xs font-bold text-slate-200 mb-2">
              1. Choisis ton Fournisseur IA :
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {AI_PROVIDERS.map((prov) => {
                const isSelected = selectedProvider === prov.id;
                return (
                  <button
                    key={prov.id}
                    type="button"
                    onClick={() => handleProviderSelect(prov.id)}
                    className={`relative p-2.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500/60 shadow-lg shadow-amber-500/5'
                        : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/50 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`font-bold text-xs ${
                            isSelected ? 'text-amber-300' : 'text-slate-200'
                          }`}
                        >
                          {prov.name}
                        </span>
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 block line-clamp-1">
                        {prov.badge}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[9px]">
                      {prov.freeTier ? (
                        <span className="text-emerald-400 font-semibold">Gratuit</span>
                      ) : (
                        <span className="text-slate-400">Pay-as-you-go</span>
                      )}
                      {prov.id === 'custom' && (
                        <span className="text-sky-400 font-semibold">Local</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Provider description & help banner */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>{activeProviderDef.name} — {activeProviderDef.tagline}</span>
              </div>
              {activeProviderDef.requiresKey && activeProviderDef.keyUrl && (
                <a
                  href={activeProviderDef.keyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-amber-400 hover:text-amber-300 underline inline-flex items-center gap-1 font-medium"
                >
                  Obtenir ma clé {activeProviderDef.name} <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              {activeProviderDef.keyHelp}
            </p>

            {selectedProvider === 'custom' && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 space-y-1 font-mono text-[10px] text-emerald-400">
                <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Exemple de commande pour lancer Ollama en local :</span>
                </div>
                <code>ollama run llama3.3</code>
                <p className="text-slate-400 text-[10px] font-sans mt-1">
                  Assure-toi qu'Ollama est démarré sur ta machine (par défaut sur <code>http://localhost:11434/v1</code>). Aucune clé API n'est requise !
                </p>
              </div>
            )}
          </div>

          {/* Model selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-200">
                2. Modèle pour {activeProviderDef.name} :
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsCustomModelActive(!isCustomModelActive);
                  if (!isCustomModelActive) {
                    setCustomModelInput(selectedModel);
                    setSelectedModel('__custom__');
                  } else {
                    setSelectedModel(activeProviderDef.defaultModel);
                  }
                }}
                className="text-[10px] text-amber-400 hover:underline"
              >
                {isCustomModelActive ? 'Choisir un modèle prédéfini' : 'Saisir un modèle personnalisé'}
              </button>
            </div>

            {isCustomModelActive ? (
              <div className="relative">
                <input
                  type="text"
                  value={customModelInput}
                  onChange={(e) => setCustomModelInput(e.target.value)}
                  placeholder={`Ex: ${activeProviderDef.defaultModel} ou nom d'un modèle...`}
                  className="w-full bg-slate-950 border border-amber-500/50 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 font-mono transition outline-none"
                />
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white appearance-none cursor-pointer transition outline-none pr-8"
                >
                  {activeProviderDef.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.tag ? `[${m.tag}]` : ''} — {m.description}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
              </div>
            )}
          </div>

          {/* API Key Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-200">
                3. Clé API {activeProviderDef.name} {activeProviderDef.requiresKey ? '' : '(Optionnelle en local)'} :
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
                value={apiKeyInput}
                onChange={(e) => {
                  setApiKeyInput(e.target.value);
                  setStatusMessage(null);
                }}
                placeholder={activeProviderDef.keyPlaceholder}
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
          </div>

          {/* Advanced Base URL Toggle (Crucial for Ollama, LM Studio, or Private VPS proxies) */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 font-medium"
            >
              <Globe className="w-3 h-3 text-amber-400" />
              <span>
                {showAdvanced ? 'Masquer URL de l\'endpoint personnalisé' : 'Paramètre avancé : URL de base / Endpoint personnalisé'}
              </span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            </button>

            {showAdvanced && (
              <div className="mt-2 bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5">
                <label className="block text-[11px] text-slate-300">
                  URL de base de l'API (ex: <code>http://localhost:11434/v1</code> pour Ollama) :
                </label>
                <input
                  type="text"
                  value={baseUrlInput}
                  onChange={(e) => setBaseUrlInput(e.target.value)}
                  placeholder={activeProviderDef.defaultBaseUrl || 'https://api.openai.com/v1'}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 font-mono outline-none focus:border-amber-500"
                />
                <p className="text-[10px] text-slate-500">
                  Laisser vide pour utiliser l'URL officielle du fournisseur.
                </p>
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

              {statusMessage.type === 'error' && (
                <div className="pt-1 border-t border-rose-500/20 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDirectSave}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/30 text-xs font-semibold transition"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Enregistrer quand même cette configuration</span>
                  </button>
                  <span className="text-[11px] text-slate-400">
                    (Utile si ton pare-feu bloque le ping de vérification)
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
          {config.apiKey || config.provider === 'custom' ? (
            <button
              onClick={handleRemove}
              className="px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition"
              title="Supprimer la configuration enregistrée"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Réinitialiser</span>
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

            {/* Direct save button */}
            <button
              type="button"
              onClick={handleDirectSave}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700/60"
              title="Enregistrer directement sans test de connexion préalable"
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Enregistrer</span>
            </button>

            {/* Test and save button */}
            <button
              onClick={handleSaveAndTest}
              disabled={isValidating}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-md disabled:opacity-50"
            >
              {isValidating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Test en cours...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Tester & Activer</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
