import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { ChannelRouteError } from '@/components/guest/channel-route-error';
import { GuestMessage } from '@/components/guest/guest-message';
import { ListenerChannel } from '@/components/guest/listener-channel';
import { SpeakerChannel } from '@/components/speaker/speaker-channel';
import { publicChannelQueryOptions, publicEventQueryOptions } from '@/lib/public-queries';

// One route for both roles: removing speaker_code degrades a speaker URL into a listener URL.
const SearchSchema = z.object({ speaker_code: z.string().optional() });

export const Route = createFileRoute('/events/$pin/$slug')({
  validateSearch: SearchSchema,
  loaderDeps: ({ search }) => ({ speakerCode: search.speaker_code }),
  loader: async ({ context, params, deps }) => {
    const view = await context.queryClient.ensureQueryData(
      publicChannelQueryOptions(params.pin, params.slug, deps.speakerCode),
    );

    // Listener switcher needs event channels. A speaker never pays for this second request.
    if (view.role === 'listener') {
      await context.queryClient.ensureQueryData(publicEventQueryOptions(params.pin));
    }
  },
  pendingComponent: () => <GuestMessage title="Opening the channel" body="One moment." />,
  errorComponent: ChannelRouteError,
  component: ChannelPage,
});

function ChannelPage() {
  const { pin, slug } = Route.useParams();
  const { speaker_code: speakerCode } = Route.useSearch();
  const { data: view } = useSuspenseQuery(publicChannelQueryOptions(pin, slug, speakerCode));

  if (view.role === 'speaker') {
    if (speakerCode === undefined) {
      throw new Error('Speaker response did not have a speaker code.');
    }
    return <SpeakerChannel view={view} speakerCode={speakerCode} />;
  }

  return <ListenerChannel view={view} />;
}
