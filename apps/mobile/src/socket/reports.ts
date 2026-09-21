import type { SentMap } from '@hallspeak/client-core/channel';
import type { SocketClient } from '@hallspeak/client-core/socket';
import type { ReportCategory } from '@hallspeak/contract/socket';
import { unwrap } from '@hallspeak/contract/socket';

export type ReportOutcome = { ok: true } | { ok: false; message: string };

export interface ChannelReports {
  /** When each category was last accepted, which is what the sheet's own disable reads. */
  sent: SentMap;
  /** This connection has a problem reported and not yet said to be fixed. */
  open: boolean;
  send: (slug: string, category: ReportCategory) => Promise<ReportOutcome>;
  resolve: (slug: string) => Promise<ReportOutcome>;
}

const NO_CONNECTION: ReportOutcome = { ok: false, message: 'No connection.' };

/**
 * Every guard is the server's — room membership, a producer existing, and the cooldown — so
 * the refusal a row shows is the server's own reason rather than one invented here. The
 * sheet's two-minute disable is a courtesy on top of it, not the rule.
 */
export async function sendReport(
  socket: SocketClient | null,
  slug: string,
  category: ReportCategory,
): Promise<ReportOutcome> {
  if (!socket) {
    return NO_CONNECTION;
  }

  try {
    unwrap(await socket.emitWithAck('channel:report', { slug, category }));
    return { ok: true };
  } catch (cause) {
    return { ok: false, message: refusal(cause) };
  }
}

export async function resolveReports(
  socket: SocketClient | null,
  slug: string,
): Promise<ReportOutcome> {
  if (!socket) {
    return NO_CONNECTION;
  }

  try {
    unwrap(await socket.emitWithAck('channel:resolve-reports', { slug }));
    return { ok: true };
  } catch (cause) {
    return { ok: false, message: refusal(cause) };
  }
}

function refusal(cause: unknown): string {
  return cause instanceof Error && cause.message !== '' ? cause.message : 'That did not send.';
}
