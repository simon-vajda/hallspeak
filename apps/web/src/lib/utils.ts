import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge has to be told the `@theme` scale entries `index.css` adds, or it guesses —
 * and it guesses wrong. A bare word after `text-` reads as a colour to it, so `text-label`
 * merged against any `text-*` colour is *dropped* rather than kept, and the element falls
 * back to the inherited size. The named spacing steps have the matching problem: unknown to
 * it, `h-touch` and `h-9.5` do not conflict, so a call site cannot override a primitive.
 *
 * Keep both lists in step with `index.css`. A new scale entry that is missing here fails
 * silently at whichever call site first merges it against something.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        'screen',
        'screen-lg',
        'hero',
        'hero-lg',
        'stat',
        'stat-lg',
        'title',
        'subtitle',
        'section',
        'body-lg',
        'label',
        'meta',
        'note',
        'pin',
        'pin-lg',
      ],
      spacing: ['gutter', 'shell', 'panel', 'action-x', 'action', 'touch'],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
