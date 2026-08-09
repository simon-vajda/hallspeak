import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildOpenApiDocument } from '../src/openapi';

const target = fileURLToPath(new URL('../openapi.json', import.meta.url));

await writeFile(target, `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`, 'utf8');

console.log(`wrote ${target}`);
