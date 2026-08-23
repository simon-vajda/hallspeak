/**
 * The uppercase micro-label every flow uses to name a panel, a field or a statistic. A class
 * constant rather than a component because the call sites apply it to three different
 * elements — a `FieldLabel`, a `<span>`, a `<div>` — and a component would have to pick one.
 */
export const MICRO_LABEL = 'text-label text-muted-foreground uppercase';
