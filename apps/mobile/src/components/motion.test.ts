import { describe, expect, it } from '@jest/globals';
import { motion } from '../theme/tokens';
import { glassMode } from './glass';
import { liveDotFrame, placeholderFrame, ringFrame } from './motion';

describe('reduced motion', () => {
  it('holds the ring at its resting frame rather than removing it', () => {
    expect(ringFrame(true)).toEqual({
      animated: false,
      scale: 1,
      opacity: motion.ringRestOpacity,
    });
  });

  it('holds the live dot solid, because it is a status and not decoration', () => {
    expect(liveDotFrame(true)).toEqual({ animated: false, opacity: 1 });
  });

  it('holds a placeholder still at its resting opacity rather than hiding it', () => {
    expect(placeholderFrame(true)).toEqual({
      animated: false,
      opacity: motion.placeholderRestOpacity,
    });
  });

  it('animates all three when the setting is off', () => {
    expect(ringFrame(false).animated).toBe(true);
    expect(liveDotFrame(false).animated).toBe(true);
    expect(placeholderFrame(false).animated).toBe(true);
  });
});

describe('glassMode', () => {
  it('falls back when the runtime check reports the API missing', () => {
    expect(glassMode(false, 'ios')).toBe('fallback');
  });

  it('uses glass when iOS reports the API present', () => {
    expect(glassMode(true, 'ios')).toBe('glass');
  });

  it('never puts glass on Android', () => {
    expect(glassMode(true, 'android')).toBe('fallback');
  });
});
