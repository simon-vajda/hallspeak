import { z } from 'zod';

// Mirrors `CreateEventBody` in the contract so the client rejects exactly what the server
// would. It is not imported from there: that schema is a wire shape — `description` is
// nullish because the API models "clear it", whereas a textarea only ever yields a string —
// and the error copy below never crosses the wire.
export const eventFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Give the event a name.')
    .max(120, 'Keep the name to 120 characters or fewer.'),
  description: z.string().trim().max(2000, 'Keep the description to 2000 characters or fewer.'),
  enabled: z.boolean(),
});

export type EventFormValues = z.infer<typeof eventFormSchema>;
