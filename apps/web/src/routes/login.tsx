import { createFileRoute, redirect } from '@tanstack/react-router';
import { internalPath, sessionQueryOptions } from '@/lib/auth-queries';

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const target = internalPath(search.redirect);
    return target ? { redirect: target } : {};
  },
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions());
    if (!session.configured) throw redirect({ to: '/setup' });
  },
  component: LoginPage,
});

function LoginPage() {
  return null;
}
