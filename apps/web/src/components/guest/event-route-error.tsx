import type { ErrorComponentProps } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';
import { GuestMessage, GuestMessageAction } from '@/components/guest/guest-message';
import { Button } from '@/components/ui/button';
import { apiProblemCode } from '@/lib/query-retry';
import { useRouteQueryRetry } from '@/lib/use-route-query-retry';

export function EventRouteError({ error }: ErrorComponentProps) {
  const retry = useRouteQueryRetry();
  const code = apiProblemCode(error);

  if (code === 'not_found') {
    return (
      <GuestMessage
        title="No event with that PIN"
        body="Check the six digits on the card at your seat. If they match, the event may not have started yet."
      >
        <GuestMessageAction link={<Link to="/" />}>Try another PIN</GuestMessageAction>
      </GuestMessage>
    );
  }

  if (code === 'rate_limited') {
    return (
      <GuestMessage title="Too many incorrect PINs" body="Wait a moment before trying another PIN.">
        <GuestMessageAction link={<Link to="/" />}>Back to PIN entry</GuestMessageAction>
      </GuestMessage>
    );
  }

  return (
    <GuestMessage
      title="Could not check that PIN"
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
