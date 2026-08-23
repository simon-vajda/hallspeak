import { Input as InputPrimitive } from '@base-ui/react/input';
import type * as React from 'react';

import { cn } from '@/lib/utils';

// CUSTOMISED (see AGENTS.md): a `shape` variant. `pill` is the product's field — 44px,
// filled at rest, a two-pixel primary border on focus — and is the default; `box` is the
// generated bordered spelling, kept for any surface that needs it.
//
// Neither shape sets a font size: the base is `text-base md:text-sm`, and below 16px iOS
// Safari zooms the viewport when a field takes focus and never zooms back out.
const SHAPES = {
  pill: 'h-11 rounded-full border-2 border-transparent bg-secondary px-4 focus-visible:border-primary focus-visible:bg-card focus-visible:ring-0 aria-invalid:border-destructive aria-invalid:ring-0 dark:aria-invalid:border-destructive/50',
  box: 'h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
} as const;

function Input({
  className,
  type,
  shape = 'pill',
  ...props
}: React.ComponentProps<'input'> & { shape?: keyof typeof SHAPES }) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        'w-full min-w-0 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:disabled:bg-input/80',
        SHAPES[shape],
        className,
      )}
      {...props}
    />
  );
}

export { Input };
