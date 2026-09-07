import { motion } from '@/theme/tokens';

/**
 * The two animations the design defines, both tied to audio state. Under Reduce Motion they
 * hold at a resting frame rather than disappearing: the live dot is a status, not
 * decoration, and a removed ring would leave the target a different size.
 */
export type RingFrame = { animated: boolean; scale: number; opacity: number };

export function ringFrame(reduceMotion: boolean): RingFrame {
  return reduceMotion
    ? { animated: false, scale: 1, opacity: motion.ringRestOpacity }
    : { animated: true, scale: 1, opacity: motion.ringRestOpacity };
}

export type LiveDotFrame = { animated: boolean; opacity: number };

export function liveDotFrame(reduceMotion: boolean): LiveDotFrame {
  // Solid, never the dimmed half of the pulse: a status held at 45% reads as uncertainty.
  return reduceMotion ? { animated: false, opacity: 1 } : { animated: true, opacity: 1 };
}
