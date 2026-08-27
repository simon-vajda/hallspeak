import type { QueryClient } from '@tanstack/react-query';
import { publicChannelQueryOptions, publicEventQueryOptions } from '@/lib/public-queries';

export async function loadPublicChannelRoute(
  queryClient: QueryClient,
  { pin, slug, speakerCode }: { pin: string; slug: string; speakerCode: string | undefined },
): Promise<void> {
  const view = await queryClient.ensureQueryData(publicChannelQueryOptions(pin, slug, speakerCode));

  // Channel is required to enter. Event list only enriches listener switcher after entry.
  if (view.role === 'listener') {
    void queryClient.prefetchQuery(publicEventQueryOptions(pin));
  }
}
