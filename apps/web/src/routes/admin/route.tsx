import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { LogoLockup } from '@/components/logo-lockup';
import { TempThemeToggle } from '@/components/temp-theme-toggle';

export const Route = createFileRoute('/admin')({ component: AdminLayout });

// The design also draws a Settings tab and an account avatar. Neither surface exists, and a
// control that cannot be used is a promise the app can't keep.
function AdminLayout() {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-shell items-center justify-between px-gutter py-4 lg:px-10">
          <Link to="/admin/events">
            <LogoLockup />
          </Link>
          <nav className="flex items-center gap-5.5 text-[13px] font-medium">
            <Link
              to="/admin/events"
              className="text-muted-foreground transition-colors hover:text-foreground [&.active]:font-semibold [&.active]:text-foreground"
            >
              Events
            </Link>
            <TempThemeToggle />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-shell px-gutter py-8 lg:px-10 lg:py-9">
        <Outlet />
      </main>
    </div>
  );
}
