import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { Peer } from './peer';

function fakeTransport(id = 't1') {
  return { id, closed: false, close: vi.fn() };
}

function fakeConsumer(id = 'c1') {
  const observer = new EventEmitter();
  const consumer = {
    id,
    closed: false,
    observer,
    close: vi.fn(() => {
      consumer.closed = true;
      observer.emit('close');
    }),
  };
  return consumer;
}

// biome-ignore lint/suspicious/noExplicitAny: the fakes stand in for mediasoup's types.
const asTransport = (t: unknown) => t as any;

describe('Peer transports', () => {
  it('holds one send and one receive transport', () => {
    const peer = new Peer('socket-1');
    const send = fakeTransport('send-1');
    const recv = fakeTransport('recv-1');

    peer.addTransport('send', asTransport(send));
    peer.addTransport('recv', asTransport(recv));

    expect(peer.transport('send')?.id).toBe('send-1');
    expect(peer.transport('recv')?.id).toBe('recv-1');
  });

  it('refuses a second send transport with a distinct code', () => {
    const peer = new Peer('socket-1');
    peer.addTransport('send', asTransport(fakeTransport('send-1')));

    expect(() => peer.addTransport('send', asTransport(fakeTransport('send-2')))).toThrow(
      expect.objectContaining({ code: 'transport_exists' }),
    );
  });

  it('refuses a second receive transport too', () => {
    const peer = new Peer('socket-1');
    peer.addTransport('recv', asTransport(fakeTransport('recv-1')));

    expect(() => peer.addTransport('recv', asTransport(fakeTransport('recv-2')))).toThrow(
      expect.objectContaining({ code: 'transport_exists' }),
    );
  });

  it('finds a transport by id, and returns nothing for an unknown one', () => {
    const peer = new Peer('socket-1');
    peer.addTransport('send', asTransport(fakeTransport('send-1')));

    expect(peer.transportById('send-1')?.id).toBe('send-1');
    expect(peer.transportById('nope')).toBeUndefined();
  });

  it('reports whether it holds any media at all', () => {
    const peer = new Peer('socket-1');
    expect(peer.isEmpty).toBe(true);
    peer.addTransport('recv', asTransport(fakeTransport()));
    expect(peer.isEmpty).toBe(false);
  });
});

describe('Peer consumers', () => {
  it('tracks a consumer and finds it by id', () => {
    const peer = new Peer('socket-1');
    const consumer = fakeConsumer('c1');
    peer.addConsumer(asTransport(consumer));

    expect(peer.consumerById('c1')).toBeDefined();
    expect(peer.consumerById('other')).toBeUndefined();
  });

  it('closes and forgets one consumer without touching the others', () => {
    const peer = new Peer('socket-1');
    const first = fakeConsumer('c1');
    const second = fakeConsumer('c2');
    peer.addConsumer(asTransport(first));
    peer.addConsumer(asTransport(second));

    peer.closeConsumer('c1');

    expect(first.close).toHaveBeenCalledTimes(1);
    expect(second.close).not.toHaveBeenCalled();
    expect(peer.consumerById('c1')).toBeUndefined();
  });

  it('closing an unknown consumer is a no-op rather than a throw', () => {
    const peer = new Peer('socket-1');
    expect(() => peer.closeConsumer('nope')).not.toThrow();
  });

  /**
   * mediasoup closes a consumer on its own when its producer closes, which is what
   * happens to every listener the moment a speaker ends a broadcast.
   */
  it('forgets a consumer that closes on its own, without being told', () => {
    const peer = new Peer('socket-1');
    const consumer = fakeConsumer('c1');
    peer.addConsumer(asTransport(consumer));

    consumer.close();

    expect(peer.consumerById('c1')).toBeUndefined();
    expect(peer.isEmpty).toBe(true);
  });

  it('does not let a stale close evict the consumer that replaced it', () => {
    const peer = new Peer('socket-1');
    const first = fakeConsumer('c1');
    peer.addConsumer(asTransport(first));
    peer.closeConsumer('c1');

    const second = fakeConsumer('c1');
    peer.addConsumer(asTransport(second));
    first.observer.emit('close');

    expect(peer.consumerById('c1')).toBeDefined();
  });
});

describe('Peer.close', () => {
  it('closes every transport and consumer through the one path', () => {
    const peer = new Peer('socket-1');
    const send = fakeTransport('send-1');
    const recv = fakeTransport('recv-1');
    const consumer = fakeConsumer('c1');
    peer.addTransport('send', asTransport(send));
    peer.addTransport('recv', asTransport(recv));
    peer.addConsumer(asTransport(consumer));

    peer.close();

    expect(send.close).toHaveBeenCalledTimes(1);
    expect(recv.close).toHaveBeenCalledTimes(1);
    expect(consumer.close).toHaveBeenCalledTimes(1);
    expect(peer.isEmpty).toBe(true);
  });

  it('is a no-op the second time', () => {
    const peer = new Peer('socket-1');
    const send = fakeTransport('send-1');
    peer.addTransport('send', asTransport(send));

    peer.close();
    peer.close();

    expect(send.close).toHaveBeenCalledTimes(1);
  });

  it('refuses a transport after closing rather than resurrecting the peer', () => {
    const peer = new Peer('socket-1');
    peer.close();

    expect(() => peer.addTransport('send', asTransport(fakeTransport()))).toThrow(
      expect.objectContaining({ code: 'peer_closed' }),
    );
  });
});
