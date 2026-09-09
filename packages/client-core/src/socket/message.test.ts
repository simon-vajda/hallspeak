import { describe, expect, it } from 'vitest';
import { socketMessage } from './message';

describe('socketMessage', () => {
  it('tells stale bundled web to reload', () => {
    expect(socketMessage('web_version_mismatch')).toBe('This page is out of date. Reload it.');
  });

  it('tells unsupported mobile releases to update', () => {
    expect(socketMessage('mobile_version_too_old')).toBe(
      'This app version is no longer supported. Update LinguaCast.',
    );
  });
});
