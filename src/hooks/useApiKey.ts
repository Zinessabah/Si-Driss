import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'sidriss_student_gemini_api_key_v1';
const EVENT_NAME = 'sidriss_api_key_changed';

export function sanitizeGeminiKey(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/[\u200B-\u200D\uFEFF\u00A0\u2028\u2029]/g, '')
    .replace(/^(export\s+)?(GEMINI_API_KEY|GOOGLE_API_KEY|API_KEY)\s*[:=]\s*/i, '')
    .replace(/^Bearer\s+/i, '')
    .replace(/^["'`«“‘]+|["'`»”’]+$/g, '')
    .replace(/\s+/g, '')
    .trim();
}

export function useApiKey() {
  const [apiKey, setApiKey] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) || '';
      return sanitizeGeminiKey(stored);
    } catch {
      return '';
    }
  });

  useEffect(() => {
    const handleKeyChange = () => {
      try {
        const val = localStorage.getItem(STORAGE_KEY) || '';
        setApiKey(sanitizeGeminiKey(val));
      } catch {
        setApiKey('');
      }
    };

    window.addEventListener(EVENT_NAME, handleKeyChange);
    window.addEventListener('storage', handleKeyChange);

    return () => {
      window.removeEventListener(EVENT_NAME, handleKeyChange);
      window.removeEventListener('storage', handleKeyChange);
    };
  }, []);

  const saveApiKey = useCallback((key: string) => {
    const cleaned = sanitizeGeminiKey(key);
    try {
      if (cleaned) {
        localStorage.setItem(STORAGE_KEY, cleaned);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      setApiKey(cleaned);
      window.dispatchEvent(new Event(EVENT_NAME));
    } catch (err) {
      console.warn('Erreur sauvegarde clé API:', err);
    }
  }, []);

  const removeApiKey = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setApiKey('');
      window.dispatchEvent(new Event(EVENT_NAME));
    } catch (err) {
      console.warn('Erreur suppression clé API:', err);
    }
  }, []);

  const validateApiKey = useCallback(async (keyToTest?: string): Promise<{
    valid: boolean;
    message: string;
    sanitizedKey?: string;
    canSaveAnyway?: boolean;
  }> => {
    const testKey = sanitizeGeminiKey(keyToTest !== undefined ? keyToTest : apiKey);
    if (!testKey) {
      return { valid: false, message: 'Veuillez saisir votre clé API Gemini.' };
    }

    try {
      const res = await fetch('/api/validate-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': testKey,
        },
        body: JSON.stringify({ apiKey: testKey }),
      });

      const data = await res.json();
      if (res.ok && data.valid) {
        return {
          valid: true,
          message: data.message || 'Clé API connectée avec succès !',
          sanitizedKey: data.sanitizedKey || testKey,
        };
      }
      return {
        valid: false,
        message: data.error || 'Clé API non reconnue.',
        sanitizedKey: data.sanitizedKey || testKey,
        canSaveAnyway: data.canSaveAnyway ?? (testKey.startsWith('AIza') || testKey.length >= 25),
      };
    } catch (err: any) {
      return {
        valid: false,
        message: err?.message || 'Délai d\'attente ou problème de connexion pour tester la clé.',
        sanitizedKey: testKey,
        canSaveAnyway: testKey.startsWith('AIza') || testKey.length >= 25,
      };
    }
  }, [apiKey]);

  const getAuthHeaders = useCallback((): Record<string, string> => {
    if (!apiKey) return {};
    return {
      'x-gemini-api-key': apiKey,
    };
  }, [apiKey]);

  return {
    apiKey,
    hasApiKey: Boolean(apiKey && apiKey.length > 10),
    saveApiKey,
    removeApiKey,
    validateApiKey,
    getAuthHeaders,
  };
}
