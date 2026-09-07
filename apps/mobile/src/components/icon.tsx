import { type IconName, icons } from './icons';

/** The design's stroke weights: 2 by default, 2.25 on a large control. */
export const ICON_STROKE = 2;
export const ICON_STROKE_LARGE = 2.25;

/**
 * The one place an icon is rendered. Colour arrives as a resolved role token from the
 * caller's `useColors()`, never as a literal, and lucide is not imported anywhere else.
 */
export function Icon({
  name,
  size = 20,
  color,
  strokeWidth = ICON_STROKE,
}: {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  const Glyph = icons[name];

  return <Glyph size={size} color={color} strokeWidth={strokeWidth} />;
}
