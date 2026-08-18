import { describe, expect, it } from 'vitest';
import {
  afterConnect,
  beginRebuild,
  consumerClosed,
  consumerOpened,
  initialMediaState,
  isCurrent,
  type MediaState,
  needsRebuild,
  onProducerChange,
  producerOpened,
  switchChannel,
  transportId,
  transportOpened,
} from './media-state';

const live: MediaState = {
  generation: 3,
  deviceLoaded: true,
  sendTransportId: 'send-1',
  recvTransportId: 'recv-1',
  producerId: 'p1',
  consumers: { english: 'c1' },
  rebuilding: null,
};

describe('afterConnect', () => {
  it('discards every identifier, first connection or not', () => {
    expect(afterConnect(live)).toEqual({ ...initialMediaState, generation: 4 });
    expect(afterConnect(initialMediaState)).toEqual({ ...initialMediaState, generation: 1 });
  });

  it('moves the generation on, so a reply in flight is no longer current', () => {
    const before = live.generation;
    const after = afterConnect(live);

    expect(isCurrent(after, before)).toBe(false);
    expect(isCurrent(after, after.generation)).toBe(true);
  });
});

describe('needsRebuild', () => {
  it('rebuilds on failed', () => {
    expect(needsRebuild('failed')).toBe(true);
  });

  it('does not rebuild on a disconnected blip that recovers on its own', () => {
    expect(needsRebuild('disconnected')).toBe(false);
    expect(needsRebuild('connected')).toBe(false);
    expect(needsRebuild('connecting')).toBe(false);
    expect(needsRebuild('new')).toBe(false);
    expect(needsRebuild('closed')).toBe(false);
  });
});

describe('beginRebuild', () => {
  it('drops the send transport and its producer, leaving the receive side alone', () => {
    const rebuilding = beginRebuild(live, 'send');

    expect(rebuilding.sendTransportId).toBeNull();
    expect(rebuilding.producerId).toBeNull();
    expect(rebuilding.recvTransportId).toBe('recv-1');
    expect(rebuilding.consumers).toEqual({ english: 'c1' });
    expect(rebuilding.rebuilding).toBe('send');
  });

  it('drops the receive transport and its consumers, leaving the send side alone', () => {
    const rebuilding = beginRebuild(live, 'recv');

    expect(rebuilding.recvTransportId).toBeNull();
    expect(rebuilding.consumers).toEqual({});
    expect(rebuilding.sendTransportId).toBe('send-1');
    expect(rebuilding.producerId).toBe('p1');
  });

  it('lets a connect arriving during the rebuild supersede it', () => {
    const rebuilding = beginRebuild(live, 'recv');
    const reconnected = afterConnect(rebuilding);

    // The rebuild's own reply is now stale and must be discarded rather than adopted.
    expect(isCurrent(reconnected, rebuilding.generation)).toBe(false);
    expect(reconnected.rebuilding).toBeNull();
  });

  it('clears the rebuilding flag when that direction’s transport comes back', () => {
    const rebuilding = beginRebuild(live, 'recv');
    const opened = transportOpened(rebuilding, 'recv', 'recv-2');

    expect(opened.rebuilding).toBeNull();
    expect(transportId(opened, 'recv')).toBe('recv-2');
  });

  it('leaves a rebuild in the other direction pending', () => {
    const rebuilding = beginRebuild(live, 'send');
    const opened = transportOpened(rebuilding, 'recv', 'recv-2');

    expect(opened.rebuilding).toBe('send');
  });
});

describe('switchChannel', () => {
  it('closes the current consumer then opens one for the new channel', () => {
    expect(switchChannel(live, 'english', 'spanish')).toEqual({
      type: 'close-consumer-then-consume',
      consumerId: 'c1',
      slug: 'spanish',
    });
  });

  it('never asks for a transport rebuild', () => {
    const action = switchChannel(live, 'english', 'spanish');

    expect(JSON.stringify(action)).not.toContain('transport');
  });

  it('just consumes when nothing is open yet', () => {
    expect(switchChannel(initialMediaState, null, 'english')).toEqual({
      type: 'consume',
      slug: 'english',
    });
  });

  it('does nothing when the channel is already the one playing', () => {
    expect(switchChannel(live, 'english', 'english')).toEqual({ type: 'none' });
  });

  it('consumes when the same channel is asked for but nothing is open', () => {
    expect(switchChannel(initialMediaState, 'english', 'english')).toEqual({
      type: 'consume',
      slug: 'english',
    });
  });
});

describe('onProducerChange', () => {
  it('does nothing at all while the guest has not armed', () => {
    expect(onProducerChange(initialMediaState, { armedSlug: null, online: true })).toEqual({
      type: 'none',
    });
  });

  it('consumes when a producer appears on the armed channel', () => {
    expect(onProducerChange(initialMediaState, { armedSlug: 'english', online: true })).toEqual({
      type: 'consume',
      slug: 'english',
    });
  });

  it('does not consume twice when one is already open', () => {
    expect(onProducerChange(live, { armedSlug: 'english', online: true })).toEqual({
      type: 'none',
    });
  });

  it('closes the consumer when the interpreter goes away, and stays armed', () => {
    expect(onProducerChange(live, { armedSlug: 'english', online: false })).toEqual({
      type: 'close-consumer',
      consumerId: 'c1',
    });
  });

  it('does nothing when the interpreter goes away and nothing was open', () => {
    expect(onProducerChange(initialMediaState, { armedSlug: 'english', online: false })).toEqual({
      type: 'none',
    });
  });
});

describe('consumer bookkeeping', () => {
  it('records and forgets a consumer by slug', () => {
    const opened = consumerOpened(initialMediaState, 'english', 'c9');
    expect(opened.consumers).toEqual({ english: 'c9' });

    expect(consumerClosed(opened, 'english').consumers).toEqual({});
  });

  it('forgetting a slug that is not there leaves the rest alone', () => {
    expect(consumerClosed(live, 'spanish').consumers).toEqual({ english: 'c1' });
  });

  it('tracks the producer id independently of the consumers', () => {
    const withProducer = producerOpened(initialMediaState, 'p9');

    expect(withProducer.producerId).toBe('p9');
    expect(withProducer.consumers).toEqual({});
  });
});
