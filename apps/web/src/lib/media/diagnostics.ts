import type { types } from 'mediasoup-client';
import { ICE_RECOVERY_DELAY_MS } from './media-state';

/**
 * The browser half of the silent-failure telemetry the server carries in
 * `core/media/diagnostics.ts`. The failure worth naming is the one where every signalling
 * call succeeds and no audio ever moves — suppressed ICE candidates (a shield or a privacy
 * extension), an unreachable announced address, a blocked RTC port. Nothing throws for any
 * of them, so the console is the only place it can be seen.
 */

function log(message: string, ...rest: unknown[]): void {
  console.info(`media: ${message}`, ...rest);
}

export function watchTransport(transport: types.Transport, direction: 'send' | 'recv'): void {
  const tag = `${direction} transport`;
  log(`${tag} created`);

  transport.on('icegatheringstatechange', (gathering) => log(`${tag} ice gathering ${gathering}`));

  transport.on('icecandidateerror', (event) => {
    console.warn(`media: ${tag} ice candidate error`, event.errorCode, event.errorText, event.url);
  });

  transport.on('connectionstatechange', (next) => {
    if (next === 'failed' || next === 'disconnected') {
      console.warn(`media: ${tag} connection ${next}`);
    } else {
      log(`${tag} connection ${next}`);
    }
  });

  // A transport stuck short of connected is the whole failure mode; the selected pair is
  // what says which path won, and its absence is what says none did.
  window.setTimeout(() => {
    if (transport.closed) {
      return;
    }
    void reportPath(transport, tag);
  }, ICE_RECOVERY_DELAY_MS);
}

/** Names a recovery step as it happens; without it a stuck transport leaves no trace of what was tried. */
export function logIceRecovery(
  direction: 'send' | 'recv',
  message: string,
  ...rest: unknown[]
): void {
  log(`${direction} transport ${message}`, ...rest);
}

/** The same snapshot the creation deadline takes, for a caller that has just tried a recovery. */
export function reportTransportPath(
  transport: types.Transport,
  direction: 'send' | 'recv',
): Promise<void> {
  return reportPath(transport, `${direction} transport`);
}

async function reportPath(transport: types.Transport, tag: string): Promise<void> {
  const report = await transport.getStats().catch(() => null);
  if (!report) {
    return;
  }

  let bytes = 0;
  let pair: string | null = null;
  for (const entry of report.values()) {
    if (entry.type === 'outbound-rtp') {
      bytes += Number(entry.bytesSent ?? 0);
    }
    if (entry.type === 'inbound-rtp') {
      bytes += Number(entry.bytesReceived ?? 0);
    }
    if (entry.type === 'candidate-pair' && entry.state === 'succeeded' && entry.nominated) {
      pair = `${entry.localCandidateId} -> ${entry.remoteCandidateId}`;
    }
  }

  if (pair === null) {
    console.warn(
      `media: ${tag} has no nominated candidate pair after ${ICE_RECOVERY_DELAY_MS}ms — ` +
        'ICE never connected. A browser shield or privacy extension suppressing WebRTC ' +
        'candidates, or a blocked RTC port, both look exactly like this.',
      describeCandidates(report),
    );
    return;
  }
  if (bytes === 0) {
    console.warn(`media: ${tag} connected on ${pair} but no RTP has moved.`);
    return;
  }
  log(`${tag} carrying RTP on ${pair} (${bytes} bytes)`);
}

/**
 * What ICE had to work with. A handoff that leaves the browser gathering on an interface
 * that is already gone reads as no local candidates at all, which is indistinguishable
 * from a suppressed-candidate shield until the two sides are counted separately.
 */
function describeCandidates(report: RTCStatsReport): string {
  const local: string[] = [];
  const remote: string[] = [];
  const pairs: string[] = [];
  for (const entry of report.values()) {
    if (entry.type === 'local-candidate' || entry.type === 'remote-candidate') {
      const where = `${entry.candidateType}/${entry.protocol} ${entry.address ?? '?'}:${entry.port ?? '?'}`;
      (entry.type === 'local-candidate' ? local : remote).push(
        entry.networkType === undefined ? where : `${where} (${entry.networkType})`,
      );
    }
    if (entry.type === 'candidate-pair') {
      pairs.push(String(entry.state));
    }
  }
  // Joined rather than returned as arrays: a mobile console collapses an object, and these
  // strings are the whole diagnosis — an address family that cannot pair reads as nothing
  // at all until the candidates themselves are on screen.
  return (
    `local [${local.join(', ') || 'none'}] ` +
    `remote [${remote.join(', ') || 'none'}] ` +
    `pairs [${pairs.join(', ') || 'none'}]`
  );
}

/** A receive track that never unmutes is the listener-side symptom of RTP not arriving. */
export function watchConsumerTrack(track: MediaStreamTrack, slug: string): void {
  log(`consumer track for ${slug} ${track.muted ? 'muted' : 'live'}`);
  track.addEventListener('unmute', () =>
    log(`consumer track for ${slug} unmuted — audio arriving`),
  );
  track.addEventListener('mute', () => console.warn(`media: consumer track for ${slug} muted`));
  track.addEventListener('ended', () => console.warn(`media: consumer track for ${slug} ended`));
}
