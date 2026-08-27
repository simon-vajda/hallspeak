import { Link } from '@tanstack/react-router';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ListenerPageLink({
  pin,
  slug,
  className,
}: {
  pin: string;
  slug: string;
  className?: string;
}) {
  return (
    <Link
      to="/events/$pin/$slug"
      params={{ pin, slug }}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open the listener page in a new tab"
      className={cn(
        'mx-auto flex w-fit items-center gap-1.5 text-meta font-semibold text-muted-foreground hover:text-foreground hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
        className,
      )}
    >
      Open listener page
      <ExternalLink aria-hidden className="size-3.5" />
    </Link>
  );
}
