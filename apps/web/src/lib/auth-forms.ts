import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_NUMBER_PATTERN,
  PASSWORD_SPECIAL_PATTERN,
} from '@linguacast/contract/patterns';
import { z } from 'zod';

const username = z
  .string()
  .min(1, 'Enter a username.')
  .max(64, 'Keep the username to 64 characters.');

const newPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(PASSWORD_MAX_LENGTH, `Use no more than ${PASSWORD_MAX_LENGTH} characters.`)
  .regex(PASSWORD_NUMBER_PATTERN, 'Add at least one number.')
  .regex(PASSWORD_SPECIAL_PATTERN, 'Add at least one special character.');

export const setupFormSchema = z
  .object({
    username,
    password: newPassword,
    confirmation: z.string().max(PASSWORD_MAX_LENGTH),
  })
  .refine(({ password, confirmation }) => password === confirmation, {
    path: ['confirmation'],
    message: 'Passwords do not match.',
  });

export type SetupFormValues = z.infer<typeof setupFormSchema>;

// Sign-in must accept passwords created before password rules are tightened.
export const loginFormSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;
