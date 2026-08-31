import { describe, expect, it } from 'vitest';
import {
  badgeHasLiveDot,
  badgeLabel,
  HOLD_MS,
  listenActionState,
  listenerMediaPlayAction,
  playTargetLabel,
  reconcileListenIntent,
  statusNote,
} from './listen-state';

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

  it('keeps the intent across a dropped link so audio resumes without a second tap', () => {
    const holding = { intent: 'holding', holdDeadline: now + HOLD_MS } as const;

    expect(
      reconcileListenIntent(holding, {
        live: false,
        closeReason: 'dropped',
        linkConnected: false,
        wasPlaying: true,
        now: now + 1_000,
      }),
    ).toEqual(holding);
    expect(
      reconcileListenIntent(playingIntent, {
        live: true,
        linkConnected: false,
        wasPlaying: true,
        now: now + 1_000,
      }),
    ).toEqual(playingIntent);
  });

  it('drops the intent across a link outage only when the broadcast was ended', () => {
    expect(
      reconcileListenIntent(playingIntent, {
        live: false,
        closeReason: 'ended',
        linkConnected: false,
        wasPlaying: true,
        now: now + 1_000,
      }),
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
});

describe('listener Media Session actions', () => {
  it('starts an available channel that has no Consumer', () => {
    expect(listenerMediaPlayAction('ready', true)).toBe('start');
  });

  it('resumes an existing Consumer after a platform interruption', () => {
    expect(listenerMediaPlayAction('playing', true)).toBe('resume');
  });

  it('ignores redundant and unavailable Play actions', () => {
    expect(listenerMediaPlayAction('playing', false)).toBe('ignore');
    expect(listenerMediaPlayAction('holding', true)).toBe('ignore');
    expect(listenerMediaPlayAction('unavailable', true)).toBe('ignore');
  });
});

describe('listener broadcast badge', () => {
  const offline = { live: false, muted: false, holding: false, linkConnected: true } as const;

  it('uses exactly four labels with dot ownership matching producer presence', () => {
    const inputs = [
      offline,
      { ...offline, live: true },
      { ...offline, live: true, muted: true },
      { ...offline, holding: true },
    ];

    expect(inputs.map(badgeLabel)).toEqual(['Offline', 'On air', 'Muted', 'Speaker dropped off']);
    expect(inputs.map(badgeHasLiveDot)).toEqual([false, true, true, false]);
  });

  it('forces Offline before consulting stale broadcast or hold state when the link is down', () => {
    const staleLive = { ...offline, live: true, muted: true, linkConnected: false };
    const staleHold = { ...offline, holding: true, linkConnected: false };

    expect(badgeLabel(staleLive)).toBe('Offline');
    expect(badgeHasLiveDot(staleLive)).toBe(false);
    expect(badgeLabel(staleHold)).toBe('Offline');
  });

  it('never returns a fifth label for any input combination', () => {
    const labels = new Set<string>();
    for (const live of [false, true]) {
      for (const muted of [false, true, null]) {
        for (const holding of [false, true]) {
          for (const linkConnected of [false, true]) {
            labels.add(badgeLabel({ live, muted, holding, linkConnected }));
          }
        }
      }
    }

    expect(labels).toEqual(new Set(['Offline', 'On air', 'Muted', 'Speaker dropped off']));
  });
});

describe('listener status note', () => {
  const offline = {
    live: false,
    muted: false,
    holding: false,
    linkConnected: true,
    isPlaying: false,
  } as const;

  it('uses the brief copy for each reachable state', () => {
    expect(statusNote(offline)).toBeNull();
    expect(statusNote({ ...offline, holding: true })).toBe(
      'Audio resumes by itself if they are straight back.',
    );
    expect(statusNote({ ...offline, closeReason: 'dropped' })).toBe(
      'This channel starts on its own as soon as its interpreter is back.',
    );
    expect(statusNote({ ...offline, live: true, muted: true })).toBe(
      'The interpreter is muted. Audio resumes automatically when they unmute.',
    );
    expect(statusNote({ ...offline, linkConnected: false })).toBe(
      'Nothing to do — this picks itself back up.',
    );
    expect(statusNote({ ...offline, live: true, isPlaying: true })).toBe(
      'Headphones recommended, so the room stays quiet for everyone else.',
    );
  });

  it('makes no playback claim while no producer exists', () => {
    for (const input of [
      offline,
      { ...offline, holding: true },
      { ...offline, closeReason: 'dropped' as const },
      { ...offline, linkConnected: false },
    ]) {
      expect(statusNote(input) ?? '').not.toMatch(
        /hearing|listening|audio is (playing|moving|reaching)/i,
      );
    }
  });
});
