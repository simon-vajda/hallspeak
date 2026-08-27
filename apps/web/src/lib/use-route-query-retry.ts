import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useEffect } from 'react';

/** Reset Query's matching error whenever Router mounts an error boundary, and expose retry. */
export function useRouteQueryRetry(): () => void {
  const router = useRouter();
  const queryErrorResetBoundary = useQueryErrorResetBoundary();

  useEffect(() => {
    queryErrorResetBoundary.reset();
  }, [queryErrorResetBoundary]);

  return () => {
    queryErrorResetBoundary.reset();
    void router.invalidate();
  };
}
