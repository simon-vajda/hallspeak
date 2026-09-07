import { Platform, type TextStyle } from 'react-native';

/**
 * Every size is in points: `rem` is resolved against a 16px root and `em` of tracking
 * against its own step, because React Native takes points for both.
 *
 * The family split: Space Grotesk on the wordmark, screen titles, event and channel names
 * and any large readout; the platform's own face on rows, buttons and sheet labels, because
 * a restyled native control reads as an imitation of one. A display step names the
 * weight-matched static face rather than asking the system to synthesise 600 from a regular
 * one.
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
  | 'bodyStrong'
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
  | 'label'
  | 'prompt'
  | 'wordmark'
  | 'option'
  | 'mono'
  | 'monoValue';

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
  // Body carrying a value rather than prose: the right-hand side of a sheet's row.
  bodyStrong: { fontSize: 14, lineHeight: 21, fontWeight: '600' },

  // 38px, which is what the mobile design draws for a screen title. The web app's own step
  // is 30, but that ramp's phone value was never this app's: these screens were drawn at 38.
  screen: display(38, 38, -1.52),
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

  // `title`'s size at the design's own tracking for a sentence rather than a name: the
  // scanner asks a question over the camera, and the tighter figure closes the words up.
  prompt: display(22, 27.5, -0.22),

  wordmark: display(20, 24, -0.4),

  // A row in a sheet's option list, in the platform's own face and at its own metrics. A
  // restyled native control reads as an imitation of one, so the split lives here rather
  // than at the two call sites that would otherwise each carry half of it.
  option: Platform.select({
    android: { fontSize: 16, lineHeight: 22, letterSpacing: 0.16, fontWeight: '500' },
    default: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  }) as Step,

  // Metadata read character by character — a host checked against the card at a venue.
  mono: { fontFamily: MONO_FONT, fontSize: 12, lineHeight: 16, fontWeight: '500' },
  // A figure read at a glance: a volume percentage, a value in a sheet's row.
  monoValue: { fontFamily: MONO_FONT, fontSize: 14, lineHeight: 20, fontWeight: '600' },
};
