/**
 * What the Audio sheet's Output row says. Neither platform offers an app a general
 * enumerable list of outputs — iOS routes through its own picker and Android through the
 * output switcher on the media session this app owns — so the row names where the audio is
 * going and opens the platform's own chooser rather than drawing a list of its own.
 */
export const OUTPUT_UNKNOWN_LABEL = 'Output';

/**
 * The label for a route the platform reported, or the withheld one. The same discipline as
 * the channel badge: a name nobody gave is not printed as a name, and the row's slot stays
 * either way so a headset being unplugged is not a re-layout.
 */
export function outputLabel(route: string | null | undefined): string {
  if (typeof route !== 'string') {
    return OUTPUT_UNKNOWN_LABEL;
  }

  const trimmed = route.trim();

  return trimmed === '' ? OUTPUT_UNKNOWN_LABEL : trimmed;
}

/** True when the platform actually named the output, which is what the row can claim. */
export function hasNamedOutput(route: string | null | undefined): boolean {
  return typeof route === 'string' && route.trim() !== '';
}

/**
 * The Channel screen's audio action, which carries both facts in one line. The volume is
 * always known; the route may not be, and the label says only what it has.
 */
export function audioActionDetail(input: {
  route: string | null | undefined;
  volumeLabel: string;
}): string {
  return hasNamedOutput(input.route)
    ? `${outputLabel(input.route)} · ${input.volumeLabel}`
    : input.volumeLabel;
}
