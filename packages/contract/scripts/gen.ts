import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import serverManifest from '../../../apps/server/package.json' with { type: 'json' };
import { buildOpenApiDocument } from '../src/openapi';

const target = fileURLToPath(new URL('../openapi.json', import.meta.url));

await writeFile(
  target,
  `${JSON.stringify(buildOpenApiDocument(serverManifest.version), null, 2)}\n`,
  'utf8',
);

console.log(`wrote ${target}`);
