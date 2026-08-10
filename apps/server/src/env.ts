import path from 'node:path';
import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().min(1).default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // Absolute path to the built SPA. import.meta.dirname is the bundle's own
  // directory, so in production this resolves to apps/server/dist/public and
  // survives being relocated by `pnpm deploy` or a Dockerfile COPY. Under tsx in
  // dev it resolves to apps/server/src, where no public/ exists — which is the
  // correct outcome, since Vite serves the SPA in dev.
  WEB_ROOT: z
    .string()
    .min(1)
    .default(path.join(import.meta.dirname, 'public')),
  // Resolved against the process working directory, deliberately unlike WEB_ROOT:
  // that points at a build artifact, whereas the database is user data and would be
  // destroyed by every redeploy if it lived inside dist/.
  DATABASE_PATH: z.string().min(1).default('./data/linguacast.db'),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(`Invalid environment configuration:\n${z.prettifyError(parsed.error)}`);
  process.exit(1);
}

export const env = parsed.data;
