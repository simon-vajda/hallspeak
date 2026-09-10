import { describe, expect, it } from 'vitest';
import { isHandheldBrowser, isPhoneBrowser } from './phone-browser';

describe('phone browser detection', () => {
  it.each([
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 16; Pixel 9) Chrome/140.0 Mobile Safari/537.36',
  ])('includes phone browser %s', (agent) => expect(isPhoneBrowser(agent)).toBe(true));

  it.each([
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0 Safari/537.36',
    'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 16; Tablet) Chrome/140.0 Safari/537.36',
  ])('excludes desktop and tablet browser %s', (agent) =>
    expect(isPhoneBrowser(agent)).toBe(false),
  );

  it.each([
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 16; Pixel 9) Chrome/140.0 Mobile Safari/537.36',
    'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 16; Tablet) Chrome/140.0 Safari/537.36',
  ])('includes handheld browser %s', (agent) => expect(isHandheldBrowser(agent, 5)).toBe(true));

  it.each([
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0 Safari/537.36',
  ])('excludes desktop browser %s from handheld', (agent) =>
    expect(isHandheldBrowser(agent, 0)).toBe(false),
  );

  it('reads an iPad claiming to be a Mac from its touch points', () => {
    const ipad = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.0 Safari/605.1.15';
    expect(isHandheldBrowser(ipad, 5)).toBe(true);
    expect(isHandheldBrowser(ipad, 0)).toBe(false);
  });
});
