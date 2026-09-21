import type { QueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { NotFoundPage } from '@/components/not-found-page';
import { Toaster } from '@/components/ui/sonner';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  notFoundComponent: NotFoundPage,
});

function RootComponent() {
  return (
    <>
      <Outlet />
      <Toaster position="bottom-center" />
      <TanStackRouterDevtools position="bottom-left" />
      <ReactQueryDevtools buttonPosition="bottom-right" />
    </>
  );
}
