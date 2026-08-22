import { createFileRoute, redirect } from '@tanstack/react-router';
import { sessionQueryOptions } from '@/lib/auth-queries';

export const Route = createFileRoute('/setup')({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions());
    // The wizard is unreachable once an account exists; it cannot create a second one.
    if (session.configured) throw redirect({ to: '/login' });
  },
  component: SetupPage,
});

function SetupPage() {
  return null;
}
