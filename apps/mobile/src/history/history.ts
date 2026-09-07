/**
 * The device's memory of events it has opened. It is device-local and never a server query:
 * the list spans many self-hosted origins, so no one of them could assemble it, and asking
 * every stored host would disclose where a person worships to servers that did not ask.
 *
 * Everything here is pure. `store.ts` is what puts it on disk.
 */
export type HistoryEntry = {
  host: string;
  pin: string;
  name: string;
  lastJoinedAt: number;
  pinned: boolean;
  /** Set when opening the event failed. Only the guest ever removes a row (R12). */
  unavailable: boolean;
};

/** A PIN is unique to its server, not to the world: two congregations can share one. */
export type HistoryKey = Pick<HistoryEntry, 'host' | 'pin'>;

export const HISTORY_STORAGE_KEY = 'linguacast-history-v1';

const isSame = (entry: HistoryEntry, key: HistoryKey) =>
  entry.host === key.host && entry.pin === key.pin;

function parseEntry(value: unknown): HistoryEntry | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const row = value as Record<string, unknown>;

  if (typeof row.host !== 'string' || typeof row.pin !== 'string' || row.host === '') {
    return null;
  }

  return {
    host: row.host,
    pin: row.pin,
    name: typeof row.name === 'string' ? row.name : '',
    lastJoinedAt: typeof row.lastJoinedAt === 'number' ? row.lastJoinedAt : 0,
    pinned: row.pinned === true,
    unavailable: row.unavailable === true,
  };
}

/**
 * Field by field and tolerant, in the shape `apps/web/src/lib/audio/volume.ts` uses: a blob
 * this app cannot read must produce an empty list, never a crash on launch.
 */
export function parseHistory(raw: string | null): HistoryEntry[] {
  if (raw === null) {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.map(parseEntry).filter((entry): entry is HistoryEntry => entry !== null);
}

export function serializeHistory(entries: HistoryEntry[]): string {
  return JSON.stringify(entries);
}

export type RememberInput = HistoryKey & {
  name: string;
  at: number;
};

/**
 * The channel a guest chose is deliberately not remembered. A history row opens the event's
 * picker, because the language someone wants is a property of this service rather than of
 * the last one — and a row that jumped straight into a channel would make changing it a
 * back-navigation.
 */

/** Writing an event down is also what clears an earlier failure to reach it (AE2). */
export function remember(entries: HistoryEntry[], input: RememberInput): HistoryEntry[] {
  const existing = entries.find((entry) => isSame(entry, input));

  if (!existing) {
    return [
      ...entries,
      {
        host: input.host,
        pin: input.pin,
        name: input.name,
        lastJoinedAt: input.at,
        pinned: false,
        unavailable: false,
      },
    ];
  }

  return entries.map((entry) =>
    isSame(entry, input)
      ? { ...entry, name: input.name, lastJoinedAt: input.at, unavailable: false }
      : entry,
  );
}

/**
 * A no-op when nothing matches: a scan that fails must not invent a history entry for an
 * event the guest has never successfully opened.
 */
export function markUnavailable(entries: HistoryEntry[], key: HistoryKey): HistoryEntry[] {
  return entries.map((entry) => (isSame(entry, key) ? { ...entry, unavailable: true } : entry));
}

export function setPinned(
  entries: HistoryEntry[],
  key: HistoryKey,
  pinned: boolean,
): HistoryEntry[] {
  return entries.map((entry) => (isSame(entry, key) ? { ...entry, pinned } : entry));
}

/** Puts a removed row back exactly as it was, pin and last-joined date included. */
export function restore(entries: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  return entries.some((existing) => isSame(existing, entry)) ? entries : [...entries, entry];
}

export function remove(entries: HistoryEntry[], key: HistoryKey): HistoryEntry[] {
  return entries.filter((entry) => !isSame(entry, key));
}
