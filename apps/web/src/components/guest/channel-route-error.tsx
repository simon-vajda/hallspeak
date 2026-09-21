import { apiProblemCode } from '@hallspeak/client-core/query-retry';
import { type ErrorComponentProps, getRouteApi, Link } from '@tanstack/react-router';
import { GuestMessage, GuestMessageAction } from '@/components/guest/guest-message';
import { Button } from '@/components/ui/button';
import { useRouteQueryRetry } from '@/lib/use-route-query-retry';

const routeApi = getRouteApi('/events/$pin/$slug');

export function ChannelRouteError({ error }: ErrorComponentProps) {
  const retry = useRouteQueryRetry();
  const { pin } = routeApi.useParams();
  const code = apiProblemCode(error);

  if (code === 'invalid_speaker_code') {
    return (
      <GuestMessage
        title="That speaker link is out of date"
        body="Its code has been regenerated since the link was shared. Ask the organiser for the current one — or listen in without it."
      >
        <GuestMessageAction link={<Link to="/events/$pin" params={{ pin }} />}>
          Listen instead
        </GuestMessageAction>
      </GuestMessage>
    );
  }

  if (code === 'not_found') {
    return (
      <GuestMessage
        title="No such channel"
        body="This channel may have been renamed or switched off. The event's other channels are still there."
      >
        <GuestMessageAction link={<Link to="/events/$pin" params={{ pin }} />}>
          Back to channels
        </GuestMessageAction>
      </GuestMessage>
    );
  }

  if (code === 'rate_limited') {
    return (
      <GuestMessage title="Too many incorrect links" body="Wait a moment before trying again.">
        <GuestMessageAction link={<Link to="/" />}>Back to PIN entry</GuestMessageAction>
      </GuestMessage>
    );
  }

  return (
    <GuestMessage
      title="Could not open this channel"
      body="The server did not answer. Check your connection and try again."
    >
      <Button
        type="button"
        variant="outline"
        size="pill"
        onClick={retry}
        className="mt-8 w-full lg:w-50"
      >
        Try again
      </Button>
    </GuestMessage>
  );
}
