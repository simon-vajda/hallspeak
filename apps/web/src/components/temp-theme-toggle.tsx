// TEMPORARY: exists so both themes can be exercised before a permanent theme control is sited.

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { themeFlip } from '@/lib/theme-flip';

export function TempThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { next, label } = themeFlip(
    theme,
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  return (
    <Button variant="ghost" size="icon" onClick={() => setTheme(next)}>
      {next === 'light' ? <Sun /> : <Moon />}
      <span className="sr-only">{label}</span>
    </Button>
  );
}
