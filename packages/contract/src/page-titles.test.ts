import { describe, expect, it } from 'vitest';
import { DEFAULT_PAGE_TITLE, formatChannelPageTitle, formatEventPageTitle } from './page-titles';

describe('public page titles', () => {
  it('keeps the product title as the default', () => {
    expect(DEFAULT_PAGE_TITLE).toBe('Hallspeak');
  });

  it('formats event titles', () => {
    expect(formatEventPageTitle('Sunday Service')).toBe('Sunday Service | Hallspeak');
  });

  it('formats channel titles', () => {
    expect(formatChannelPageTitle('Sunday Service', 'English')).toBe(
      'Sunday Service - English | Hallspeak',
    );
  });
});
