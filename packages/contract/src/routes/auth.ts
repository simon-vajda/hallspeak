import { createRoute, type z } from '@hono/zod-openapi';
import { LoginBody, SessionState, SetupBody } from '../schemas/auth';
import { Problem } from '../schemas/problem';

// Outside /admin on purpose: sign-in has to be reachable without a session, so it cannot
// sit behind the prefix it exists to unlock.
const TAGS = ['Auth'];

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { 'application/json': { schema } },
  description,
});
const problem = (description: string) => json(Problem, description);
const body = <T extends z.ZodType>(schema: T) => ({
  content: { 'application/json': { schema } },
  required: true as const,
});

export const getSessionState = createRoute({
  method: 'get',
  path: '/auth/session',
  tags: TAGS,
  summary: 'Whether this server has an administrator, and whether this caller is one',
  responses: { 200: json(SessionState, 'OK') },
});

export const setupAdmin = createRoute({
  method: 'post',
  path: '/auth/setup',
  tags: TAGS,
  summary: 'Create the administrator on a server that has none',
  request: { body: body(SetupBody) },
  responses: {
    201: json(SessionState, 'Created, and signed in'),
    400: problem('The password does not meet the rules'),
    409: problem('This server already has an administrator'),
    429: problem('Too many attempts'),
  },
});

export const login = createRoute({
  method: 'post',
  path: '/auth/login',
  tags: TAGS,
  summary: 'Sign in',
  request: { body: body(LoginBody) },
  responses: {
    200: json(SessionState, 'Signed in'),
    400: problem('Invalid body'),
    // One response for a wrong username and a wrong password alike.
    401: problem('Those credentials do not match'),
    429: problem('Too many attempts'),
  },
});

export const logout = createRoute({
  method: 'post',
  path: '/auth/logout',
  tags: TAGS,
  summary: 'End this session',
  responses: { 204: { description: 'Signed out' } },
});
