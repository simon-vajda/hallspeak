import { env } from '../env';
import { createDb } from './client';

// Importing this module opens a file and creates a directory. Anything that does not want
// the process-wide database must import ./client instead.
export const db = createDb(env.DATABASE_PATH);

export function closeDb(): void {
  db.$client.close();
}
