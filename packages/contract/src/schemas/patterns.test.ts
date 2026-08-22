import { describe, expect, it } from 'vitest';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_NUMBER_PATTERN,
  PASSWORD_SPECIAL_PATTERN,
  PIN_PATTERN,
  SEMVER_PATTERN,
  SLUG_PATTERN,
} from './patterns';

describe('PIN_PATTERN', () => {
  it('matches six digits', () => {
    expect(PIN_PATTERN.test('834912')).toBe(true);
    expect(PIN_PATTERN.test('000000')).toBe(true);
  });

  it('rejects anything that is not exactly six digits', () => {
    expect(PIN_PATTERN.test('83491')).toBe(false);
    expect(PIN_PATTERN.test('8349123')).toBe(false);
    expect(PIN_PATTERN.test('83491a')).toBe(false);
    expect(PIN_PATTERN.test('')).toBe(false);
  });

  it('is anchored, so a six-digit run inside a longer string does not match', () => {
    expect(PIN_PATTERN.test('pin 834912\n')).toBe(false);
  });
});

describe('SLUG_PATTERN', () => {
  it('matches lowercase kebab-case', () => {
    expect(SLUG_PATTERN.test('english')).toBe(true);
    expect(SLUG_PATTERN.test('latin-american-spanish')).toBe(true);
  });

  it('rejects uppercase, leading or doubled separators, and the empty string', () => {
    expect(SLUG_PATTERN.test('English')).toBe(false);
    expect(SLUG_PATTERN.test('--a')).toBe(false);
    expect(SLUG_PATTERN.test('a--b')).toBe(false);
    expect(SLUG_PATTERN.test('a-')).toBe(false);
    expect(SLUG_PATTERN.test('')).toBe(false);
  });
});

describe('SEMVER_PATTERN', () => {
  it('matches x.y.z and rejects prereleases and partial versions', () => {
    expect(SEMVER_PATTERN.test('1.4.0')).toBe(true);
    expect(SEMVER_PATTERN.test('1.4.0-rc.1')).toBe(false);
    expect(SEMVER_PATTERN.test('1.4')).toBe(false);
  });
});

describe('the password rules', () => {
  it('sets a minimum length the drawn checklist can state', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
  });

  it('finds a digit anywhere and nowhere else', () => {
    expect(PASSWORD_NUMBER_PATTERN.test('hunter2')).toBe(true);
    expect(PASSWORD_NUMBER_PATTERN.test('hunter!')).toBe(false);
  });

  it('counts anything that is not a letter or a digit as the special character', () => {
    expect(PASSWORD_SPECIAL_PATTERN.test('hunter!')).toBe(true);
    expect(PASSWORD_SPECIAL_PATTERN.test('aVeryLongPassword12345')).toBe(false);
  });

  it('counts a space, so a passphrase is not refused for lacking punctuation', () => {
    expect(PASSWORD_SPECIAL_PATTERN.test('correct horse battery 9')).toBe(true);
  });
});
