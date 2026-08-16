/** better-sqlite3 surfaces constraint failures as SQLITE_CONSTRAINT_* on `code`. */
export function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Error &&
    'code' in err &&
    typeof err.code === 'string' &&
    err.code.startsWith('SQLITE_CONSTRAINT')
  );
}
