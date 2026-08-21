/**
 * What the listener screen is doing, kept out of the component so it can be tested without
 * a browser.
 *
 * Armed is the guest's one deliberate gesture and survives everything after it — the
 * interpreter dropping, a channel switch, a server restart. Playing does not.
 */
export type ListenState =
  | 'idle'
  | 'waiting'
  | 'playing'
  | 'interpreter-away'
  | 'reconnecting'
  | 'media-trouble'
  | 'ended';

export interface ListenInput {
  /** The server ended this session; Socket.IO will not retry it. */
  terminal?: boolean;
  armed: boolean;
  /** A resumed consumer exists, not that the button was tapped. */
  isPlaying: boolean;
  /** A producer exists on this channel. */
  live: boolean;
  socketConnected: boolean;
  mediaTrouble: boolean;
}

/**
 * The three-way distinction R32 needs. Losing the socket, the media path failing under a
 * healthy socket, and nobody being live are different situations and read differently:
 * only one of them is about a person, and none of them asks the guest to do anything.
 */
export function listenState(input: ListenInput): ListenState {
  // Above `armed`: a session the server ended is over whether or not the guest armed.
  if (input.terminal) return 'ended';
  if (!input.armed) return 'idle';
  if (!input.socketConnected) return 'reconnecting';
  if (input.mediaTrouble) return 'media-trouble';
  if (!input.live) return 'interpreter-away';
  return input.isPlaying ? 'playing' : 'waiting';
}

/**
 * Not-yet-armed, armed-and-waiting and playing are three rendered states, not two. Without
 * the middle one the control looks identical before and after the tap, which invites a
 * second press that does nothing.
 */
export function playTargetLabel(state: ListenState): string {
  switch (state) {
    case 'idle':
      return 'Tap to listen';
    case 'playing':
      return 'Pause';
    case 'media-trouble':
      return 'Reconnecting';
    case 'ended':
      return 'Ended';
    default:
      return 'Waiting…';
  }
}

/**
 * The badge above the channel name. Takes the socket status as well, because a handshake
 * rejection is terminal — socket.io does not retry it — and that is the one distinction
 * `listenState` folds away, having no consequence for what the media layer should do.
 */
export function badgeLabel(state: ListenState): string {
  switch (state) {
    case 'ended':
      return 'Disconnected';
    case 'reconnecting':
      return 'Reconnecting…';
    case 'idle':
    case 'interpreter-away':
      return 'Waiting for the interpreter';
    case 'media-trouble':
      return 'Reconnecting the audio';
    case 'waiting':
      return 'Interpreter on air';
    case 'playing':
      return 'Listening';
  }
}

/** Rings mean samples are moving, so only one state earns them. */
export function showsRings(state: ListenState): boolean {
  return state === 'playing';
}

/**
 * Says what is happening and who is fixing it. The guest can do nothing about any of
 * these, so alarm is the one register the copy has to avoid — and media trouble reads as
 * the audio reconnecting while the interpreter is still there, not as their absence.
 */
export function statusNote(state: ListenState): string | null {
  switch (state) {
    case 'idle':
      return 'This channel starts on its own as soon as its interpreter connects.';
    case 'waiting':
      return 'Waiting for the interpreter. Audio starts by itself — you can put your phone away.';
    case 'interpreter-away':
      return 'The interpreter has dropped off. Audio resumes by itself when they are back.';
    case 'media-trouble':
      return 'The audio connection is re-establishing. The interpreter is still on air.';
    case 'reconnecting':
      return 'Reconnecting. Nothing to do — this picks itself back up.';
    case 'playing':
      return 'Headphones recommended, so the room stays quiet for everyone else.';
    case 'ended':
      return 'This session has ended. The event may be over, or its PIN may have changed — ask the organiser for the current link.';
  }
}
