// openapi.ts registers Object.values(routes), so a route missing from this barrel is
// silently absent from the document and the generated client, with no error anywhere.
export * from './admin';
export * from './auth';
export * from './events';
export * from './version';
