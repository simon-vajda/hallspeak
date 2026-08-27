import { describe, expect, it } from 'vitest';
import { connectionToastMessage } from './use-connection-toast';

describe('connectionToastMessage', () => {
  it('stays silent before the first successful connection', () => {
    expect(connectionToastMessage('connecting', false)).toBeNull();
    expect(connectionToastMessage('error', false)).toBeNull();
  });

  it('orders connection loss before retrying and clears after recovery', () => {
    expect(
      ['lost', 'connecting', 'connected'].map((status) =>
        connectionToastMessage(status as 'lost' | 'connecting' | 'connected', true),
      ),
    ).toEqual(['Connection lost', 'Reconnecting…', null]);
  });

  it('reports a terminal disconnect as connection loss without promising a retry', () => {
    expect(connectionToastMessage('error', true)).toBe('Connection lost');
  });
});
