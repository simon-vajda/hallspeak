import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { setUnauthenticatedHandler } from './api/client';
import { ThemeProvider } from './components/theme-provider';
import { sessionKey } from './lib/auth-queries';
import { routeTree } from './routeTree.gen';
import './index.css';

const queryClient = new QueryClient();
const router = createRouter({ routeTree, context: { queryClient } });

// A 401 from any admin call means the session died server-side. Removed rather than
// invalidated: the guards read this entry through `ensureQueryData`, which hands back a
// cached value however stale it is marked, so an invalidated entry would still say signed
// in. Removing it forces the refetch, and invalidating the router is what turns that into
// one redirect instead of a poll that fails forever.
setUnauthenticatedHandler(() => {
  queryClient.removeQueries({ queryKey: sessionKey() });
  void router.invalidate();
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
