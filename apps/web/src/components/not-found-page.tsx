import { formatNotFoundPageTitle } from '@hallspeak/contract/page-titles';
import { Link } from '@tanstack/react-router';
import { AppHeader } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { VersionFooter } from '@/components/version-footer';
import { useDocumentTitle } from '@/lib/use-document-title';

export function NotFoundPage() {
  useDocumentTitle(formatNotFoundPageTitle());

  return (
    <div className="relative flex min-h-dvh flex-col">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-shell flex-1 flex-col px-gutter pt-7 pb-gutter lg:px-10 lg:pt-15 lg:pb-16.5">
        <h1 className="text-screen lg:text-screen-lg">Page not found</h1>
        <p className="mt-2.5 max-w-115 text-sm leading-normal text-muted-foreground lg:text-body-lg">
          This address may be incorrect, or the page may have moved.
        </p>
        <Button
          variant="outline"
          size="pill"
          nativeButton={false}
          render={<Link to="/" />}
          className="mt-8 w-full lg:w-50"
        >
          Back to PIN entry
        </Button>
      </main>

      <VersionFooter />
    </div>
  );
}
