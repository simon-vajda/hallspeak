import { join } from 'node:path';
import { env } from '../env';
import { createDb } from './client';

// Importing this module opens a file and creates a directory. Anything that does not want
// the process-wide database must import ./client instead.
export const db = createDb(join(env.DATA_DIR, 'hallspeak.db'));

export function closeDb(): void {
  db.$client.close();
}
