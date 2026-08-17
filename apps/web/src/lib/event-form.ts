import { z } from 'zod';

// Mirrors `CreateEventBody` so the client rejects exactly what the server would. Restated
// rather than imported: there `description` is nullish, because the API models "clear it",
// where a textarea only ever yields a string.
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
