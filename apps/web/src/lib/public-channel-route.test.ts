import type { components } from '@hallspeak/contract/openapi';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { loadPublicChannelRoute } from './public-channel-route';
import { publicChannelQueryOptions } from './public-queries';

type PublicChannelView = components['schemas']['PublicChannelView'];

const listenerView: PublicChannelView = {
  event: { pin: '123456', name: 'Conference' },
  channel: { slug: 'english', name: 'English', online: true },
  role: 'listener',
};

describe('loadPublicChannelRoute', () => {
  it('does not wait for the optional listener event list', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(publicChannelQueryOptions('123456', 'english').queryKey, listenerView);
    const pending = new Promise<void>(() => undefined);
    const prefetch = vi.spyOn(queryClient, 'prefetchQuery').mockReturnValue(pending);

    const outcome = await Promise.race([
      loadPublicChannelRoute(queryClient, {
        pin: '123456',
        slug: 'english',
        speakerCode: undefined,
      }).then(() => 'loaded'),
      new Promise<'blocked'>((resolve) => setTimeout(() => resolve('blocked'), 50)),
    ]);

    expect(outcome).toBe('loaded');
    expect(prefetch).toHaveBeenCalledOnce();
  });

  it('does not fetch the event list for a speaker', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(publicChannelQueryOptions('123456', 'english', 'secret').queryKey, {
      ...listenerView,
      role: 'speaker',
    } satisfies PublicChannelView);
    const prefetch = vi.spyOn(queryClient, 'prefetchQuery');

    await loadPublicChannelRoute(queryClient, {
      pin: '123456',
      slug: 'english',
      speakerCode: 'secret',
    });

    expect(prefetch).not.toHaveBeenCalled();
  });
});
