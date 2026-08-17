import path from 'node:path';
import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().min(1).default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // Resolved against the bundle, so it survives relocation by `pnpm deploy` or a COPY.
  // Under tsx it points at src/, where no public/ exists, which is right: Vite serves dev.
  WEB_ROOT: z
    .string()
    .min(1)
    .default(path.join(import.meta.dirname, 'public')),
  // Resolved against the working directory, unlike WEB_ROOT: the database is user data
  // and would be destroyed by every redeploy if it lived inside dist/.
  DATABASE_PATH: z.string().min(1).default('./data/linguacast.db'),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(`Invalid environment configuration:\n${z.prettifyError(parsed.error)}`);
  process.exit(1);
}

export const env = parsed.data;
