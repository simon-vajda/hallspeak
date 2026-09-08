import { describe, expect, it } from '@jest/globals';
import { systemControls } from './now-playing';

const NAMES = { channelName: 'Magyar', eventName: 'Sunday service' };

describe('systemControls', () => {
  it('shows nothing at all before the guest has asked for audio', () => {
    expect(systemControls({ actionState: 'ready', isPlaying: false, ...NAMES })).toEqual({
      active: false,
      nowPlaying: null,
      playing: false,
    });
  });

  it('shows nothing when there is nothing to listen to', () => {
    expect(
      systemControls({ actionState: 'unavailable', isPlaying: false, ...NAMES }).nowPlaying,
    ).toBe(null);
  });

  it('reports playing once a consumer is open', () => {
    const controls = systemControls({ actionState: 'playing', isPlaying: true, ...NAMES });

    expect(controls.active).toBe(true);
    expect(controls.playing).toBe(true);
  });

  it('reports paused rather than absent while the consumer is still opening', () => {
    const controls = systemControls({ actionState: 'playing', isPlaying: false, ...NAMES });

    expect(controls.nowPlaying).not.toBe(null);
    expect(controls.playing).toBe(false);
  });

  it('keeps the session and reports paused through the playback hold', () => {
    const controls = systemControls({ actionState: 'holding', isPlaying: false, ...NAMES });

    expect(controls.active).toBe(true);
    expect(controls.playing).toBe(false);
  });

  it('carries the channel as the title and the event beneath it, in every state it shows', () => {
    for (const actionState of ['playing', 'holding'] as const) {
      for (const isPlaying of [true, false]) {
        expect(systemControls({ actionState, isPlaying, ...NAMES }).nowPlaying).toEqual({
          title: 'Magyar',
          artist: 'Sunday service',
        });
      }
    }
  });
});
