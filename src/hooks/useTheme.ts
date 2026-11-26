import { useState, useEffect, useCallback } from 'react';

export type AppTheme = 'dark' | 'light';

const THEME_STORAGE_KEY = 'sidriss_theme_v1';
const THEME_CHANGE_EVENT = 'sidriss_theme_changed';

function getStoredTheme(): AppTheme {
  try {
    const val = localStorage.getItem(THEME_STORAGE_KEY);
    return val === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function applyThemeToDocument(theme: AppTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', theme === 'light' ? '#f8fafc' : '#131314');
  }
}

if (typeof window !== 'undefined') {
  applyThemeToDocument(getStoredTheme());
}

export function useTheme() {
  const [theme, setThemeState] = useState<AppTheme>(getStoredTheme);

  useEffect(() => {
    const syncTheme = () => {
      const latest = getStoredTheme();
      setThemeState(latest);
      applyThemeToDocument(latest);
    };
    window.addEventListener(THEME_CHANGE_EVENT, syncTheme);
    window.addEventListener('storage', syncTheme);
    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, syncTheme);
      window.removeEventListener('storage', syncTheme);
    };
  }, []);

  const setTheme = useCallback((next: AppTheme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {}
    applyThemeToDocument(next);
    setThemeState(next);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(getStoredTheme() === 'dark' ? 'light' : 'dark');
  }, [setTheme]);

  return {
    theme,
    isLight: theme === 'light',
    setTheme,
    toggleTheme,
  };
}

