import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'sidriss_student_gemini_api_key_v1';
const EVENT_NAME = 'sidriss_api_key_changed';

export function useApiKey() {
  const [apiKey, setApiKey] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    const handleKeyChange = () => {
      try {
        const val = localStorage.getItem(STORAGE_KEY) || '';
        setApiKey(val);
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
    const trimmed = key.trim();
    try {
      if (trimmed) {
        localStorage.setItem(STORAGE_KEY, trimmed);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      setApiKey(trimmed);
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

  const validateApiKey = useCallback(async (keyToTest?: string): Promise<{ valid: boolean; message: string }> => {
    const testKey = (keyToTest !== undefined ? keyToTest : apiKey).trim();
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
        return { valid: true, message: data.message || 'Clé API connectée avec succès !' };
      }
      return { valid: false, message: data.error || 'Clé API invalide.' };
    } catch (err: any) {
      return {
        valid: false,
        message: err?.message || 'Erreur de connexion au serveur pour tester la clé.',
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
