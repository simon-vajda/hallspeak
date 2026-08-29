import type { types } from 'mediasoup';

/**
 * Silent-failure telemetry. The failure this exists for is the one that reports success
 * everywhere: signalling completes, both screens read connected, and no RTP ever crosses
 * the network — a wrong announced address, a remapped or unforwarded RTC port, a browser
 * shield suppressing ICE candidates. None of those raise an error anywhere, so the only
 * way to see them is to say out loud what ICE and DTLS did and whether bytes moved.
 *
 * Volume is a handful of lines per connection, which is why it is unconditional rather
 * than behind a flag: a flag would be off on the deployment that needed it.
 */

/** Long enough that an ordinary ICE handshake has finished, short enough to still be watching. */
const SILENCE_CHECK_MS = 5_000;

function short(id: string): string {
  return id.slice(0, 8);
}

function describe(tuple: types.TransportTuple): string {
  const remote =
    tuple.remoteIp === undefined ? 'unknown' : `${tuple.remoteIp}:${tuple.remotePort ?? 0}`;
  return `${tuple.protocol} ${tuple.localAddress}:${tuple.localPort} <- ${remote}`;
}

export function watchTransport(
  transport: types.WebRtcTransport,
  eventId: number,
  direction: string,
): void {
  const tag = `media[event ${eventId} ${direction} ${short(transport.id)}]`;
  const candidates = transport.iceCandidates
    .map((candidate) => `${candidate.protocol}/${candidate.address}:${candidate.port}`)
    .join(' ');
  console.log(`${tag} transport created, offering ${candidates || 'no candidates'}`);

  transport.on('icestatechange', (iceState) => {
    const line = `${tag} ice ${iceState}`;
    if (iceState === 'disconnected') {
      console.warn(line);
    } else {
      console.log(line);
    }
  });

  transport.on('iceselectedtuplechange', (tuple) => {
    console.log(`${tag} ice pair ${describe(tuple)}`);
  });

  transport.on('dtlsstatechange', (dtlsState) => {
    const line = `${tag} dtls ${dtlsState}`;
    if (dtlsState === 'failed') {
      console.error(line);
    } else {
      console.log(line);
    }
  });

  // A transport that never reaches connected is the whole failure mode: nothing else in
  // the system will ever say so, because every signalling call it made succeeded.
  const timer = setTimeout(() => {
    if (transport.closed) {
      return;
    }
    if (transport.iceState !== 'connected' && transport.iceState !== 'completed') {
      console.warn(
        `${tag} still ${transport.iceState}/${transport.dtlsState} after ${SILENCE_CHECK_MS}ms — ` +
          'no ICE connectivity. Check PUBLIC_ADDRESS, that the RTC ports are published ' +
          'one-to-one and open on UDP and TCP, and whether the client is suppressing candidates.',
      );
    }
  }, SILENCE_CHECK_MS);
  timer.unref();
  transport.observer.once('close', () => {
    clearTimeout(timer);
    console.log(`${tag} transport closed`);
  });
}

function totalBytes(stats: Array<{ type: string; byteCount: number }>, type: string): number {
  return stats.filter((stat) => stat.type === type).reduce((sum, stat) => sum + stat.byteCount, 0);
}

/** ICE can be up and the media path still dead; bytes are the only proof audio moved. */
export function watchProducer(producer: types.Producer, eventId: number, slug: string): void {
  const tag = `media[event ${eventId} ${slug} producer ${short(producer.id)}]`;
  console.log(`${tag} opened${producer.paused ? ' (paused)' : ''}`);

  const timer = setTimeout(() => {
    if (producer.closed) {
      return;
    }
    void producer
      .getStats()
      .then((stats) => {
        const bytes = totalBytes(stats, 'inbound-rtp');
        if (bytes === 0) {
          console.warn(
            `${tag} no RTP received after ${SILENCE_CHECK_MS}ms — the speaker is connected but ` +
              'sending nothing that reaches this server.',
          );
        } else {
          console.log(`${tag} receiving RTP (${bytes} bytes)`);
        }
      })
      .catch(() => {});
  }, SILENCE_CHECK_MS);
  timer.unref();
  producer.observer.once('close', () => {
    clearTimeout(timer);
    console.log(`${tag} closed`);
  });
}

export function watchConsumer(consumer: types.Consumer, eventId: number, slug: string): void {
  const tag = `media[event ${eventId} ${slug} consumer ${short(consumer.id)}]`;

  const timer = setTimeout(() => {
    if (consumer.closed || consumer.paused) {
      return;
    }
    void consumer
      .getStats()
      .then((stats) => {
        const bytes = totalBytes(stats, 'outbound-rtp');
        if (bytes === 0) {
          console.warn(`${tag} no RTP sent after ${SILENCE_CHECK_MS}ms.`);
        } else {
          console.log(`${tag} sending RTP (${bytes} bytes)`);
        }
      })
      .catch(() => {});
  }, SILENCE_CHECK_MS);
  timer.unref();
  consumer.observer.once('close', () => clearTimeout(timer));
}
