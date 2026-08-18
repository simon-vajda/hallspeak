import { describe, expect, it } from 'vitest';
import {
  badgeLabel,
  type ListenInput,
  listenState,
  playTargetLabel,
  showsRings,
  statusNote,
} from './listen-state';

const playing: ListenInput = {
  armed: true,
  isPlaying: true,
  live: true,
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

  it('stays armed and reads as the interpreter being away when they drop', () => {
    expect(listenState({ ...playing, live: false, isPlaying: false })).toBe('interpreter-away');
  });

  it('tells media trouble apart from the interpreter being away', () => {
    const trouble = listenState({ ...playing, mediaTrouble: true });

    expect(trouble).toBe('media-trouble');
    expect(trouble).not.toBe(listenState({ ...playing, live: false }));
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

describe('the three rendered states', () => {
  it('gives not-yet-armed, armed-and-waiting and playing distinct labels', () => {
    const labels = [
      playTargetLabel(listenState({ ...playing, armed: false })),
      playTargetLabel(listenState({ ...playing, isPlaying: false })),
      playTargetLabel(listenState(playing)),
    ];

    expect(new Set(labels).size).toBe(3);
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
      'interpreter-away',
      'reconnecting',
      'media-trouble',
    ] as const) {
      expect(statusNote(state)).toBeTruthy();
    }
  });
});

describe('badgeLabel', () => {
  it('reads as terminal for a handshake rejection, which socket.io does not retry', () => {
    expect(badgeLabel('reconnecting', true)).toBe('Disconnected');
    expect(badgeLabel('playing', true)).toBe('Disconnected');
  });

  it('says the interpreter is on air once armed and waiting for the first samples', () => {
    expect(badgeLabel('waiting', false)).toBe('Interpreter on air');
    expect(badgeLabel('playing', false)).toBe('Listening');
  });

  it('reads the same before arming and after the interpreter drops', () => {
    expect(badgeLabel('idle', false)).toBe(badgeLabel('interpreter-away', false));
  });

  it('keeps media trouble apart from losing the socket', () => {
    expect(badgeLabel('media-trouble', false)).not.toBe(badgeLabel('reconnecting', false));
  });

  it('derives from the one state, so it cannot drift from the rest of the screen', () => {
    for (const state of [
      'idle',
      'waiting',
      'playing',
      'interpreter-away',
      'reconnecting',
      'media-trouble',
    ] as const) {
      expect(badgeLabel(state, false)).toBeTruthy();
    }
  });
});
