// Every route MUST be re-exported by name from this barrel: openapi.ts registers
// Object.values(routes) (ADR §5.3), so a route missing from here is silently absent
// from the OpenAPI document — and therefore from openapi.json, api.d.ts, and the
// generated client — with no error anywhere.
export * from './version';
