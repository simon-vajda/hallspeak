import { PIN_PATTERN } from '@linguacast/contract/patterns';
import { z } from 'zod';

// The six-digit rule is a protocol fact the server already enforces, so it comes from
// the contract. The schema around it is UI — error copy and field name never cross the
// wire — so it lives here.
export const pinFormSchema = z.object({
  pin: z.string().regex(PIN_PATTERN, 'Enter all six digits.'),
});

export type PinFormValues = z.infer<typeof pinFormSchema>;
