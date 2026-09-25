import { radius, spacing } from './tokens';

const JOIN = 6;

/**
 * Material 3's connected list: the group's outer corners are full, every join between two
 * rows is nearly square, so a stack of rows reads as one object rather than a pile of cards.
 * A single row is both ends at once and comes out fully rounded.
 */
export function connectedListShape(index: number, count: number) {
  const first = index === 0 ? radius.xl : JOIN;
  const last = index === count - 1 ? radius.xl : JOIN;

  return {
    borderTopLeftRadius: first,
    borderTopRightRadius: first,
    borderBottomLeftRadius: last,
    borderBottomRightRadius: last,
  };
}

export const column = { width: '100%', maxWidth: spacing.column, alignSelf: 'center' } as const;
