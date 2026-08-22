import type { Ack } from '@linguacast/contract/socket';
import { describe, expect, it } from 'vitest';
import type { SocketClient } from '@/socket/client';
import { signalling } from './signalling';

describe('produce signalling', () => {
  it('sends initial paused intent in the validated produce request', async () => {
    const calls: unknown[][] = [];
    const response: Ack<{ producerId: string }> = {
      ok: true,
      data: { producerId: 'producer-1' },
    };
    const socket = {
      emitWithAck: async (...args: unknown[]) => {
        calls.push(args);
        return response;
      },
    } as unknown as SocketClient;

    await signalling(socket).produce('english', { codec: 'opus' }, true);

    expect(calls).toEqual([
      [
        'media:produce',
        {
          slug: 'english',
          kind: 'audio',
          rtpParameters: { codec: 'opus' },
          paused: true,
        },
      ],
    ]);
  });
});
