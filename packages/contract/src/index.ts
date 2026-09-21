// `./socket` is not re-exported: this barrel pulls in Hono via ./openapi. Browser
// clients import '@hallspeak/contract/socket'.
export * from './openapi';
export * from './routes';
export * from './schemas';
