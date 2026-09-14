import type { Theme } from '@/components/theme-provider';

/** The system preference is passed in so this stays testable without a DOM. */
export function themeFlip(
  theme: Theme,
  prefersDark: boolean,
): { next: 'light' | 'dark'; label: string } {
  const isDark = theme === 'system' ? prefersDark : theme === 'dark';
  const next = isDark ? 'light' : 'dark';
  return { next, label: `Switch to ${next} theme` };
}
