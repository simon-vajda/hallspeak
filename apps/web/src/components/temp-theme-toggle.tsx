// TEMPORARY. Exists only so both themes can be exercised before the permanent home
// for a theme control is decided. One call site: apps/web/src/routes/index.tsx.
// Deleting this file and that one line of JSX removes it entirely.

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';

export function TempThemeToggle() {
  const { theme, setTheme } = useTheme();

  const isDark =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : theme === 'dark';

  return (
    <Button variant="ghost" size="icon" onClick={() => setTheme(isDark ? 'light' : 'dark')}>
      {isDark ? <Sun /> : <Moon />}
      <span className="sr-only">Switch to {isDark ? 'light' : 'dark'} theme</span>
    </Button>
  );
}
