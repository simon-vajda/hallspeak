// `./socket` is deliberately NOT re-exported here. This barrel pulls in ./openapi,
// which imports @hono/zod-openapi and therefore Hono — fine on the server, dead weight
// in a browser bundle. Clients import from '@linguacast/contract/socket'.
export * from './openapi';
export * from './routes';
export * from './schemas';
