import { cn } from '@/lib/utils';
import { BUILD_LABEL } from '@/version';

/** Sits last in a screen's column, so a short page pins it down and a long one scrolls to it. */
export function VersionFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        'mx-auto w-full max-w-shell shrink-0 px-gutter pt-2 pb-4 text-center text-meta text-muted-foreground lg:px-10',
        className,
      )}
    >
      {BUILD_LABEL}
    </footer>
  );
}
