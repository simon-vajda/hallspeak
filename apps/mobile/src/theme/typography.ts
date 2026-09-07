import { Platform, type TextStyle } from 'react-native';

/**
 * The type ramp from `docs/design/mobile-app/_ds/.../tokens/typography.css`, with every
 * `rem` resolved against the design's 16px root and every `em` of tracking resolved against
 * its own step — React Native takes points for both.
 *
 * The family split follows the design's build notes: Space Grotesk on the wordmark, screen
 * titles, event and channel names and any large readout; the platform's own face on rows,
 * buttons and sheet labels, because a restyled native control reads as an imitation of one.
 * A display step names the weight-matched static face rather than asking the system to
 * synthesise 600 from a regular one.
 */
export const DISPLAY_FONT = 'SpaceGrotesk_600SemiBold';

/**
 * A host is read character by character to check it against the card at a venue, which is
 * what the design sets it in a monospace face for. React Native has no `ui-monospace`, so
 * each platform's own is named.
 */
export const MONO_FONT = Platform.select({ ios: 'Menlo', default: 'monospace' });

export type TypeStep =
  | 'body'
  | 'bodyLg'
  | 'screen'
  | 'screenLg'
  | 'hero'
  | 'heroLg'
  | 'stat'
  | 'statLg'
  | 'title'
  | 'subtitle'
  | 'section'
  | 'pin'
  | 'pinLg'
  | 'note'
  | 'meta'
  | 'label';

type Step = Required<Pick<TextStyle, 'fontSize' | 'lineHeight' | 'fontWeight'>> &
  Pick<TextStyle, 'letterSpacing' | 'fontFamily'>;

const display = (fontSize: number, lineHeight: number, letterSpacing: number): Step => ({
  fontSize,
  lineHeight,
  letterSpacing,
  fontWeight: '600',
  fontFamily: DISPLAY_FONT,
});

export const type: Record<TypeStep, Step> = {
  // Body is the default step; it carries no tracking of its own.
  body: { fontSize: 14, lineHeight: 21, fontWeight: '400' },
  bodyLg: { fontSize: 17, lineHeight: 27.2, fontWeight: '400' },

  screen: display(30, 31.8, -1.05),
  screenLg: display(52, 53.56, -2.34),

  // The title of a screen whose only subject is one name — the channel a guest is listening to.
  hero: display(40, 41.2, -1.8),
  heroLg: display(46, 47.38, -2.07),

  // A number read at a glance. Line height 1 because the tile's padding sets its height.
  stat: display(32, 32, -1.44),
  statLg: display(36, 36, -1.62),

  title: display(22, 27.5, -0.66),
  subtitle: display(19, 23.75, -0.475),

  section: { fontSize: 17, lineHeight: 23.8, letterSpacing: -0.51, fontWeight: '600' },

  // Digits read off a screen, grouped 3+3. The tracking lives here so a call site cannot
  // forget it.
  pin: display(21, 21, 0.84),
  pinLg: display(28, 28, 1.12),

  note: { fontSize: 13, lineHeight: 19.5, fontWeight: '400' },
  meta: { fontSize: 12, lineHeight: 16.8, fontWeight: '500' },
  // Always uppercase at the call site.
  label: { fontSize: 12, lineHeight: 14.4, letterSpacing: 0.96, fontWeight: '600' },
};
