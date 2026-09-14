import { createFileRoute, Link, Outlet, redirect } from '@tanstack/react-router';
import { AccountMenu } from '@/components/admin/account-menu';
import { LogoLockup } from '@/components/logo-lockup';
import { VersionFooter } from '@/components/version-footer';
import { sessionQueryOptions } from '@/lib/auth-queries';

export const Route = createFileRoute('/admin')({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions());
    // Before the session branch: a fresh installer who opens an admin screen would otherwise
    // land on a sign-in form with no account to sign into.
    if (!session.configured) {
      throw redirect({ to: '/setup' });
    }
    if (!session.authenticated) {
      throw redirect({ to: '/login', search: { redirect: location.href } });
    }
  },
  component: AdminLayout,
});

// Events is the only tab: there is no settings surface, and a control that cannot be used is
// a promise the app can't keep.
function AdminLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-shell items-center justify-between gap-4 px-gutter py-4 lg:px-10">
          <Link to="/admin/events">
            <LogoLockup />
          </Link>
          <nav className="flex items-center gap-5.5 text-note font-medium">
            <Link
              to="/admin/events"
              className="text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 [&.active]:font-semibold [&.active]:text-foreground"
            >
              Events
            </Link>
            <AccountMenu />
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-shell grow px-gutter py-8 lg:px-10 lg:py-9">
        <Outlet />
      </main>

      <VersionFooter />
    </div>
  );
}
