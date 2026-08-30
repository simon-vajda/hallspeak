import { describe, expect, it } from 'vitest';
import {
  badgeLabel,
  HOLD_MS,
  type ListenInput,
  listenActionState,
  listenState,
  playTargetLabel,
  reconcileListenIntent,
  showsRings,
  statusNote,
} from './listen-state';

const ALL_STATES = [
  'idle',
  'waiting',
  'playing',
  'syncing',
  'muted',
  'interpreter-away',
  'reconnecting',
  'media-trouble',
  'ended',
] as const;

const playing: ListenInput = {
  armed: true,
  isPlaying: true,
  live: true,
  muted: false,
  socketConnected: true,
  mediaTrouble: false,
};

describe('listenState', () => {
  it('is idle until the guest arms', () => {
    expect(listenState({ ...playing, armed: false })).toBe('idle');
    expect(listenState({ ...playing, armed: false, live: false })).toBe('idle');
  });

  it('is waiting once armed but before a consumer is resumed', () => {
    expect(listenState({ ...playing, isPlaying: false })).toBe('waiting');
  });

  it('is playing only when a resumed consumer exists', () => {
    expect(listenState(playing)).toBe('playing');
  });

  it('identifies a muted online interpreter before and after the guest arms', () => {
    expect(listenState({ ...playing, armed: false, isPlaying: false, muted: true })).toBe('muted');
    expect(listenState({ ...playing, muted: true })).toBe('muted');
    expect(badgeLabel('muted')).toMatch(/muted/i);
    expect(statusNote('muted')).toMatch(/automatically/i);
    expect(showsRings('muted')).toBe(false);
  });

  it('does not claim unmuted while an online HTTP seed awaits socket reconciliation', () => {
    const syncing = listenState({ ...playing, muted: null });

    expect(syncing).toBe('syncing');
    expect(badgeLabel(syncing)).not.toMatch(/on air|listening/i);
    expect(showsRings(syncing)).toBe(false);
  });

  it('stays armed and reads as the interpreter being away when they drop', () => {
    expect(listenState({ ...playing, live: false, isPlaying: false })).toBe('interpreter-away');
  });

  it('tells media trouble apart from the interpreter being away', () => {
    const trouble = listenState({ ...playing, mediaTrouble: true });

    expect(trouble).toBe('media-trouble');
    expect(trouble).not.toBe(listenState({ ...playing, live: false }));
  });

  it('keeps terminal, socket, media trouble and offline ahead of stale muted status', () => {
    expect(listenState({ ...playing, muted: true, terminal: true })).toBe('ended');
    expect(listenState({ ...playing, muted: true, socketConnected: false })).toBe('reconnecting');
    expect(listenState({ ...playing, muted: true, mediaTrouble: true })).toBe('media-trouble');
    expect(listenState({ ...playing, muted: true, live: false })).toBe('interpreter-away');
  });

  it('tells a lost socket apart from a failed media path', () => {
    const socketDown = listenState({ ...playing, socketConnected: false });
    const mediaDown = listenState({ ...playing, mediaTrouble: true });

    expect(socketDown).toBe('reconnecting');
    expect(socketDown).not.toBe(mediaDown);
  });

  it('does not report trouble merely because nobody is live', () => {
    expect(listenState({ ...playing, live: false, isPlaying: false })).not.toBe('media-trouble');
  });
});

describe('bounded playback intent', () => {
  const now = 1_000_000;
  const idle = { intent: 'idle', holdDeadline: null } as const;
  const playingIntent = { intent: 'playing', holdDeadline: null } as const;

  it('disables the Listen target while no producer exists', () => {
    const action = listenActionState({
      ...idle,
      live: false,
      isPlaying: false,
      linkConnected: true,
      now,
    });

    expect(action).toBe('unavailable');
    expect(playTargetLabel(action)).toBe('Listen');
  });

  it('makes a producer ready to hear in one press', () => {
    expect(
      listenActionState({
        ...idle,
        live: true,
        isPlaying: false,
        linkConnected: true,
        now,
      }),
    ).toBe('ready');
  });

  it('shows Pause and rings only while a consumer is playing', () => {
    const action = listenActionState({
      ...playingIntent,
      live: true,
      isPlaying: true,
      linkConnected: true,
      now,
    });

    expect(action).toBe('playing');
    expect(playTargetLabel(action)).toBe('Pause');
  });

  it('enters a 30 second hold only when a dropped producer interrupts playback', () => {
    const holding = reconcileListenIntent(playingIntent, {
      live: false,
      closeReason: 'dropped',
      linkConnected: true,
      wasPlaying: true,
      now,
    });

    expect(holding).toEqual({ intent: 'holding', holdDeadline: now + HOLD_MS });
    expect(
      listenActionState({
        ...holding,
        live: false,
        isPlaying: false,
        linkConnected: true,
        now,
      }),
    ).toBe('holding');
    expect(playTargetLabel('holding')).toBe('Holding');
  });

  it('does not hold a dropped producer while playback was still starting', () => {
    expect(
      reconcileListenIntent(playingIntent, {
        live: false,
        closeReason: 'dropped',
        linkConnected: true,
        wasPlaying: false,
        now,
      }),
    ).toEqual(idle);
  });

  it('ends deliberate closes immediately', () => {
    expect(
      reconcileListenIntent(playingIntent, {
        live: false,
        closeReason: 'ended',
        linkConnected: true,
        wasPlaying: true,
        now,
      }),
    ).toEqual(idle);
  });

  it('resumes playing when the producer returns before the deadline', () => {
    const holding = { intent: 'holding', holdDeadline: now + HOLD_MS } as const;
    const resumed = reconcileListenIntent(holding, {
      live: true,
      linkConnected: true,
      wasPlaying: false,
      now: now + 12_000,
    });

    expect(resumed).toEqual(playingIntent);
    expect(
      listenActionState({
        ...resumed,
        live: true,
        isPlaying: true,
        linkConnected: true,
        now: now + 12_000,
      }),
    ).toBe('playing');
  });

  it('expires against the stored deadline, not elapsed ticks', () => {
    const holding = { intent: 'holding', holdDeadline: now + HOLD_MS } as const;

    expect(
      reconcileListenIntent(holding, {
        live: false,
        closeReason: 'dropped',
        linkConnected: true,
        wasPlaying: true,
        now: now + HOLD_MS,
      }),
    ).toEqual(idle);
    expect(
      listenActionState({
        ...holding,
        live: false,
        isPlaying: false,
        linkConnected: true,
        now: now + HOLD_MS,
      }),
    ).toBe('unavailable');
  });

  it('ends a hold as soon as the link is not connected', () => {
    expect(
      reconcileListenIntent(
        { intent: 'holding', holdDeadline: now + HOLD_MS },
        {
          live: false,
          closeReason: 'dropped',
          linkConnected: false,
          wasPlaying: true,
          now: now + 1_000,
        },
      ),
    ).toEqual(idle);
  });

  it('never shows a holding spinner without a future deadline', () => {
    expect(
      listenActionState({
        intent: 'holding',
        holdDeadline: null,
        live: false,
        isPlaying: false,
        linkConnected: true,
        now,
      }),
    ).toBe('unavailable');
  });

  it('rings only while samples are moving', () => {
    expect(showsRings('playing')).toBe(true);
    expect(showsRings('waiting')).toBe(false);
    expect(showsRings('idle')).toBe(false);
    expect(showsRings('media-trouble')).toBe(false);
  });

  it('says audio resumes by itself while the interpreter is away', () => {
    const note = statusNote('interpreter-away') ?? '';

    expect(note).toMatch(/by itself/i);
    expect(note).toMatch(/interpreter/i);
  });

  it('shows the offline message only once armed', () => {
    expect(statusNote('idle')).not.toMatch(/dropped off/i);
    expect(statusNote('interpreter-away')).toMatch(/dropped off/i);
  });

  it('keeps media trouble about the audio, not about the interpreter being absent', () => {
    const note = statusNote('media-trouble') ?? '';

    expect(note).toMatch(/still on air/i);
    expect(note).not.toMatch(/dropped off/i);
  });

  it('gives every state something to say', () => {
    for (const state of [
      'idle',
      'waiting',
      'playing',
      'muted',
      'syncing',
      'interpreter-away',
      'reconnecting',
      'media-trouble',
      'ended',
    ] as const) {
      expect(statusNote(state)).toBeTruthy();
    }
  });
});

describe('badgeLabel', () => {
  it('reads as terminal for a session the server ended', () => {
    expect(badgeLabel('ended')).toBe('Disconnected');
  });

  it('says the interpreter is on air once armed and waiting for the first samples', () => {
    expect(badgeLabel('waiting')).toBe('Interpreter on air');
    expect(badgeLabel('playing')).toBe('Listening');
  });

  it('reads the same before arming and after the interpreter drops', () => {
    expect(badgeLabel('idle')).toBe(badgeLabel('interpreter-away'));
  });

  it('keeps media trouble apart from losing the socket', () => {
    expect(badgeLabel('media-trouble')).not.toBe(badgeLabel('reconnecting'));
  });

  it('derives from the one state, so it cannot drift from the rest of the screen', () => {
    for (const state of ALL_STATES) {
      expect(badgeLabel(state)).toBeTruthy();
    }
  });
});

/**
 * A revoked or ended session is disconnected by the server and Socket.IO does not retry
 * it. Read as an ordinary blip, the screen promised a recovery that never came.
 */
describe('a session the server ended', () => {
  it('is terminal whether or not the guest ever armed', () => {
    expect(listenState({ ...playing, terminal: true })).toBe('ended');
    expect(listenState({ ...playing, terminal: true, armed: false })).toBe('ended');
  });

  it('outranks every other state, including media trouble', () => {
    expect(listenState({ ...playing, terminal: true, mediaTrouble: true })).toBe('ended');
  });

  it('does not tell the guest it picks itself back up', () => {
    const note = statusNote('ended') ?? '';

    expect(note).not.toMatch(/picks itself|by itself|resumes/i);
    expect(note).toMatch(/organiser/i);
  });
});
