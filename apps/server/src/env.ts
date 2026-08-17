import path from 'node:path';
import { z } from 'zod';

const BaseEnvSchema = z.object({
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

  // What the workers bind. 0.0.0.0 is right behind a router doing the forwarding.
  MEDIA_LISTEN_IP: z.string().min(1).default('0.0.0.0'),
  // What goes into ICE candidates, so it must be the address a client can actually
  // reach. There is no safe default: a wrong value produces well-formed candidates
  // nobody can connect to, with no error anywhere, so production refuses to boot without it.
  MEDIA_ANNOUNCED_IP: z.string().min(1).optional(),
  // Worker i binds base + i, on UDP and TCP. The operator forwards this many ports.
  MEDIA_RTC_PORT_BASE: z.coerce.number().int().min(1024).max(65_000).default(44400),
  MEDIA_MAX_WORKERS: z.coerce.number().int().positive().max(64).default(4),
  MEDIA_ROOM_IDLE_GRACE_MS: z.coerce.number().int().positive().optional(),

  MEDIA_STUN_URL: z.string().min(1).optional(),
  MEDIA_TURN_URL: z.string().min(1).optional(),
  // coturn's shared secret, used to mint short-lived per-session credentials. It is
  // never handed to a client; a standing credential given to every guest is a relay.
  MEDIA_TURN_SECRET: z.string().min(1).optional(),
});

export const EnvSchema = BaseEnvSchema.refine(
  (env) => env.NODE_ENV !== 'production' || env.MEDIA_ANNOUNCED_IP !== undefined,
  {
    path: ['MEDIA_ANNOUNCED_IP'],
    message: 'Required in production: ICE candidates need an address a client can reach.',
  },
  // Loopback is the only announced address that is honest when nothing was configured:
  // it works for a browser on this machine and fails visibly anywhere else.
).transform((env) => ({ ...env, MEDIA_ANNOUNCED_IP: env.MEDIA_ANNOUNCED_IP ?? '127.0.0.1' }));

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(`Invalid environment configuration:\n${z.prettifyError(parsed.error)}`);
  process.exit(1);
}

export const env = parsed.data;
