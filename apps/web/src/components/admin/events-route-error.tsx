import type { ErrorComponentProps } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { useRouteQueryRetry } from '@/lib/use-route-query-retry';

export function EventsRouteError(_props: ErrorComponentProps) {
  const retry = useRouteQueryRetry();

  return (
    <div>
      <h1 className="text-screen">Events</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Could not load the event list — the request to the server failed.
      </p>
      <Button type="button" variant="outline" size="action" onClick={retry} className="mt-8">
        Try again
      </Button>
    </div>
  );
}
