import { z } from '@hono/zod-openapi';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_NUMBER_PATTERN,
  PASSWORD_SPECIAL_PATTERN,
} from './patterns';

export const AdminUsername = z.string().min(1).max(64).openapi({ example: 'admin' });

// One lookahead pattern rather than two .regex() calls: OpenAPI carries a single `pattern`
// per schema, so chaining them publishes whichever the generator kept and silently drops
// the other. Built from the same constants, so the rules still live in one place.
const NEW_PASSWORD_PATTERN = new RegExp(
  `^(?=.*${PASSWORD_NUMBER_PATTERN.source})(?=.*${PASSWORD_SPECIAL_PATTERN.source})`,
);

export const NewPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH)
  .max(PASSWORD_MAX_LENGTH)
  .regex(NEW_PASSWORD_PATTERN);

export const SetupBody = z
  .object({ username: AdminUsername, password: NewPassword })
  .openapi('SetupBody');

// Deliberately not NewPassword: the rules govern what may be chosen, and restating them
// here would refuse a stored password the day the rules are tightened. The length ceiling
// is a request-size bound, so it applies on both setup and sign-in.
export const LoginBody = z
  .object({ username: z.string().min(1), password: z.string().min(1).max(PASSWORD_MAX_LENGTH) })
  .openapi('LoginBody');

export const SessionState = z
  .object({ configured: z.boolean(), authenticated: z.boolean() })
  .openapi('SessionState');
