import { type IconName, icons } from './icons';

/** The design's stroke weights: 2 by default, 2.25 on a large control. */
export const ICON_STROKE = 2;
export const ICON_STROKE_LARGE = 2.25;

/**
 * The one place an icon is rendered. Colour arrives as a resolved role token from the
 * caller's `useColors()`, never as a literal, and lucide is not imported anywhere else.
 *
 * `filled` is the design's solid form of a glyph that also has an outline form — the play
 * triangle, and a starred history row against an unstarred one.
 */
export function Icon({
  name,
  size = 20,
  color,
  strokeWidth = ICON_STROKE,
  filled = false,
}: {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
  filled?: boolean;
}) {
  const Glyph = icons[name];

  return (
    <Glyph
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      {...(filled ? { fill: color } : {})}
    />
  );
}
