export type SpeakerLinkCopy = {
  title: string;
  body: string;
  openAction: string;
  listenAction: string;
  openFailed: string;
  refusedTitle: string;
  refusedBody: string;
};

/**
 * The copy takes the host and nothing else. The speaker code is a broadcasting credential, and a
 * string that cannot receive it cannot display or leak it.
 */
export function speakerLinkCopy(host: string): SpeakerLinkCopy {
  return {
    title: 'Speaker link',
    body: `This app is for listening. The speaker studio opens in your browser, at ${host}.`,
    openAction: 'Open in browser',
    listenAction: 'Listen to this channel',
    openFailed: 'The browser didn’t open. Open the speaker link in a browser yourself.',
    refusedTitle: 'Speaker link',
    refusedBody: 'This link can’t be opened. Ask the event organiser for a new one.',
  };
}

export function allSpeakerLinkCopy(host: string): string[] {
  return Object.values(speakerLinkCopy(host));
}
