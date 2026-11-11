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
const MEMENTO_SYNC_EVENT = 'si_driss_memento_history_changed';
const MAX_HISTORY_ITEMS = 50;

function readStoredHistory(): MementoCalculationRecord[] {
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
}

export function useMementoHistory() {
  const [history, setHistory] = useState<MementoCalculationRecord[]>(readStoredHistory);

  const persistAndBroadcast = useCallback((items: MementoCalculationRecord[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('Error saving memento history to localStorage:', e);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(MEMENTO_SYNC_EVENT, { detail: items }));
    }
  }, []);

  const addCalculation = useCallback(
    (record: Omit<MementoCalculationRecord, 'id' | 'timestamp'>) => {
      const newRecord: MementoCalculationRecord = {
        ...record,
        id: `memento_calc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: Date.now(),
      };

      const current = readStoredHistory();
      // Prevent duplicate calculation right at the top
      const filtered = current.filter(
        (item) =>
          !(
            item.formulaId === record.formulaId &&
            JSON.stringify(item.inputValues) === JSON.stringify(record.inputValues)
          )
      );
      const updated = [newRecord, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      setHistory(updated);
      persistAndBroadcast(updated);

      return newRecord;
    },
    [persistAndBroadcast]
  );

  const removeCalculation = useCallback(
    (id: string) => {
      const updated = readStoredHistory().filter((item) => item.id !== id);
      setHistory(updated);
      persistAndBroadcast(updated);
    },
    [persistAndBroadcast]
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Error clearing memento history:', e);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(MEMENTO_SYNC_EVENT, { detail: [] }));
    }
  }, []);

  // Listen for cross-tab storage events and same-tab updates across hook instances
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        if (!e.newValue) {
          setHistory([]);
          return;
        }
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setHistory(parsed);
          }
        } catch {}
      }
    };
    const handleLocalSync = (e: Event) => {
      const detail = (e as CustomEvent<MementoCalculationRecord[]>).detail;
      if (Array.isArray(detail)) {
        setHistory(detail);
      } else {
        setHistory(readStoredHistory());
      }
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(MEMENTO_SYNC_EVENT, handleLocalSync);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(MEMENTO_SYNC_EVENT, handleLocalSync);
    };
  }, []);

  return {
    history,
    addCalculation,
    removeCalculation,
    clearHistory,
    totalCount: history.length,
  };
}
