import type { StatsSample } from '@linguacast/client-core/media';

interface ReportEntry {
  type?: unknown;
  [field: string]: unknown;
}

/**
 * The one report entry a listener grades from. `remote-inbound-rtp` is deliberately not
 * accepted: it describes what the far side received from us, and a listener sends nothing,
 * so a shell that took it would be grading a stream that does not exist.
 *
 * Separated from the shell so the choice is testable without a peer connection.
 */
export function inboundEntry(report: Iterable<ReportEntry>): StatsSample | undefined {
  for (const entry of report) {
    if (entry.type === 'inbound-rtp') {
      return entry as StatsSample;
    }
  }

  return undefined;
}
