export type ColorSet = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  cardRing: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  primaryHover: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveMuted: string;
  destructiveBorder: string;
  warn: string;
  warnOnMuted: string;
  warnMuted: string;
  warnBorder: string;
  warnForeground: string;
  border: string;
  input: string;
  ring: string;
  live: string;
  liveOnMuted: string;
  liveMuted: string;
  hoverOverlay: string;
  hoverOverlayStrong: string;
};

const light: ColorSet = {
  background: '#F7FAFA',
  foreground: '#1B3149',
  card: '#FFFFFF',
  cardForeground: '#1B3149',
  // foreground at 10%: the 1px inset ring every panel carries.
  cardRing: '#1B31491A',
  popover: '#FFFFFF',
  popoverForeground: '#1B3149',
  primary: '#0BC3BC',
  primaryForeground: '#10283A',
  // primary mixed with 8% black: hover moves away from the light ground, so darker.
  primaryHover: '#0AAEA8',
  secondary: '#E7EFF0',
  secondaryForeground: '#1B3149',
  muted: '#E7EFF0',
  mutedForeground: '#4F6474',
  accent: '#E7EFF0',
  accentForeground: '#1B3149',
  destructive: '#B04437',
  destructiveMuted: '#F9E7E4',
  destructiveBorder: '#EDD1CC',
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
  // foreground at 6% and 10%.
  hoverOverlay: '#1B31490F',
  hoverOverlayStrong: '#1B31491A',
};

const dark: ColorSet = {
  background: '#101E2C',
  foreground: '#E8F2F3',
  card: '#1B3348',
  cardForeground: '#E8F2F3',
  cardRing: '#E8F2F31A',
  popover: '#1B3348',
  popoverForeground: '#E8F2F3',
  primary: '#0BC3BC',
  primaryForeground: '#10283A',
  // primary mixed with 12% white: away from the dark ground is lighter.
  primaryHover: '#4BCBC4',
  secondary: '#1B3348',
  secondaryForeground: '#E8F2F3',
  muted: '#1B3348',
  mutedForeground: '#93AEB8',
  accent: '#274158',
  accentForeground: '#E8F2F3',
  destructive: '#E4776A',
  // The design set states these two as oklch alone, with no hex to read. Built on the dark
  // destructive hue the way live-muted is built on live, matching apps/web/src/index.css.
  destructiveMuted: '#512C28',
  destructiveBorder: '#703C35',
  warn: '#E8B23C',
  warnOnMuted: '#F0C560',
  warnMuted: '#45371A',
  warnBorder: '#5A4A22',
  warnForeground: '#10283A',
  border: '#274158',
  input: '#274158',
  ring: '#0BC3BC',
  live: '#74E68C',
  liveOnMuted: '#74E68C',
  liveMuted: '#183F3C',
  // foreground at 10% and 15%: the same delta reads as less against a dark ground.
  hoverOverlay: '#E8F2F31A',
  hoverOverlayStrong: '#E8F2F326',
};

export const colors = { light, dark } as const;

export type ColorName = keyof ColorSet;

export type TypeStep = {
  fontSize: number;
  lineHeight: number;
  fontWeight: 400 | 500 | 600;
  letterSpacing?: number;
};

export const typography = {
  body: { fontSize: 14, lineHeight: 21, fontWeight: 400 },
  bodyLg: { fontSize: 17, lineHeight: 27.2, fontWeight: 400 },
  screen: { fontSize: 30, lineHeight: 31.8, fontWeight: 600, letterSpacing: -1.05 },
  screenLg: { fontSize: 52, lineHeight: 53.56, fontWeight: 600, letterSpacing: -2.34 },
  hero: { fontSize: 40, lineHeight: 41.2, fontWeight: 600, letterSpacing: -1.8 },
  heroLg: { fontSize: 46, lineHeight: 47.38, fontWeight: 600, letterSpacing: -2.07 },
  stat: { fontSize: 32, lineHeight: 32, fontWeight: 600, letterSpacing: -1.44 },
  statLg: { fontSize: 36, lineHeight: 36, fontWeight: 600, letterSpacing: -1.62 },
  title: { fontSize: 22, lineHeight: 27.5, fontWeight: 600, letterSpacing: -0.66 },
  subtitle: { fontSize: 19, lineHeight: 23.75, fontWeight: 600, letterSpacing: -0.475 },
  section: { fontSize: 17, lineHeight: 23.8, fontWeight: 600, letterSpacing: -0.51 },
  // Digits read off a screen or a card are always tracked out, from here rather than a call site.
  pin: { fontSize: 21, lineHeight: 21, fontWeight: 600, letterSpacing: 0.84 },
  pinLg: { fontSize: 28, lineHeight: 28, fontWeight: 600, letterSpacing: 1.12 },
  note: { fontSize: 13, lineHeight: 19.5, fontWeight: 400 },
  meta: { fontSize: 12, lineHeight: 16.8, fontWeight: 500 },
  label: { fontSize: 12, lineHeight: 14.4, fontWeight: 600, letterSpacing: 0.96 },
} as const satisfies Record<string, TypeStep>;

export type TypeName = keyof typeof typography;

export const fontFamilies = {
  400: 'SpaceGrotesk_400Regular',
  500: 'SpaceGrotesk_500Medium',
  600: 'SpaceGrotesk_600SemiBold',
} as const satisfies Record<TypeStep['fontWeight'], string>;

export const spacing = {
  step: 4,
  gutter: 26,
  gutterLg: 40,
  shell: 1120,
  panel: 22,
  actionX: 17,
  actionSm: 33,
  action: 38,
  touch: 44,
  pill: 48,
} as const;

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

export const elevation = {
  // 0 16px 40px, primary at 35%.
  goLive: {
    shadowColor: light.primary,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  cardRingWidth: 1,
} as const;
