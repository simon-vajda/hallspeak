import type { AnchoredHandover } from '@linguacast/client-core/socket';
import { SocketError } from '@linguacast/contract/socket';
import { describe, expect, it } from 'vitest';
import {
  type BroadcastEnd,
  type BroadcastInput,
  broadcastState,
  isBroadcasting,
  isClaimMoved,
  isHandingOver,
  onReconnect,
  preflightAction,
} from './speaker-studio-state';

const base: BroadcastInput = {
  goLivePressed: true,
  hasProducer: true,
  isMuted: false,
  displaced: false,
  handingOver: false,
};

describe('broadcastState', () => {
  it('is pre-flight until Go live is pressed, whatever the producer says', () => {
    expect(broadcastState({ ...base, goLivePressed: false })).toBe('pre-flight');
    expect(broadcastState({ ...base, goLivePressed: false, hasProducer: false })).toBe(
      'pre-flight',
    );
  });

  it('is connecting after the press and before the producer exists', () => {
    expect(broadcastState({ ...base, hasProducer: false })).toBe('connecting');
  });

  it('is live only once a producer exists', () => {
    expect(broadcastState(base)).toBe('live');
    expect(isBroadcasting(broadcastState(base))).toBe(true);
  });

  it('stays out of live while there is no producer, so no copy can overclaim', () => {
    expect(isBroadcasting(broadcastState({ ...base, hasProducer: false }))).toBe(false);
  });

  it('mute does not clear the broadcast, and is not the same state as live', () => {
    const muted = broadcastState({ ...base, isMuted: true });

    expect(muted).toBe('muted');
    expect(isBroadcasting(muted)).toBe(false);
  });

  it('is displaced above everything else, including a live producer', () => {
    expect(broadcastState({ ...base, displaced: true })).toBe('displaced');
    expect(broadcastState({ ...base, displaced: true, hasProducer: false })).toBe('displaced');
  });
});

describe('onReconnect', () => {
  it('re-produces unmuted after an unmuted broadcast drops', () => {
    expect(
      onReconnect({
        goLivePressed: true,
        lastEnd: { reason: 'dropped', muted: false },
        displaced: false,
        handoverKnown: false,
        handover: undefined,
      }),
    ).toEqual({ type: 're-produce', paused: false });
  });

  it('re-produces muted after a muted broadcast drops', () => {
    expect(
      onReconnect({
        goLivePressed: true,
        lastEnd: { reason: 'dropped', muted: true },
        displaced: false,
        handoverKnown: false,
        handover: undefined,
      }),
    ).toEqual({ type: 're-produce', paused: true });
  });

  /**
   * The first Go live has no recorded end, and the producer does not exist yet. Reading
   * that as a drop re-produces paused and mutes the interpreter on the primary path.
   */
  it('does nothing when no drop was recorded, which is the first Go live', () => {
    expect(
      onReconnect({
        goLivePressed: true,
        lastEnd: null,
        displaced: false,
        handoverKnown: false,
        handover: undefined,
      }),
    ).toEqual({
      type: 'none',
    });
  });

  it('does nothing after a deliberate end', () => {
    expect(
      onReconnect({
        goLivePressed: true,
        lastEnd: { reason: 'deliberate' },
        displaced: false,
        handoverKnown: false,
        handover: undefined,
      }),
    ).toEqual({ type: 'none' });
  });

  it('does nothing when Go live was never pressed', () => {
    expect(
      onReconnect({
        goLivePressed: false,
        lastEnd: null,
        displaced: false,
        handoverKnown: false,
        handover: undefined,
      }),
    ).toEqual({
      type: 'none',
    });
  });

  /** The alternation loop the visible takeover exists to prevent. */
  it('never reclaims after being displaced', () => {
    expect(
      onReconnect({
        goLivePressed: true,
        lastEnd: { reason: 'dropped', muted: false },
        displaced: true,
        handoverKnown: false,
        handover: undefined,
      }),
    ).toEqual({ type: 'none' });
  });
});

const held = (over: Partial<AnchoredHandover> = {}): AnchoredHandover => ({
  slug: 'english',
  holder: 'other',
  role: 'bystander',
  pending: false,
  canTakeOver: false,
  expiresAt: null,
  ...over,
});

describe('preflightAction', () => {
  it('offers Go live when nobody holds the claim', () => {
    expect(
      preflightAction({ linkUp: true, handoverKnown: true, handover: held({ holder: 'none' }) }),
    ).toEqual({ type: 'go-live' });
  });

  it('offers Ready to go live when another studio holds it with nothing pending', () => {
    expect(preflightAction({ linkUp: true, handoverKnown: true, handover: held() })).toEqual({
      type: 'ready',
    });
  });

  it('waits, carrying the deadline the server anchored', () => {
    expect(
      preflightAction({
        linkUp: true,
        handoverKnown: true,
        handover: held({ role: 'waiting', pending: true, expiresAt: 1 }),
      }),
    ).toEqual({ type: 'waiting', expiresAt: 1 });
  });

  it('offers the takeover only when the server says so, never on its own clock', () => {
    expect(
      preflightAction({
        linkUp: true,
        handoverKnown: true,
        handover: held({ role: 'waiting', pending: true, expiresAt: 1, canTakeOver: true }),
      }),
    ).toEqual({ type: 'take-over' });
  });

  it('reports a request that belongs to another studio', () => {
    expect(
      preflightAction({
        linkUp: true,
        handoverKnown: true,
        handover: held({ pending: true }),
      }),
    ).toEqual({ type: 'pending-elsewhere' });
  });

  it('goes live once the claim has been granted to this studio', () => {
    expect(
      preflightAction({ linkUp: true, handoverKnown: true, handover: held({ role: 'granted' }) }),
    ).toEqual({ type: 'go-live' });
  });

  /** An unknown reading is not a negative one: it must never collapse to `go-live`. */
  it('withholds while the link is down or the snapshot has not been heard', () => {
    expect(preflightAction({ linkUp: false, handoverKnown: true, handover: held() })).toEqual({
      type: 'unknown',
    });
    expect(preflightAction({ linkUp: true, handoverKnown: false, handover: held() })).toEqual({
      type: 'unknown',
    });
    expect(preflightAction({ linkUp: true, handoverKnown: true, handover: undefined })).toEqual({
      type: 'unknown',
    });
  });
});

describe('isHandingOver', () => {
  it('is the snapshot saying this studio is on its way out', () => {
    expect(
      isHandingOver({
        confirmed: true,
        handoverKnown: true,
        handover: held({ holder: 'self', role: 'handing-over' }),
      }),
    ).toBe(true);
  });

  it('ends when the claim has moved', () => {
    expect(
      isHandingOver({
        confirmed: true,
        handoverKnown: true,
        handover: held({ holder: 'other', role: 'bystander' }),
      }),
    ).toBe(false);
  });

  it('ends when the studio is live again, which is a handover that was called off', () => {
    expect(
      isHandingOver({
        confirmed: true,
        handoverKnown: true,
        handover: held({ holder: 'self', role: 'live' }),
      }),
    ).toBe(false);
  });

  it('holds the press while no snapshot has been heard', () => {
    expect(isHandingOver({ confirmed: true, handoverKnown: false, handover: undefined })).toBe(
      true,
    );
    expect(isHandingOver({ confirmed: false, handoverKnown: false, handover: undefined })).toBe(
      false,
    );
  });
});

describe('broadcastState during a handover', () => {
  it('stays on air and out of live, so nothing overclaims mid-swap', () => {
    const state = broadcastState({ ...base, handingOver: true });

    expect(state).toBe('handing-over');
    expect(isBroadcasting(state)).toBe(false);
  });

  it('does not reach it before the producer exists', () => {
    expect(broadcastState({ ...base, hasProducer: false, handingOver: true })).toBe('connecting');
  });
});

describe('onReconnect with a handover snapshot', () => {
  const dropped: BroadcastEnd = { reason: 'dropped', muted: true };

  it('returns to pre-flight when the claim moved away while this studio was gone', () => {
    expect(
      onReconnect({
        goLivePressed: true,
        lastEnd: dropped,
        displaced: false,
        handoverKnown: true,
        handover: held(),
      }),
    ).toEqual({ type: 'to-pre-flight' });
  });

  it('re-produces in the recorded mute state when this studio still holds the claim', () => {
    expect(
      onReconnect({
        goLivePressed: true,
        lastEnd: dropped,
        displaced: false,
        handoverKnown: true,
        handover: held({ holder: 'self', role: 'live' }),
      }),
    ).toEqual({ type: 're-produce', paused: true });
  });

  it('produces unmuted on a grant, because a handover carries no mute state across', () => {
    expect(
      onReconnect({
        goLivePressed: false,
        lastEnd: dropped,
        displaced: false,
        handoverKnown: true,
        handover: held({ role: 'granted' }),
      }),
    ).toEqual({ type: 're-produce', paused: false });
  });

  it('keeps producing while the swap is in flight', () => {
    expect(
      onReconnect({
        goLivePressed: true,
        lastEnd: dropped,
        displaced: false,
        handoverKnown: true,
        handover: held({ holder: 'self', role: 'handing-over' }),
      }),
    ).toEqual({ type: 're-produce', paused: true });
  });

  it('withholds rather than guessing when the snapshot has not been heard', () => {
    expect(
      onReconnect({
        goLivePressed: true,
        lastEnd: dropped,
        displaced: false,
        handoverKnown: false,
        handover: undefined,
      }),
    ).toEqual({ type: 're-produce', paused: true });
  });
});

describe('isClaimMoved', () => {
  it('recognises the produce refusal that means another studio took the channel', () => {
    expect(isClaimMoved(new SocketError('channel_taken', 'Another interpreter is on air.'))).toBe(
      true,
    );
  });

  it('is not any other socket failure', () => {
    expect(isClaimMoved(new SocketError('not_found', 'No such channel.'))).toBe(false);
    expect(isClaimMoved(new Error('channel_taken'))).toBe(false);
  });
});
