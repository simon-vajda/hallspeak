import type { Stack } from 'expo-router';

type Options = Parameters<typeof Stack.Screen>[0]['options'];

/** Material's basic dialog, drawn by `MaterialDialog` over a transparent modal. Android only. */
export const DIALOG_OPTIONS = {
  presentation: 'transparentModal',
  animation: 'fade',
  headerShown: false,
  contentStyle: { backgroundColor: 'transparent' },
} satisfies Options;

/** Material's full-screen dialog, drawn by `FullScreenDialog`. Android only. */
export const FULL_SCREEN_DIALOG_OPTIONS = {
  presentation: 'fullScreenModal',
  animation: 'slide_from_bottom',
  headerShown: false,
} satisfies Options;
