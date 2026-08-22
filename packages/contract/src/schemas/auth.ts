import { z } from '@hono/zod-openapi';
import { PASSWORD_MIN_LENGTH, PASSWORD_NUMBER_PATTERN, PASSWORD_SPECIAL_PATTERN } from './patterns';

export const AdminUsername = z.string().min(1).max(64).openapi({ example: 'admin' });

const PASSWORD_MAX_LENGTH = 128;

export const NewPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH)
  .max(PASSWORD_MAX_LENGTH)
  .regex(PASSWORD_NUMBER_PATTERN)
  .regex(PASSWORD_SPECIAL_PATTERN);

export const SetupBody = z
  .object({ username: AdminUsername, password: NewPassword })
  .openapi('SetupBody');

// Deliberately not NewPassword: the rules govern what may be chosen, and restating them
// here would refuse a stored password the day the rules are tightened.
export const LoginBody = z
  .object({ username: z.string().min(1), password: z.string().min(1) })
  .openapi('LoginBody');

export const SessionState = z
  .object({ configured: z.boolean(), authenticated: z.boolean() })
  .openapi('SessionState');
