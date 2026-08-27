import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';

export function MissingEvent({ notFound, onRetry }: { notFound: boolean; onRetry?: () => void }) {
  return (
    <div>
      <h1 className="text-screen">{notFound ? 'Event not found' : 'Could not load this event'}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {notFound
          ? 'It may have been deleted. Its PIN and channels went with it.'
          : 'The request to the server failed. Try again.'}
      </p>
      {notFound ? (
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link to="/admin/events" />}
          size="action"
          className="mt-8"
        >
          Back to events
        </Button>
      ) : (
        <Button type="button" variant="outline" size="action" onClick={onRetry} className="mt-8">
          Try again
        </Button>
      )}
    </div>
  );
}
