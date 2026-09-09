import { OpenAPIHono } from '@hono/zod-openapi';
import * as routes from './routes';

/** The server serves this function's output, so it cannot drift from the committed openapi.json. */
export function buildOpenApiDocument(serverVersion: string) {
  const registry = new OpenAPIHono();
  for (const route of Object.values(routes)) {
    registry.openAPIRegistry.registerPath(route);
  }
  // Not getOpenAPIDocument: it emits 3.0-shaped schemas even when handed openapi: '3.1.0'.
  return registry.getOpenAPI31Document({
    openapi: '3.1.0',
    info: { title: 'LinguaCast API', version: serverVersion },
    servers: [{ url: '/api' }],
  });
}
