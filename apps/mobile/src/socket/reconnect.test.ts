import { describe, expect, it } from '@jest/globals';
import { shouldReconnectOnForeground } from './reconnect';

describe('shouldReconnectOnForeground', () => {
  it('reconnects a disconnected socket returning to the foreground', () => {
    expect(
      shouldReconnectOnForeground({ previous: 'background', next: 'active', connected: false }),
    ).toBe(true);
  });

  it('leaves a connected socket alone', () => {
    expect(
      shouldReconnectOnForeground({ previous: 'background', next: 'active', connected: true }),
    ).toBe(false);
  });

  it('does nothing on the way into the background', () => {
    expect(
      shouldReconnectOnForeground({ previous: 'active', next: 'background', connected: false }),
    ).toBe(false);
  });

  it('does nothing when the app was already active', () => {
    expect(
      shouldReconnectOnForeground({ previous: 'active', next: 'active', connected: false }),
    ).toBe(false);
  });

  it('treats iOS inactive as backgrounded, so returning from it still reconnects', () => {
    expect(
      shouldReconnectOnForeground({ previous: 'inactive', next: 'active', connected: false }),
    ).toBe(true);
  });
});
