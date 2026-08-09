import { OpenAPIHono } from '@hono/zod-openapi';
import * as routes from './routes';

/**
 * Builds the OpenAPI document from the route registry alone — no running server.
 * The server serves this same function's output at /api/openapi.json, so the served
 * document cannot drift from the committed openapi.json.
 */
export function buildOpenApiDocument() {
  const registry = new OpenAPIHono();
  for (const route of Object.values(routes)) {
    registry.openAPIRegistry.registerPath(route);
  }
  // getOpenAPI31Document, not getOpenAPIDocument: the latter is the OpenAPI 3.0
  // generator and emits 3.0-shaped schemas even when handed openapi: '3.1.0'.
  return registry.getOpenAPI31Document({
    openapi: '3.1.0',
    info: { title: 'LinguaCast API', version: '1.0.0' },
    servers: [{ url: '/api' }],
  });
}
