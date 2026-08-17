import { PIN_PATTERN } from '@linguacast/contract/patterns';
import { z } from 'zod';

// The six-digit rule is a protocol fact, so it comes from the contract; the error copy around
// it is UI and never crosses the wire.
export const pinFormSchema = z.object({
  pin: z.string().regex(PIN_PATTERN, 'Enter all six digits.'),
});

export type PinFormValues = z.infer<typeof pinFormSchema>;
