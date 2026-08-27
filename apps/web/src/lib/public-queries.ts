import { $api } from '@/api/client';

export const publicEventQueryOptions = (pin: string) =>
  $api.queryOptions('get', '/events/{pin}', { params: { path: { pin } } });

export const publicChannelQueryOptions = (pin: string, slug: string, speakerCode?: string) =>
  $api.queryOptions('get', '/events/{pin}/{slug}', {
    params: {
      path: { pin, slug },
      query: speakerCode ? { speaker_code: speakerCode } : {},
    },
  });
