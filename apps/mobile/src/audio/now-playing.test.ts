import { describe, expect, it } from '@jest/globals';
import { systemControls } from './now-playing';

const NAMES = { channelName: 'Magyar', eventName: 'Sunday service' };

describe('systemControls', () => {
  it('shows nothing at all before the guest has asked for audio', () => {
    expect(
      systemControls({ listening: false, actionState: 'ready', isPlaying: false, ...NAMES }),
    ).toEqual({
      active: false,
      nowPlaying: null,
      playing: false,
    });
  });

  it('shows nothing when there is nothing to listen to', () => {
    expect(
      systemControls({ listening: false, actionState: 'unavailable', isPlaying: false, ...NAMES })
        .nowPlaying,
    ).toBe(null);
  });

  it('reports playing once a consumer is open', () => {
    const controls = systemControls({
      listening: true,
      actionState: 'playing',
      isPlaying: true,
      ...NAMES,
    });

    expect(controls.active).toBe(true);
    expect(controls.playing).toBe(true);
  });

  it('reports paused rather than absent while the consumer is still opening', () => {
    const controls = systemControls({
      listening: true,
      actionState: 'ready',
      isPlaying: false,
      ...NAMES,
    });

    expect(controls.nowPlaying).not.toBe(null);
    expect(controls.playing).toBe(false);
  });

  // The service Android will not let this app start again from the background must not be
  // stopped by a socket blip the guest never asked for.
  it('keeps the session through a dropped link, reporting paused rather than withdrawing', () => {
    const controls = systemControls({
      listening: true,
      actionState: 'unavailable',
      isPlaying: false,
      ...NAMES,
    });

    expect(controls.active).toBe(true);
    expect(controls.nowPlaying).not.toBe(null);
    expect(controls.playing).toBe(false);
  });

  it('keeps the session and reports paused through the playback hold', () => {
    const controls = systemControls({
      listening: true,
      actionState: 'holding',
      isPlaying: false,
      ...NAMES,
    });

    expect(controls.active).toBe(true);
    expect(controls.playing).toBe(false);
  });

  it('carries the channel as the title and the event beneath it, in every state it shows', () => {
    for (const actionState of ['unavailable', 'ready', 'playing', 'holding'] as const) {
      for (const isPlaying of [true, false]) {
        expect(
          systemControls({ listening: true, actionState, isPlaying, ...NAMES }).nowPlaying,
        ).toEqual({
          title: 'Magyar',
          artist: 'Sunday service',
        });
      }
    }
  });
});
