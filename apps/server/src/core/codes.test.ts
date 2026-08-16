import { describe, expect, it } from 'vitest';
import { generatePin, generateSpeakerCode } from './codes';

describe('generatePin', () => {
  it('is always exactly six digits, including when the value is small', () => {
    for (let i = 0; i < 500; i++) {
      expect(generatePin()).toMatch(/^\d{6}$/);
    }
  });

  it('does not return the same value every time', () => {
    const seen = new Set(Array.from({ length: 50 }, generatePin));

    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('generateSpeakerCode', () => {
  it('is 32 URL-safe characters', () => {
    expect(generateSpeakerCode()).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it('does not repeat', () => {
    const seen = new Set(Array.from({ length: 100 }, generateSpeakerCode));

    expect(seen.size).toBe(100);
  });
});
