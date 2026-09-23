/**
 * Colours are hex because React Native supports neither `oklch()` nor `color-mix()`. The
 * hover overlays and `primaryHover` are deliberately absent: they exist for a pointer, and
 * a touch device's pressed state is `Pressable`'s job.
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
  | 'primaryMuted'
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
  // The ground sits a clear step below white so that every surface above it separates by tone
  // alone. Held nearer white it read as a fourth shade of the same near-white as the cards,
  // the panels and the tonal actions, which on a phone in daylight is no separation at all.
  background: '#F2F7F8',
  foreground: '#1B3149',
  card: '#FFFFFF',
  cardForeground: '#1B3149',
  popover: '#FFFFFF',
  popoverForeground: '#1B3149',

  primary: '#0BC3BC',
  primaryForeground: '#10283A',
  // The design's `color-mix(in oklch, primary 18%, …)` selection wash, resolved against the
  // surface a selected row actually sits on — `card` in each scheme. Teal, never `live-muted`:
  // a chosen row is something you pressed, not audio moving.
  primaryMuted: '#C3EDEC',

  secondary: '#DCE7E9',
  secondaryForeground: '#1B3149',
  muted: '#DCE7E9',
  mutedForeground: '#4F6474',
  accent: '#DCE7E9',
  accentForeground: '#1B3149',

  destructive: '#B04437',
  destructiveMuted: '#F7E3DF',
  destructiveBorder: '#E9C8C2',

  // Amber is a wash and a figure, never a solid fill and never a dot: at signal strength it
  // is 3.1:1 on `background`, enough for shapes and not for copy. `warnOnMuted` is the type
  // colour that carries the words.
  warn: '#BE8104',
  warnOnMuted: '#7A5406',
  warnMuted: '#F7E9C9',
  warnBorder: '#E9D3A2',
  warnForeground: '#10283A',

  border: '#C2D2D6',
  input: '#C2D2D6',
  ring: '#0BC3BC',

  live: '#3AD3A6',
  liveOnMuted: '#0C6349',
  liveMuted: '#BAE9D6',
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
  primaryMuted: '#184D5D',

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
 *
 * These are roles, not a numeric grid. React Native has no cascade, so every value is stated
 * at every component and a 4pt scale would only rename the numbers; what earns a token is a
 * measurement that means the same thing in more than one place, and would be wrong in one of
 * them if the other changed. A padding used once inside a single component stays a literal.
 */
export const spacing = {
  /** Screen edge to content on a list surface — Home, the header row, the thumb line. Event
   * and Channel set their own, wider, because the design draws them that way. */
  gutter: 16,
  /** The same distance on a surface that floats over a screen: a sheet, a snackbar, a
   * full-screen message. Wider, because the surface carries its own edge. */
  overlay: 26,
  /** The inset of a filled panel. */
  panel: 22,
  /** A text action's horizontal padding. */
  actionX: 17,
  /** A compact round control that sits beside text. */
  action: 38,
  /** The smallest target a finger is given, and the floor for a control in a cluster. */
  touch: 44,
  /** A pill-shaped input. */
  pill: 48,
  /** A full-width or floating action: the thumb line, the scanner's action, a tonal button. */
  control: 56,
} as const;

/**
 * Two animations exist tied to audio state, plus the pulse of a screen still loading; nothing
 * else moves except a press.
 */
export const motion = {
  pressMs: 120,
  colourMs: 300,
  pulseLiveMs: 2000,
  ringMs: 2600,
  ringDelayMs: 1300,
  /** The frame both animations hold at under Reduce Motion, rather than disappearing. */
  ringRestOpacity: 0.45,
  /** One full dim-and-return of a loading placeholder. */
  placeholderPulseMs: 1600,
  /** The frame a placeholder rests at, and holds under Reduce Motion. */
  placeholderRestOpacity: 1,
  /** The far end of the pulse. */
  placeholderDimOpacity: 0.5,
} as const;

/**
 * The design writes its washes as `color-mix(in oklch, <role> N%, transparent)`. React
 * Native has no such function, so a call site composes the same thing from a role token and
 * an alpha — never from a second hex, which would fix one scheme's answer into both.
 */
export function withAlpha(hex: string, alpha: number): string {
  const byte = Math.round(Math.min(Math.max(alpha, 0), 1) * 255);

  return `${hex}${byte.toString(16).padStart(2, '0')}`;
}

export type SurfaceLevel = 'low' | 'base' | 'high' | 'highest';

/**
 * Material 3's tonal container ladder, which is how Android expresses depth: a surface one
 * step along the ladder reads as raised, without a blur and without a gradient. The direction
 * is the platform's own and differs per scheme — a light container darkens as it rises,
 * because nothing is lighter than the white it starts at, while a dark one lightens.
 *
 * Both schemes stay on the palette's hue, so a stepped surface never reads as a second
 * colour. `low` in light and `base` in dark are the values `card` already carries, so a
 * surface that takes them is unchanged.
 *
 * It is deliberately unused on iOS, where depth is glass and a cast shadow.
 */
const lightSurfaces: Record<SurfaceLevel, string> = {
  low: '#FFFFFF',
  base: '#DFEAEC',
  high: '#D5E1E4',
  highest: '#CBD9DC',
};

const darkSurfaces: Record<SurfaceLevel, string> = {
  low: '#16283A',
  base: '#1B3348',
  high: '#213C53',
  highest: '#274158',
};

export const surfaces: Record<ColorScheme, Record<SurfaceLevel, string>> = {
  light: lightSurfaces,
  dark: darkSurfaces,
};
