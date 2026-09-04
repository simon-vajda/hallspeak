import { Circle, Path, Rect, Svg } from 'react-native-svg';
import type { ColorName } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/**
 * The icon set is plain data so the geometry can be asserted without rendering anything: the
 * mobile suite has no renderer, and a drifted path or stroke weight is otherwise invisible.
 */
export type IconElement =
  | { kind: 'path'; d: string; fill?: ColorName }
  | {
      kind: 'rect';
      x: number;
      y: number;
      width: number;
      height: number;
      rx?: number;
      fill?: ColorName;
    }
  | { kind: 'circle'; cx: number; cy: number; r: number; fill?: ColorName };

export type IconGeometry = {
  viewBox: string;
  elements: IconElement[];
  fill?: 'none' | 'currentColor';
  stroke?: 'none' | 'currentColor';
  strokeWidth?: number;
  strokeLinecap?: 'round';
  strokeLinejoin?: 'round';
};

const OUTLINE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const satisfies Omit<IconGeometry, 'viewBox' | 'elements'>;

const SOLID = { fill: 'currentColor', stroke: 'none' } as const satisfies Omit<
  IconGeometry,
  'viewBox' | 'elements'
>;

const BOX = '0 0 24 24';

/** Names mirror the design set's `i-*` symbol ids with the prefix dropped. */
export type IconName =
  | 'qr'
  | 'link'
  | 'star'
  | 'star-filled'
  | 'chev-r'
  | 'chev-l'
  | 'arrow-l'
  | 'play'
  | 'pause'
  | 'head'
  | 'warn'
  | 'vol'
  | 'check'
  | 'x'
  | 'dots'
  | 'flash'
  | 'qrplate';

export const icons: Record<IconName, IconGeometry> = {
  qr: {
    viewBox: BOX,
    ...OUTLINE,
    elements: [
      { kind: 'rect', x: 3, y: 3, width: 7, height: 7, rx: 1 },
      { kind: 'rect', x: 14, y: 3, width: 7, height: 7, rx: 1 },
      { kind: 'rect', x: 3, y: 14, width: 7, height: 7, rx: 1 },
      { kind: 'path', d: 'M14 14h3v3h-3zM20 14v3M14 20h3M20 20h.01' },
    ],
  },
  link: {
    viewBox: BOX,
    ...OUTLINE,
    elements: [
      { kind: 'path', d: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5' },
      { kind: 'path', d: 'M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5' },
    ],
  },
  star: {
    viewBox: BOX,
    ...OUTLINE,
    strokeWidth: 1.8,
    elements: [
      {
        kind: 'path',
        d: 'M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.2l5.9-.9z',
      },
    ],
  },
  'star-filled': {
    viewBox: BOX,
    fill: 'currentColor',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinejoin: 'round',
    elements: [
      {
        kind: 'path',
        d: 'M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.2l5.9-.9z',
      },
    ],
  },
  'chev-r': {
    viewBox: BOX,
    ...OUTLINE,
    strokeWidth: 2.2,
    elements: [{ kind: 'path', d: 'M9 18l6-6-6-6' }],
  },
  'chev-l': {
    viewBox: BOX,
    ...OUTLINE,
    strokeWidth: 2.2,
    elements: [{ kind: 'path', d: 'M15 18l-6-6 6-6' }],
  },
  'arrow-l': {
    viewBox: BOX,
    ...OUTLINE,
    elements: [{ kind: 'path', d: 'M19 12H5M12 19l-7-7 7-7' }],
  },
  play: {
    viewBox: BOX,
    ...SOLID,
    elements: [{ kind: 'path', d: 'M6 3l14 9-14 9z' }],
  },
  pause: {
    viewBox: BOX,
    ...SOLID,
    elements: [
      { kind: 'rect', x: 6, y: 4, width: 4, height: 16, rx: 1 },
      { kind: 'rect', x: 14, y: 4, width: 4, height: 16, rx: 1 },
    ],
  },
  head: {
    viewBox: BOX,
    ...OUTLINE,
    elements: [
      {
        kind: 'path',
        d: 'M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3',
      },
    ],
  },
  warn: {
    viewBox: BOX,
    ...OUTLINE,
    elements: [
      { kind: 'circle', cx: 12, cy: 12, r: 9 },
      { kind: 'path', d: 'M12 8v4M12 16h.01' },
    ],
  },
  vol: {
    viewBox: BOX,
    ...OUTLINE,
    elements: [
      { kind: 'path', d: 'M11 5L6 9H3v6h3l5 4z' },
      { kind: 'path', d: 'M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13' },
    ],
  },
  check: {
    viewBox: BOX,
    ...OUTLINE,
    strokeWidth: 2.5,
    elements: [{ kind: 'path', d: 'M20 6L9 17l-5-5' }],
  },
  x: {
    viewBox: BOX,
    ...OUTLINE,
    strokeWidth: 2.4,
    elements: [{ kind: 'path', d: 'M18 6L6 18M6 6l12 12' }],
  },
  dots: {
    viewBox: BOX,
    ...SOLID,
    elements: [
      { kind: 'circle', cx: 12, cy: 5, r: 1.6 },
      { kind: 'circle', cx: 12, cy: 12, r: 1.6 },
      { kind: 'circle', cx: 12, cy: 19, r: 1.6 },
    ],
  },
  flash: {
    viewBox: BOX,
    ...OUTLINE,
    elements: [
      {
        kind: 'path',
        d: 'M6 2h12v3a2 2 0 0 1-.6 1.4L16 8v12a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8L6.6 6.4A2 2 0 0 1 6 5z',
      },
      { kind: 'path', d: 'M6 6h12M12 12v3' },
    ],
  },
  /**
   * A decorative QR plate rather than a tintable glyph: it needs a ground and modules at once, so
   * its two fills are named roles and it follows the theme instead of the caller's colour.
   */
  qrplate: {
    viewBox: '0 0 21 21',
    fill: 'none',
    elements: [
      { kind: 'rect', x: 0, y: 0, width: 21, height: 21, fill: 'background' },
      { kind: 'path', d: 'M0 0h7v7H0z', fill: 'foreground' },
      { kind: 'path', d: 'M14 0h7v7h-7z', fill: 'foreground' },
      { kind: 'path', d: 'M0 14h7v7H0z', fill: 'foreground' },
      { kind: 'path', d: 'M1 1h5v5H1z', fill: 'background' },
      { kind: 'path', d: 'M15 1h5v5h-5z', fill: 'background' },
      { kind: 'path', d: 'M1 15h5v5H1z', fill: 'background' },
      { kind: 'path', d: 'M2 2h3v3H2z', fill: 'foreground' },
      { kind: 'path', d: 'M16 2h3v3h-3z', fill: 'foreground' },
      { kind: 'path', d: 'M2 16h3v3H2z', fill: 'foreground' },
      {
        kind: 'path',
        d: 'M8 0h1v1H8zM10 0h1v1h-1zM12 0h1v1h-1zM9 1h1v1H9zM11 1h1v1h-1zM8 2h1v1H8zM9 2h1v1H9zM12 2h1v1h-1zM10 3h1v1h-1zM11 3h1v1h-1zM13 3h1v1h-1zM8 4h1v1H8zM12 4h1v1h-1zM13 4h1v1h-1zM9 5h1v1H9zM10 5h1v1h-1zM8 6h1v1H8zM11 6h1v1h-1zM13 6h1v1h-1z',
        fill: 'foreground',
      },
      {
        kind: 'path',
        d: 'M0 7h1v1H0zM2 7h1v1H2zM5 7h1v1H5zM8 7h1v1H8zM9 7h1v1H9zM12 7h1v1h-1zM14 7h1v1h-1zM16 7h1v1h-1zM19 7h1v1h-1z',
        fill: 'foreground',
      },
      {
        kind: 'path',
        d: 'M1 8h1v1H1zM3 8h1v1H3zM6 8h1v1H6zM7 8h1v1H7zM10 8h1v1h-1zM13 8h1v1h-1zM15 8h1v1h-1zM18 8h1v1h-1zM20 8h1v1h-1z',
        fill: 'foreground',
      },
      {
        kind: 'path',
        d: 'M0 9h1v1H0zM4 9h1v1H4zM5 9h1v1H5zM8 9h1v1H8zM11 9h1v1h-1zM12 9h1v1h-1zM16 9h1v1h-1zM17 9h1v1h-1zM20 9h1v1h-1z',
        fill: 'foreground',
      },
      {
        kind: 'path',
        d: 'M2 10h1v1H2zM3 10h1v1H3zM6 10h1v1H6zM9 10h1v1H9zM13 10h1v1h-1zM14 10h1v1h-1zM18 10h1v1h-1zM19 10h1v1h-1z',
        fill: 'foreground',
      },
      {
        kind: 'path',
        d: 'M1 11h1v1H1zM4 11h1v1H4zM7 11h1v1H7zM8 11h1v1H8zM10 11h1v1h-1zM15 11h1v1h-1zM16 11h1v1h-1zM20 11h1v1h-1z',
        fill: 'foreground',
      },
      {
        kind: 'path',
        d: 'M0 12h1v1H0zM3 12h1v1H3zM5 12h1v1H5zM9 12h1v1H9zM11 12h1v1h-1zM14 12h1v1h-1zM17 12h1v1h-1zM19 12h1v1h-1z',
        fill: 'foreground',
      },
      {
        kind: 'path',
        d: 'M2 13h1v1H2zM6 13h1v1H6zM7 13h1v1H7zM12 13h1v1h-1zM13 13h1v1h-1zM15 13h1v1h-1zM18 13h1v1h-1zM20 13h1v1h-1z',
        fill: 'foreground',
      },
      {
        kind: 'path',
        d: 'M8 14h1v1H8zM10 14h1v1h-1zM13 14h1v1h-1zM15 14h1v1h-1zM16 14h1v1h-1zM19 14h1v1h-1z',
        fill: 'foreground',
      },
      {
        kind: 'path',
        d: 'M9 15h1v1H9zM11 15h1v1h-1zM12 15h1v1h-1zM14 15h1v1h-1zM17 15h1v1h-1zM20 15h1v1h-1z',
        fill: 'foreground',
      },
      {
        kind: 'path',
        d: 'M8 16h1v1H8zM10 16h1v1h-1zM13 16h1v1h-1zM16 16h1v1h-1zM18 16h1v1h-1zM19 16h1v1h-1z',
        fill: 'foreground',
      },
      {
        kind: 'path',
        d: 'M9 17h1v1H9zM12 17h1v1h-1zM14 17h1v1h-1zM15 17h1v1h-1zM17 17h1v1h-1zM20 17h1v1h-1z',
        fill: 'foreground',
      },
      {
        kind: 'path',
        d: 'M8 18h1v1H8zM11 18h1v1h-1zM13 18h1v1h-1zM16 18h1v1h-1zM18 18h1v1h-1z',
        fill: 'foreground',
      },
      {
        kind: 'path',
        d: 'M10 19h1v1h-1zM12 19h1v1h-1zM14 19h1v1h-1zM17 19h1v1h-1zM19 19h1v1h-1zM20 19h1v1h-1z',
        fill: 'foreground',
      },
      {
        kind: 'path',
        d: 'M8 20h1v1H8zM9 20h1v1H9zM11 20h1v1h-1zM15 20h1v1h-1zM16 20h1v1h-1zM18 20h1v1h-1z',
        fill: 'foreground',
      },
    ],
  },
};

export const ICON_NAMES = Object.keys(icons) as IconName[];

export type IconProps = {
  name: IconName;
  size?: number;
  color?: ColorName;
};

export function Icon({ name, size = 20, color = 'foreground' }: IconProps) {
  const theme = useTheme();
  const icon = icons[name];
  const tint = theme.colors[color];

  const resolve = (value: 'none' | 'currentColor' | undefined, elementFill?: ColorName) => {
    if (elementFill !== undefined) {
      return theme.colors[elementFill];
    }
    if (value === undefined || value === 'none') {
      return 'none';
    }
    return tint;
  };

  return (
    <Svg width={size} height={size} viewBox={icon.viewBox} fill="none">
      {icon.elements.map((element) => {
        const common = {
          fill: resolve(icon.fill, element.fill),
          stroke: element.fill === undefined ? resolve(icon.stroke) : 'none',
          strokeWidth: icon.strokeWidth,
          strokeLinecap: icon.strokeLinecap,
          strokeLinejoin: icon.strokeLinejoin,
        };

        if (element.kind === 'rect') {
          return (
            <Rect
              key={`r${element.x},${element.y},${element.width},${element.height}`}
              {...common}
              x={element.x}
              y={element.y}
              width={element.width}
              height={element.height}
              rx={element.rx}
            />
          );
        }
        if (element.kind === 'circle') {
          return (
            <Circle
              key={`c${element.cx},${element.cy},${element.r}`}
              {...common}
              cx={element.cx}
              cy={element.cy}
              r={element.r}
            />
          );
        }
        return <Path key={element.d} {...common} d={element.d} />;
      })}
    </Svg>
  );
}
