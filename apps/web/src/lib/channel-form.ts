import { SLUG_PATTERN } from '@linguacast/contract/patterns';
import { z } from 'zod';

/** `Slug` in the contract is `min(1).max(40)` over `SLUG_PATTERN`. */
const SLUG_MAX = 40;

// Mirrors `CreateChannelBody` so the client rejects exactly what the server would. The
// pattern itself comes from the contract's Hono-free subpath; the copy below never
// crosses the wire, which is why the schema is restated rather than imported.
export const channelFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Give the channel a name.')
    .max(120, 'Keep the name to 120 characters or fewer.'),
  slug: z
    .string()
    .trim()
    .min(1, 'Give the channel a slug.')
    .max(SLUG_MAX, `Keep the slug to ${SLUG_MAX} characters or fewer.`)
    .regex(SLUG_PATTERN, 'Lowercase letters and numbers, separated by single hyphens.'),
  enabled: z.boolean(),
});

export type ChannelFormValues = z.infer<typeof channelFormSchema>;

/**
 * Proposes a slug from a channel name: `Español` → `espanol`. Channel names are languages,
 * so stripping diacritics is the whole job — the slug ends up in a URL a guest may have to
 * read off a printed card. The result can be empty (a name of only punctuation), which the
 * schema then reports as a missing slug rather than this silently inventing one.
 */
export function slugify(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/, '');
}
