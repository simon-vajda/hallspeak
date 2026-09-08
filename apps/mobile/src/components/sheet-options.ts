import type { Stack } from 'expo-router';
import { radius } from '@/theme/tokens';

/**
 * Android caps a form sheet at three detents and renders neither a header nor a nested stack
 * inside one, so every sheet owns its title and its dismiss control as content.
 */
export const SHEET_OPTIONS = {
  presentation: 'formSheet',
  sheetAllowedDetents: [0.5, 0.92],
  sheetGrabberVisible: true,
  sheetCornerRadius: radius.xl,
  headerShown: false,
} satisfies Parameters<typeof Stack.Screen>[0]['options'];
