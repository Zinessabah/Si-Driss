import { useState, useEffect, useCallback } from 'react';
import { AIProviderId, AIProviderConfig, AI_PROVIDERS, getProviderDef } from '../types/aiProviders';

const OLD_STORAGE_KEY = 'sidriss_student_gemini_api_key_v1';
const NEW_STORAGE_KEY = 'sidriss_ai_provider_config_v2';
const EVENT_NAME = 'sidriss_ai_config_changed';
const ACCESS_TOKEN_KEY = 'sidriss_access_token_v1';
const ADMIN_TOKEN_KEY = 'sidriss_admin_token_v1';

// (dette) Sonde unique du statut serveur : partagée par toutes les instances du
// hook (App, chat, audit, modales…) — un seul appel /api/ai-status au démarrage
// au lieu d'un par composant.
let serverStatusProbe: Promise<{ configured: boolean; provider: string } | null> | null = null;

function probeServerStatus(): Promise<{ configured: boolean; provider: string } | null> {
  if (!serverStatusProbe) {
    serverStatusProbe = fetch('/api/ai-status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data): { configured: boolean; provider: string } | null =>
        data
          ? { configured: Boolean(data.serverConfigured), provider: data.serverProvider || 'gemini' }
          : null
      )
      .catch(() => null);
  }
  return serverStatusProbe;
}

/**
 * (M13) Migration unique de l'ancienne clé Gemini vers la config v2, exécutée
 * une seule fois au chargement du module — plus d'écriture localStorage dans un
 * initializer React (impur, doublé sous StrictMode).
 */
function migrateLegacyGeminiKey(): void {
  try {
    if (localStorage.getItem(NEW_STORAGE_KEY)) return;
    const oldGeminiKey = localStorage.getItem(OLD_STORAGE_KEY);
    if (!oldGeminiKey) return;
    const cleaned = sanitizeKeyString(oldGeminiKey);
    if (!cleaned) return;
    localStorage.setItem(
      NEW_STORAGE_KEY,
      JSON.stringify({ provider: 'gemini', apiKey: cleaned, model: 'gemini-3.5-flash-lite', baseUrl: '' })
    );
  } catch {
    /* stockage indisponible */
  }
}

if (typeof window !== 'undefined') {
  migrateLegacyGeminiKey();
}

/** Mot de passe de classe optionnel (SI_DRISS_ACCESS_TOKEN côté serveur). */
export function getAccessToken(): string {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setAccessToken(token: string): void {
  try {
    if (token) localStorage.setItem(ACCESS_TOKEN_KEY, token);
    else localStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {}
}

/** Jeton admin optionnel pour la gestion des documents (ADMIN_TOKEN côté serveur). */
export function getAdminToken(): string {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setAdminToken(token: string): void {
  try {
    if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
    else localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {}
}

export function sanitizeKeyString(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/[\u200B-\u200D\uFEFF\u00A0\u2028\u2029]/g, '')
    .replace(/^(export\s+)?([A-Z0-9_]*API_KEY|[A-Z0-9_]*TOKEN)\s*[:=]\s*/i, '')
    .replace(/^Bearer\s+/i, '')
    .replace(/^["'`«“‘]+|["'`»”’]+$/g, '')
    .replace(/\s+/g, '')
    .trim();
}

// Backward compatibility alias
export const sanitizeGeminiKey = sanitizeKeyString;

function getInitialConfig(): AIProviderConfig {
  try {
    const stored = localStorage.getItem(NEW_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.provider) {
        // Modèles Gemini retirés ou d'une génération antérieure → modèle rapide par défaut.
        // gemini-3.8-flash et gemini-flash-latest sont des IDs publics ACTUELS et valides (M6).
        const deprecatedGemini = new Set([
          'gemini-2.5-flash',
          'gemini-2.5-pro',
          'gemini-2.5-flash-lite',
          'gemini-2.0-flash',
          'gemini-2.0-flash-lite',
          'gemini-1.5-flash',
          'gemini-1.5-pro',
        ]);
        // Anciens noms DeepSeek (ère V3/R1) → catalogue actuel V4
        const legacyDeepSeek: Record<string, string> = {
          'deepseek-chat': 'deepseek-flash',
          'deepseek-reasoner': 'deepseek-flash',
        };
        let effectiveModel = parsed.model || getProviderDef(parsed.provider).defaultModel;
        if (parsed.provider === 'gemini' && deprecatedGemini.has(effectiveModel)) {
          effectiveModel = 'gemini-3.5-flash-lite';
        } else if (parsed.provider === 'deepseek' && legacyDeepSeek[effectiveModel]) {
          effectiveModel = legacyDeepSeek[effectiveModel];
        }
        return {
          provider: parsed.provider,
          apiKey: sanitizeKeyString(parsed.apiKey || ''),
          model: effectiveModel,
          baseUrl: parsed.baseUrl || getProviderDef(parsed.provider).defaultBaseUrl || '',
        };
      }
    }

  } catch (err) {
    console.warn('Erreur lecture configuration IA locale:', err);
  }

  // Default to Gemini with recommended fast model (gemini-3.5-flash-lite)
  return {
    provider: 'gemini',
    apiKey: '',
    model: 'gemini-3.5-flash-lite',
    baseUrl: '',
  };
}

export function useApiKey() {
  const [config, setConfig] = useState<AIProviderConfig>(getInitialConfig);
  const [serverHasKey, setServerHasKey] = useState<boolean>(true);
  const [serverDefaultProvider, setServerDefaultProvider] = useState<string>('gemini');

  // Probe server configuration status on mount (sonde unique partagée entre
  // toutes les instances du hook — un seul appel réseau au démarrage)
  useEffect(() => {
    let isMounted = true;
    probeServerStatus().then((status) => {
      if (!isMounted || !status) return;
      setServerHasKey(status.configured);
      if (status.configured) {
        setServerDefaultProvider(status.provider);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleStorageChange = () => {
      setConfig(getInitialConfig());
    };

    window.addEventListener(EVENT_NAME, handleStorageChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener(EVENT_NAME, handleStorageChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const saveConfig = useCallback((newConfig: Partial<AIProviderConfig>) => {
    try {
      const current = getInitialConfig();
      const updated: AIProviderConfig = {
        ...current,
        ...newConfig,
        apiKey: newConfig.apiKey !== undefined ? sanitizeKeyString(newConfig.apiKey) : current.apiKey,
      };

      localStorage.setItem(NEW_STORAGE_KEY, JSON.stringify(updated));

      setConfig(updated);
      window.dispatchEvent(new Event(EVENT_NAME));
    } catch (err) {
      console.warn('Erreur sauvegarde configuration IA:', err);
    }
  }, []);

  const saveApiKey = useCallback(
    (key: string, providerOverride?: AIProviderId, modelOverride?: string) => {
      const provider = providerOverride || config.provider;
      const model = modelOverride || config.model || getProviderDef(provider).defaultModel;
      saveConfig({
        provider,
        apiKey: key,
        model,
      });
    },
    [config, saveConfig]
  );

  const removeApiKey = useCallback(() => {
    try {
      const resetConfig: AIProviderConfig = {
        provider: config.provider,
        apiKey: '',
        model: getProviderDef(config.provider).defaultModel,
        baseUrl: getProviderDef(config.provider).defaultBaseUrl || '',
      };
      localStorage.setItem(NEW_STORAGE_KEY, JSON.stringify(resetConfig));
      localStorage.removeItem(OLD_STORAGE_KEY);
      setConfig(resetConfig);
      window.dispatchEvent(new Event(EVENT_NAME));
    } catch (err) {
      console.warn('Erreur suppression clé IA:', err);
    }
  }, [config.provider]);

  const validateConnection = useCallback(
    async (
      testTarget?: Partial<AIProviderConfig>
    ): Promise<{
      valid: boolean;
      message: string;
      sanitizedKey?: string;
      modelTested?: string;
      providerTested?: string;
    }> => {
      const targetProvider = testTarget?.provider || config.provider;
      const targetModel = testTarget?.model || config.model || getProviderDef(targetProvider).defaultModel;
      const targetBaseUrl = testTarget?.baseUrl !== undefined ? testTarget.baseUrl : config.baseUrl;
      const rawKey = testTarget?.apiKey !== undefined ? testTarget.apiKey : config.apiKey;
      const targetKey = sanitizeKeyString(rawKey);

      const providerDef = getProviderDef(targetProvider);

      if (providerDef.requiresKey && !targetKey && !serverHasKey) {
        return {
          valid: false,
          message: `Veuillez saisir votre clé API pour ${providerDef.name}.`,
        };
      }

      try {
        const res = await fetch('/api/validate-key', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-ai-provider': targetProvider,
            'x-ai-key': targetKey,
            'x-ai-model': targetModel,
            'x-ai-base-url': targetBaseUrl || '',
            'x-gemini-api-key': targetProvider === 'gemini' ? targetKey : '',
            'x-access-token': getAccessToken(),
          },
          body: JSON.stringify({
            provider: targetProvider,
            apiKey: targetKey,
            model: targetModel,
            baseUrl: targetBaseUrl,
          }),
        });

        const data = await res.json();
        if (res.ok && data.valid) {
          return {
            valid: true,
            message: data.message || `Connexion réussie avec ${providerDef.name} (${targetModel}) !`,
            sanitizedKey: data.sanitizedKey || targetKey,
            modelTested: data.modelTested || targetModel,
            providerTested: targetProvider,
          };
        }

        return {
          valid: false,
          message: data.error || `Erreur lors de la validation avec ${providerDef.name}.`,
          sanitizedKey: data.sanitizedKey || targetKey,
        };
      } catch (err: any) {
        return {
          valid: false,
          message:
            err?.message ||
            `Délai d'attente ou problème de communication avec le fournisseur ${providerDef.name}.`,
          sanitizedKey: targetKey,
        };
      }
    },
    [config, serverHasKey]
  );

  const getAuthHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {
      'x-ai-provider': config.provider,
      'x-ai-key': config.apiKey || '',
      'x-ai-model': config.model || getProviderDef(config.provider).defaultModel,
      'x-access-token': getAccessToken(),
    };

    if (config.baseUrl) {
      headers['x-ai-base-url'] = config.baseUrl;
    }

    // Retain compatibility with legacy headers
    if (config.provider === 'gemini' && config.apiKey) {
      headers['x-gemini-api-key'] = config.apiKey;
    }

    return headers;
  }, [config]);

  const activeProviderDef = getProviderDef(config.provider);
  const isCustomLocal = config.provider === 'custom';
  const hasValidConfig = Boolean(
    (isCustomLocal && (config.baseUrl || !activeProviderDef.requiresKey)) ||
    (config.apiKey && config.apiKey.length >= 8) ||
    serverHasKey
  );

  return {
    config,
    provider: config.provider,
    apiKey: config.apiKey,
    model: config.model,
    baseUrl: config.baseUrl,
    providerDef: activeProviderDef,
    hasApiKey: hasValidConfig,
    serverHasKey,
    serverDefaultProvider,
    saveConfig,
    saveApiKey,
    removeApiKey,
    validateApiKey: validateConnection,
    getAuthHeaders,
  };
}
