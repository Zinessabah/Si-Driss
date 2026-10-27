import { useState, useEffect, useCallback } from 'react';

export interface MementoCalculationRecord {
  id: string;
  timestamp: number;
  formulaId: string;
  formulaName: string;
  domain: string;
  branch?: 'PC' | 'SM' | 'ALL';
  latexFormula: string;
  inputValues: Record<string, number>;
  inputUnits: Record<string, string>;
  inputLabels: Record<string, string>;
  resultValue: number;
  resultFormatted: string;
  resultScientific: string;
  resultUnit: string;
  substitutionLatex: string;
  notes?: string;
}

const STORAGE_KEY = 'si_driss_memento_history_v1';
const MAX_HISTORY_ITEMS = 50;

export function useMementoHistory() {
  const [history, setHistory] = useState<MementoCalculationRecord[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (e) {
      console.warn('Error reading memento history from localStorage:', e);
    }
    return [];
  });

  // Save to localStorage whenever history changes
  const persistHistory = useCallback((items: MementoCalculationRecord[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('Error saving memento history to localStorage:', e);
    }
  }, []);

  const addCalculation = useCallback(
    (record: Omit<MementoCalculationRecord, 'id' | 'timestamp'>) => {
      const newRecord: MementoCalculationRecord = {
        ...record,
        id: `memento_calc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: Date.now(),
      };

      setHistory((prev) => {
        // Prevent duplicate calculation right at the top
        const filtered = prev.filter(
          (item) =>
            !(
              item.formulaId === record.formulaId &&
              JSON.stringify(item.inputValues) === JSON.stringify(record.inputValues)
            )
        );
        const updated = [newRecord, ...filtered].slice(0, MAX_HISTORY_ITEMS);
        persistHistory(updated);
        return updated;
      });

      return newRecord;
    },
    [persistHistory]
  );

  const removeCalculation = useCallback(
    (id: string) => {
      setHistory((prev) => {
        const updated = prev.filter((item) => item.id !== id);
        persistHistory(updated);
        return updated;
      });
    },
    [persistHistory]
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Error clearing memento history:', e);
    }
  }, []);

  // Listen for storage events in case multiple tabs or components update history
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setHistory(parsed);
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return {
    history,
    addCalculation,
    removeCalculation,
    clearHistory,
    totalCount: history.length,
  };
}
