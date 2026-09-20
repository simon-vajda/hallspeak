import type { types } from 'mediasoup';
import { logger } from '../../lib/log';

/**
 * Silent-failure telemetry, spread across the levels.
 *
 * The failure this exists for is the one that reports success everywhere: signalling
 * completes, both screens read connected, and no RTP ever crosses the network — a wrong
 * announced address, a remapped or unforwarded RTC port, a browser shield suppressing ICE
 * candidates. None of those raise an error anywhere, so the only way to see them is to
 * check whether ICE connected and whether bytes moved, and say so when they did not.
 *
 * Those three checks are `warn`: they are what a support ticket is diagnosed from, and
 * their cost is one record per failure rather than per connection. The narration around
 * them — transport lifecycle, ICE and DTLS progress — is `debug`, because a
 * hundred-listener event would otherwise bury every record that matters under a thousand
 * that do not. The addresses that name the person at the other end are `trace`, one level
 * further down, because turning them on writes them to disk for the retention window.
 */

const log = logger('media');

/** Long enough that an ordinary ICE handshake has finished, short enough to still be watching. */
const SILENCE_CHECK_MS = 5_000;

/** Enough to tell two transports of the same shape apart, and short enough to read. */
function short(id: string): string {
  return id.slice(0, 8);
}

function tupleFields(tuple: types.TransportTuple): Record<string, unknown> {
  return {
    protocol: tuple.protocol,
    localAddress: tuple.localAddress,
    localPort: tuple.localPort,
    remoteAddress: tuple.remoteIp,
    remotePort: tuple.remotePort,
  };
}

export function watchTransport(
  transport: types.WebRtcTransport,
  eventId: number,
  direction: string,
): void {
  // A transport belongs to an event and a direction; there is one router per event, so it
  // has no channel to name. The identifier that distinguishes two transports of the same
  // shape is exactly what a record above `debug` must not carry.
  const subject = { eventId, direction };
  const tagged = { ...subject, transportId: short(transport.id) };

  log.debug({ ...tagged, candidateCount: transport.iceCandidates.length }, 'transport created');
  for (const candidate of transport.iceCandidates) {
    log.trace(
      {
        ...tagged,
        protocol: candidate.protocol,
        address: candidate.address,
        port: candidate.port,
      },
      'candidate offered',
    );
  }

  transport.on('icestatechange', (iceState) => {
    log.debug({ ...tagged, iceState }, 'ice state changed');
  });

  transport.on('iceselectedtuplechange', (tuple) => {
    log.trace({ ...tagged, ...tupleFields(tuple) }, 'ice pair selected');
  });

  transport.on('dtlsstatechange', (dtlsState) => {
    log.debug({ ...tagged, dtlsState }, 'dtls state changed');
  });

  // A transport that never reaches connected is the whole failure mode: nothing else in
  // the system will ever say so, because every signalling call it made succeeded.
  const timer = setTimeout(() => {
    if (transport.closed) {
      return;
    }
    if (transport.iceState !== 'connected' && transport.iceState !== 'completed') {
      log.warn(
        {
          ...subject,
          iceState: transport.iceState,
          dtlsState: transport.dtlsState,
          afterMs: SILENCE_CHECK_MS,
        },
        'no ICE connectivity: check PUBLIC_ADDRESS, that the RTC ports are published ' +
          'one-to-one and open on UDP and TCP, and whether the client is suppressing candidates',
      );
    }
  }, SILENCE_CHECK_MS);
  timer.unref();
  transport.observer.once('close', () => {
    clearTimeout(timer);
    log.debug(tagged, 'transport closed');
  });
}

function totalBytes(stats: Array<{ type: string; byteCount: number }>, type: string): number {
  return stats.filter((stat) => stat.type === type).reduce((sum, stat) => sum + stat.byteCount, 0);
}

/** ICE can be up and the media path still dead; bytes are the only proof audio moved. */
export function watchProducer(producer: types.Producer, eventId: number, slug: string): void {
  const subject = { eventId, slug };
  const tagged = { ...subject, producerId: short(producer.id) };
  log.debug({ ...tagged, paused: producer.paused }, 'producer opened');

  const timer = setTimeout(() => {
    if (producer.closed) {
      return;
    }
    void producer
      .getStats()
      .then((stats) => {
        const bytes = totalBytes(stats, 'inbound-rtp');
        if (bytes === 0) {
          log.warn(
            { ...subject, afterMs: SILENCE_CHECK_MS },
            'no RTP received: the speaker is connected but sending nothing that reaches this server',
          );
        } else {
          log.debug({ ...tagged, bytes }, 'producer receiving RTP');
        }
      })
      .catch(() => {});
  }, SILENCE_CHECK_MS);
  timer.unref();
  producer.observer.once('close', () => {
    clearTimeout(timer);
    log.debug(tagged, 'producer closed');
  });
}

export function watchConsumer(consumer: types.Consumer, eventId: number, slug: string): void {
  const subject = { eventId, slug };
  const tagged = { ...subject, consumerId: short(consumer.id) };

  const timer = setTimeout(() => {
    if (consumer.closed || consumer.paused) {
      return;
    }
    void consumer
      .getStats()
      .then((stats) => {
        const bytes = totalBytes(stats, 'outbound-rtp');
        if (bytes === 0) {
          log.warn({ ...subject, afterMs: SILENCE_CHECK_MS }, 'no RTP sent');
        } else {
          log.debug({ ...tagged, bytes }, 'consumer sending RTP');
        }
      })
      .catch(() => {});
  }, SILENCE_CHECK_MS);
  timer.unref();
  consumer.observer.once('close', () => clearTimeout(timer));
}
