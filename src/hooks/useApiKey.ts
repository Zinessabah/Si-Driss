import { useState, useEffect, useCallback } from 'react';
import { AIProviderId, AIProviderConfig, AI_PROVIDERS, getProviderDef } from '../types/aiProviders';

const OLD_STORAGE_KEY = 'sidriss_student_gemini_api_key_v1';
const NEW_STORAGE_KEY = 'sidriss_ai_provider_config_v2';
const EVENT_NAME = 'sidriss_ai_config_changed';

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
        return {
          provider: parsed.provider,
          apiKey: sanitizeKeyString(parsed.apiKey || ''),
          model: parsed.model || getProviderDef(parsed.provider).defaultModel,
          baseUrl: parsed.baseUrl || getProviderDef(parsed.provider).defaultBaseUrl || '',
        };
      }
    }

    // Check old Gemini storage key for graceful migration
    const oldGeminiKey = localStorage.getItem(OLD_STORAGE_KEY);
    if (oldGeminiKey) {
      const cleaned = sanitizeKeyString(oldGeminiKey);
      if (cleaned) {
        const migrated: AIProviderConfig = {
          provider: 'gemini',
          apiKey: cleaned,
          model: 'gemini-2.5-flash',
          baseUrl: '',
        };
        localStorage.setItem(NEW_STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
    }
  } catch (err) {
    console.warn('Erreur lecture configuration IA locale:', err);
  }

  // Default to Gemini with recommended model
  return {
    provider: 'gemini',
    apiKey: '',
    model: 'gemini-2.5-flash',
    baseUrl: '',
  };
}

export function useApiKey() {
  const [config, setConfig] = useState<AIProviderConfig>(getInitialConfig);
  const [serverHasKey, setServerHasKey] = useState<boolean>(false);
  const [serverDefaultProvider, setServerDefaultProvider] = useState<string>('');

  // Probe server configuration status on mount
  useEffect(() => {
    let isMounted = true;
    fetch('/api/ai-status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data) return;
        if (data.serverConfigured) {
          setServerHasKey(true);
          setServerDefaultProvider(data.serverProvider || 'gemini');
        }
      })
      .catch(() => {
        // Silent catch
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

      // Also sync old storage key if Gemini for legacy readers
      if (updated.provider === 'gemini') {
        localStorage.setItem(OLD_STORAGE_KEY, updated.apiKey);
      } else {
        localStorage.removeItem(OLD_STORAGE_KEY);
      }

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
