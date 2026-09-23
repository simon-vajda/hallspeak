import {
  assessServerCompatibility,
  type ServerCompatibility,
  type ServerVersionInfo,
} from '@hallspeak/client-core/server';

export type ServerCheck =
  | { state: 'checking' }
  | { state: 'ready' }
  | { state: 'blocked'; title: string; body: string; retryable: boolean };

/**
 * Every string this gate can render. Enumerated so the forbidden-claim test can read them
 * without rendering a screen, on the same terms as the other guest copy modules.
 */
export const ALL_SERVER_CHECK_COPY: readonly string[] = [
  'This server could not be reached',
  'Check your connection, then open the event again.',
  'Hallspeak needs an update',
  'Install the latest app version, then open this event again.',
  'This server needs an update',
  'Ask the organiser to update Hallspeak before opening this event.',
  'This server is not compatible',
  'The server returned an invalid version. Ask the organiser to check the installation.',
];

function blocked(compatibility: Exclude<ServerCompatibility, 'supported'>): ServerCheck {
  // A server from the future and an app below the server's floor are one instruction to the
  // guest: the half they control is the app.
  if (compatibility === 'mobile-too-old' || compatibility === 'server-too-new') {
    return {
      state: 'blocked',
      title: 'Hallspeak needs an update',
      body: 'Install the latest app version, then open this event again.',
      retryable: false,
    };
  }

  if (compatibility === 'server-too-old') {
    return {
      state: 'blocked',
      title: 'This server needs an update',
      body: 'Ask the organiser to update Hallspeak before opening this event.',
      retryable: false,
    };
  }

  return {
    state: 'blocked',
    title: 'This server is not compatible',
    body: 'The server returned an invalid version. Ask the organiser to check the installation.',
    retryable: false,
  };
}

/**
 * A verdict is taken only from an answer this app has actually read. A refetch that fails
 * over a server already found compatible has established nothing, so it leaves the event
 * connected rather than tearing it down; only a first read that never landed blocks.
 */
export function serverCheck(input: {
  info: ServerVersionInfo | undefined;
  failed: boolean;
  mobileVersion: string;
}): ServerCheck {
  if (input.info === undefined) {
    if (!input.failed) {
      return { state: 'checking' };
    }

    return {
      state: 'blocked',
      title: 'This server could not be reached',
      body: 'Check your connection, then open the event again.',
      retryable: true,
    };
  }

  const compatibility = assessServerCompatibility(input.info, input.mobileVersion);

  return compatibility === 'supported' ? { state: 'ready' } : blocked(compatibility);
}
