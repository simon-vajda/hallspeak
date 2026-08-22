import { describe, expect, it } from 'vitest';
import { internalPath } from './auth-queries';

describe('internalPath', () => {
  it('returns a plain router path unchanged', () => {
    expect(internalPath('/admin/events')).toBe('/admin/events');
  });

  it('keeps a query string and a fragment', () => {
    expect(internalPath('/admin/events/3?tab=channels#english')).toBe(
      '/admin/events/3?tab=channels#english',
    );
  });

  it.each([
    ['a protocol-relative host', '//evil.example'],
    ['a backslash the URL parser reads as a host', '/\\evil.example'],
    ['a backslash pair', '/\\/evil.example'],
    ['an absolute URL', 'https://evil.example/admin/events'],
    ['a bare path with no leading slash', 'admin/events'],
    ['an empty string', ''],
  ])('refuses %s', (_name, value) => {
    expect(internalPath(value)).toBeUndefined();
  });

  it.each([
    ['undefined', undefined],
    ['a number', 3],
    ['an array', ['/admin/events']],
  ])('refuses a non-string (%s)', (_name, value) => {
    expect(internalPath(value)).toBeUndefined();
  });
});
