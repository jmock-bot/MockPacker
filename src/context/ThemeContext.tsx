import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemePref = 'light' | 'dark' | 'system';

/** Shared with the no-FOUC bootstrap script in index.html — keep in sync. */
export const THEME_STORAGE_KEY = 'mp-theme';

type ThemeContextValue = {
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'system',
  setTheme: () => undefined,
});

export const useTheme = () => useContext(ThemeContext);

function readStored(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* localStorage unavailable (e.g. private mode) — fall back to system */
  }
  return 'system';
}

/** Resolve a preference to an effective mode and stamp .dark on <html>. */
function applyTheme(theme: ThemePref) {
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = theme === 'dark' || (theme === 'system' && systemDark);
  document.documentElement.classList.toggle('dark', dark);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePref>(readStored);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Follow OS changes only while the preference is "system".
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = (t: ThemePref) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, t);
    } catch {
      /* ignore write failures — the in-memory preference still applies */
    }
    setThemeState(t);
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}
