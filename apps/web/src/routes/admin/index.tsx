import { createFileRoute, redirect } from '@tanstack/react-router';

// /admin has no surface of its own — the layout route would render an empty column.
// Events is the only section there is, so it is where /admin means to go.
export const Route = createFileRoute('/admin/')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/events' });
  },
});
