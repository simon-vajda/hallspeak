import { createRoute, z } from '@hono/zod-openapi';
import {
  AdminChannel,
  AdminEvent,
  AdminEventDetail,
  AdminLiveEvent,
  CreateChannelBody,
  CreateEventBody,
  UpdateChannelBody,
  UpdateEventBody,
} from '../schemas/event';
import { Problem } from '../schemas/problem';

// Unguarded. The /admin prefix exists so authentication lands as one middleware on one subtree.
const TAGS = ['Admin'];

// z.coerce: a path parameter always arrives as a string.
const IdParam = z.object({ id: z.coerce.number().int().positive() });

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { 'application/json': { schema } },
  description,
});
const problem = (description: string) => json(Problem, description);
const body = <T extends z.ZodType>(schema: T) => ({
  content: { 'application/json': { schema } },
  required: true as const,
});

export const adminListEvents = createRoute({
  method: 'get',
  path: '/admin/events',
  tags: TAGS,
  summary: 'Every event, enabled or not, with its channels',
  responses: { 200: json(z.array(AdminEventDetail), 'OK') },
});

export const adminCreateEvent = createRoute({
  method: 'post',
  path: '/admin/events',
  tags: TAGS,
  summary: 'Create an event',
  request: { body: body(CreateEventBody) },
  responses: { 201: json(AdminEventDetail, 'Created'), 400: problem('Invalid body') },
});

export const adminGetEvent = createRoute({
  method: 'get',
  path: '/admin/events/{id}',
  tags: TAGS,
  summary: 'One event with all its channels',
  request: { params: IdParam },
  responses: { 200: json(AdminEventDetail, 'OK'), 404: problem('No such event') },
});

export const adminPatchEvent = createRoute({
  method: 'patch',
  path: '/admin/events/{id}',
  tags: TAGS,
  summary: 'Edit an event',
  request: { params: IdParam, body: body(UpdateEventBody) },
  responses: {
    200: json(AdminEventDetail, 'OK'),
    400: problem('Invalid body'),
    404: problem('No such event'),
  },
});

export const adminDeleteEvent = createRoute({
  method: 'delete',
  path: '/admin/events/{id}',
  tags: TAGS,
  summary: 'Delete an event and its channels',
  request: { params: IdParam },
  responses: { 204: { description: 'Deleted' }, 404: problem('No such event') },
});

export const adminRegeneratePin = createRoute({
  method: 'post',
  path: '/admin/events/{id}/regenerate-pin',
  tags: TAGS,
  summary: 'Replace the event PIN, invalidating the old one immediately',
  request: { params: IdParam },
  responses: { 200: json(AdminEvent, 'OK'), 404: problem('No such event') },
});

// No path parameter: one poll covers the events list and an event detail page alike.
export const adminGetLive = createRoute({
  method: 'get',
  path: '/admin/live',
  tags: TAGS,
  summary: 'Live channels across every event, with their listener counts',
  responses: { 200: json(z.array(AdminLiveEvent), 'OK') },
});

export const adminCreateChannel = createRoute({
  method: 'post',
  path: '/admin/events/{id}/channels',
  tags: TAGS,
  summary: 'Add a channel to an event',
  request: { params: IdParam, body: body(CreateChannelBody) },
  responses: {
    201: json(AdminChannel, 'Created'),
    400: problem('Invalid body'),
    404: problem('No such event'),
    409: problem('That slug is already used on this event'),
  },
});

export const adminPatchChannel = createRoute({
  method: 'patch',
  path: '/admin/channels/{id}',
  tags: TAGS,
  summary: 'Edit a channel name or its enabled flag — never its slug',
  request: { params: IdParam, body: body(UpdateChannelBody) },
  responses: {
    200: json(AdminChannel, 'OK'),
    400: problem('Invalid body'),
    404: problem('No such channel'),
  },
});

export const adminDeleteChannel = createRoute({
  method: 'delete',
  path: '/admin/channels/{id}',
  tags: TAGS,
  summary: 'Delete a channel',
  request: { params: IdParam },
  responses: { 204: { description: 'Deleted' }, 404: problem('No such channel') },
});

export const adminRegenerateSpeakerCode = createRoute({
  method: 'post',
  path: '/admin/channels/{id}/regenerate-speaker-code',
  tags: TAGS,
  summary: 'Replace the speaker code — the sole mitigation for a leaked one',
  request: { params: IdParam },
  responses: { 200: json(AdminChannel, 'OK'), 404: problem('No such channel') },
});
