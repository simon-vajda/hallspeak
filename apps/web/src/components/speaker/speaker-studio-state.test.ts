import { describe, expect, it } from 'vitest';
import {
  type BroadcastInput,
  broadcastState,
  isBroadcasting,
  onReconnect,
} from './speaker-studio-state';

const base: BroadcastInput = {
  goLivePressed: true,
  hasProducer: true,
  isMuted: false,
  displaced: false,
  recoveredSilently: false,
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

  it('tells back-from-drop apart from a mute the interpreter chose', () => {
    const recovered = broadcastState({ ...base, isMuted: true, recoveredSilently: true });

    expect(recovered).toBe('back-from-drop');
    expect(recovered).not.toBe(broadcastState({ ...base, isMuted: true }));
  });

  it('is displaced above everything else, including a live producer', () => {
    expect(broadcastState({ ...base, displaced: true })).toBe('displaced');
    expect(broadcastState({ ...base, displaced: true, hasProducer: false })).toBe('displaced');
  });
});

describe('onReconnect', () => {
  it('re-produces paused after an involuntary drop', () => {
    expect(onReconnect({ goLivePressed: true, lastEnd: 'dropped', displaced: false })).toEqual({
      type: 're-produce',
      paused: true,
    });
  });

  /**
   * The first Go live has no recorded end, and the producer does not exist yet. Reading
   * that as a drop re-produces paused and mutes the interpreter on the primary path.
   */
  it('does nothing when no drop was recorded, which is the first Go live', () => {
    expect(onReconnect({ goLivePressed: true, lastEnd: null, displaced: false })).toEqual({
      type: 'none',
    });
  });

  it('does nothing after a deliberate end', () => {
    expect(onReconnect({ goLivePressed: true, lastEnd: 'deliberate', displaced: false })).toEqual({
      type: 'none',
    });
  });

  it('does nothing when Go live was never pressed', () => {
    expect(onReconnect({ goLivePressed: false, lastEnd: null, displaced: false })).toEqual({
      type: 'none',
    });
  });

  /** The alternation loop the visible takeover exists to prevent. */
  it('never reclaims after being displaced', () => {
    expect(onReconnect({ goLivePressed: true, lastEnd: 'dropped', displaced: true })).toEqual({
      type: 'none',
    });
  });
});
