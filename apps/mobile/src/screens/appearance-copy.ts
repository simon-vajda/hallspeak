import type { ThemePreference } from '@/theme/preferences';

export const APPEARANCE_COPY = {
  title: 'Appearance',
  note: 'System follows your device’s appearance.',
  saveFailedTitle: 'Couldn’t save appearance',
  saveFailed: 'Couldn’t save appearance. It may reset when you reopen the app.',
  saveFailedBody: 'It may reset when you reopen the app.',
  cancel: 'Cancel',
} as const;

export const APPEARANCE_CHOICES: readonly { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];
