import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Invisible text sets the block to the loaded element's line height. */
export function SkeletonLine({ className, text }: { className: string; text: string }) {
  return (
    <Skeleton className={cn('rounded-full', className)}>
      <span className="invisible">{text}</span>
    </Skeleton>
  );
}
