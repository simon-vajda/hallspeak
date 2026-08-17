import { createContext, type ReactNode, use, useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

/**
 * The pre-paint script in `index.html` hard-codes the same string: it runs before any module
 * loads, so the two cannot import from each other. Change one and you must change the other.
 */
export const THEME_STORAGE_KEY = 'linguacast-theme';

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Storage access throws rather than returning null where cookies are blocked. This runs in a
// useState initializer above the router, where an uncaught throw blanks the whole app.
function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
  } catch {
    return 'system';
  }
}

function systemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    const apply = () => {
      const resolved = theme === 'system' ? systemTheme() : theme;
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(resolved);
    };

    apply();
    if (theme !== 'system') return;

    // Only 'system' tracks the OS; an explicit choice must not be overridden by it.
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Blocked storage: the choice will not survive a reload, but it still applies now.
    }
    setThemeState(next);
  }, []);

  return <ThemeContext value={{ theme, setTheme }}>{children}</ThemeContext>;
}

export function useTheme() {
  const context = use(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}
