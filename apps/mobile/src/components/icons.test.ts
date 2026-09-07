import { describe, expect, it } from '@jest/globals';
import { icons } from './icons';

/**
 * Fixed on purpose. A glyph the screens reference but the set does not export renders as
 * nothing in a release build, where a failing list here is loud.
 */
const EXPECTED = [
  'airplay',
  'audio',
  'back',
  'close',
  'confirm',
  'forward',
  'headphones',
  'link',
  'listen',
  'output',
  'pin',
  'remove',
  'report',
  'retry',
  'scan',
  'torchOff',
  'torchOn',
  'unpin',
  'unreachable',
  'volume',
  'warn',
];

describe('icon set', () => {
  it('exports exactly the symbols the screens reference', () => {
    expect(Object.keys(icons).sort()).toEqual(EXPECTED);
  });

  it('resolves every name to a component', () => {
    for (const [name, glyph] of Object.entries(icons)) {
      expect(`${name} ${typeof glyph}`).toBe(`${name} object`);
    }
  });
});
