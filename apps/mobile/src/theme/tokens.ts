/**
 * The design system's tokens, transcribed from
 * `docs/design/mobile-app/_ds/.../tokens/{colors,layout,motion}.css`.
 *
 * Colours are hex because React Native supports neither `oklch()` nor `color-mix()`. Each
 * value is the hex the design file records beside its `oklch()`; the two exceptions are
 * noted where they occur. The hover overlays and `primaryHover` are deliberately absent:
 * they exist for a pointer, and a touch device's pressed state is `Pressable`'s job.
 *
 * Teal (`primary`) marks what can be pressed. Green (`live`) marks that audio is moving.
 * They are near-identical in greyscale, so shape and position carry the distinction and the
 * two are never swapped or blended.
 */

export type ColorRole =
  | 'background'
  | 'foreground'
  | 'card'
  | 'cardForeground'
  | 'popover'
  | 'popoverForeground'
  | 'primary'
  | 'primaryForeground'
  | 'secondary'
  | 'secondaryForeground'
  | 'muted'
  | 'mutedForeground'
  | 'accent'
  | 'accentForeground'
  | 'destructive'
  | 'destructiveMuted'
  | 'destructiveBorder'
  | 'warn'
  | 'warnOnMuted'
  | 'warnMuted'
  | 'warnBorder'
  | 'warnForeground'
  | 'border'
  | 'input'
  | 'ring'
  | 'live'
  | 'liveOnMuted'
  | 'liveMuted';

export type ColorScheme = 'light' | 'dark';

export type Palette = Record<ColorRole, string>;

const light: Palette = {
  background: '#F7FAFA',
  foreground: '#1B3149',
  card: '#FFFFFF',
  cardForeground: '#1B3149',
  popover: '#FFFFFF',
  popoverForeground: '#1B3149',

  primary: '#0BC3BC',
  primaryForeground: '#10283A',

  secondary: '#E7EFF0',
  secondaryForeground: '#1B3149',
  muted: '#E7EFF0',
  mutedForeground: '#4F6474',
  accent: '#E7EFF0',
  accentForeground: '#1B3149',

  destructive: '#B04437',
  destructiveMuted: '#F9E7E4',
  destructiveBorder: '#EDD1CC',

  // Amber is a wash and a figure, never a solid fill and never a dot: at signal strength it
  // is 3.2:1 on `background`, enough for shapes and not for copy. `warnOnMuted` is the type
  // colour that carries the words.
  warn: '#BE8104',
  warnOnMuted: '#7A5406',
  warnMuted: '#FBF0D9',
  warnBorder: '#EEDCB0',
  warnForeground: '#10283A',

  border: '#D6E4E6',
  input: '#D6E4E6',
  ring: '#0BC3BC',

  live: '#3AD3A6',
  liveOnMuted: '#0C6349',
  liveMuted: '#D9F3EA',
};

const dark: Palette = {
  background: '#101E2C',
  foreground: '#E8F2F3',
  card: '#1B3348',
  cardForeground: '#E8F2F3',
  popover: '#1B3348',
  popoverForeground: '#E8F2F3',

  // Identical to light on purpose: what can be pressed is the same teal in both schemes.
  primary: '#0BC3BC',
  primaryForeground: '#10283A',

  secondary: '#1B3348',
  secondaryForeground: '#E8F2F3',
  muted: '#1B3348',
  mutedForeground: '#93AEB8',
  // One step up from `popover`, whose highlighted row is this token's only role. Equal to
  // `popover` would make the highlight invisible.
  accent: '#274158',
  accentForeground: '#E8F2F3',

  destructive: '#E4776A',
  // The design file records no hex beside these two, so they are converted from the same
  // `oklch(0.34 0.055 28.2)` and `oklch(0.42 0.075 28.5)` the web app ships.
  destructiveMuted: '#512C28',
  destructiveBorder: '#703C35',

  warn: '#E8B23C',
  // Not the signal colour repeated, unlike `liveOnMuted`: a half-step lighter, because the
  // warm brown ground eats `warn` where the cool navy ground does not.
  warnOnMuted: '#F0C560',
  warnMuted: '#45371A',
  warnBorder: '#5A4A22',
  warnForeground: '#10283A',

  border: '#274158',
  input: '#274158',
  ring: '#0BC3BC',

  live: '#74E68C',
  // The mint itself: the dark green light mode uses would vanish here.
  liveOnMuted: '#74E68C',
  liveMuted: '#183F3C',
};

/**
 * In dark mode `muted`, `secondary`, `card` and `popover` are one value. Do not reach for
 * `muted` as a surface there, and do not express a pressed state as a swap to it.
 */
export const colors: Record<ColorScheme, Palette> = { light, dark };

/** 20px is the panel; `full` is every action and every pill. */
export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  '2xl': 36,
  '3xl': 44,
  '4xl': 52,
  full: 999,
} as const;

/**
 * Raw numbers, because React Native takes numbers: the fractional-step spelling Tailwind
 * needs to reach an off-scale value has no equivalent here.
 */
export const spacing = {
  step: 4,
  gutter: 26,
  gutterLg: 40,
  shell: 1120,
  panel: 22,
  actionX: 17,
  action: 38,
  actionSm: 33,
  touch: 44,
  pill: 48,
} as const;

/** Two animations exist, both tied to audio state; nothing else moves except a press. */
export const motion = {
  pressMs: 120,
  colourMs: 300,
  pulseLiveMs: 2000,
  ringMs: 2600,
  ringDelayMs: 1300,
  /** The frame both animations hold at under Reduce Motion, rather than disappearing. */
  ringRestOpacity: 0.45,
} as const;
