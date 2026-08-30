import { Radio } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * The line a destructive admin dialog gains when the thing it is about to take down is on air.
 * Its callers decide whether it appears at all — a withheld poll produces no warning, because a
 * warning is a claim about the world and a dead poll has none to make.
 */
export function LiveWarning({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-md bg-destructive-muted px-3 py-2.5 text-destructive">
      <Radio aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
