import { apiProblemCode } from '@hallspeak/client-core/query-retry';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { MissingEvent } from '@/components/admin/missing-event';
import { useRouteQueryRetry } from '@/lib/use-route-query-retry';

export function EventDetailRouteError({ error }: ErrorComponentProps) {
  const retry = useRouteQueryRetry();
  const invalidId = error instanceof Error && error.message.startsWith('Invalid event id:');
  const notFound = invalidId || apiProblemCode(error) === 'not_found';

  return <MissingEvent notFound={notFound} onRetry={retry} />;
}
