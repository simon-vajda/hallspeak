import { Pin } from '@/components/pin';

export function EventHeader({
  name,
  description,
  pin,
  className,
}: {
  name: string;
  description: string | null;
  pin: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <h1 className="mb-2.5 text-screen lg:mb-3.5 lg:text-screen-lg">{name}</h1>

      {description && (
        <p className="mb-2 text-sm leading-normal text-muted-foreground lg:mb-6 lg:text-body-lg">
          {description}
        </p>
      )}

      <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-meta text-muted-foreground lg:gap-2.5 lg:px-4.5 lg:py-2.5 lg:text-note lg:font-medium">
        PIN
        <Pin pin={pin} className="text-note font-semibold text-foreground lg:text-pin" />
      </div>
    </div>
  );
}
