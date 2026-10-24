import { useState, useEffect, useCallback } from 'react';

export type StudentBranch = 'PC' | 'SM';

const STORAGE_KEY = 'sidriss_student_branch_v1';
const EVENT_NAME = 'sidriss_branch_changed';

export function useBranch() {
  const [branch, setBranchState] = useState<StudentBranch | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'PC' || stored === 'SM') {
        return stored as StudentBranch;
      }
    } catch {}
    return null; // null indicates first start / needs selection
  });

  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'PC' || stored === 'SM') {
          setBranchState(stored as StudentBranch);
        } else {
          setBranchState(null);
        }
      } catch {
        setBranchState(null);
      }
    };

    window.addEventListener(EVENT_NAME, handleStorageChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener(EVENT_NAME, handleStorageChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const selectBranch = useCallback((newBranch: StudentBranch) => {
    try {
      localStorage.setItem(STORAGE_KEY, newBranch);
      setBranchState(newBranch);
      window.dispatchEvent(new Event(EVENT_NAME));
    } catch (err) {
      console.warn('Erreur sauvegarde filière:', err);
    }
  }, []);

  const resetBranch = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setBranchState(null);
      window.dispatchEvent(new Event(EVENT_NAME));
    } catch (err) {
      console.warn('Erreur réinitialisation filière:', err);
    }
  }, []);

  return {
    branch: branch || 'PC', // fallback to PC if needed for components
    rawBranch: branch, // null if never selected
    hasSelectedBranch: branch !== null,
    isSM: branch === 'SM',
    isPC: branch === 'PC' || branch === null,
    selectBranch,
    resetBranch,
  };
}
