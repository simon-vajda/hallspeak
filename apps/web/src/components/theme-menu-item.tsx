import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { themeFlip } from '@/lib/theme-flip';

export function ThemeMenuItem() {
  const { theme, setTheme } = useTheme();
  const { next, label } = themeFlip(
    theme,
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  return (
    <DropdownMenuItem onClick={() => setTheme(next)}>
      {next === 'light' ? <Sun /> : <Moon />}
      {label}
    </DropdownMenuItem>
  );
}
