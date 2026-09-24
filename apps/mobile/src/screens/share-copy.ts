export const SHARE_COPY = {
  menuLabel: 'More options',
  menuShare: 'Share event',
  menuAppearance: 'Appearance',
  title: 'Share event',
  pinLabel: 'Listener PIN',
  copyAction: 'Copy link',
  copied: 'Copied',
  copyFailed: 'The link couldn’t be copied. Share the PIN instead.',
  refusedBody: 'This event can’t be shared from here. Open it again and try once more.',
} as const;

/** Grouped as the web prints it, and spelled digit by digit for a screen reader. */
export function pinDisplay(pin: string) {
  return { text: `${pin.slice(0, 3)} ${pin.slice(3)}`, spoken: pin.split('').join(' ') };
}

export function shareQrLabel(url: string): string {
  return `QR code linking to ${url}`;
}

export function allShareCopy(url: string): string[] {
  return [...Object.values(SHARE_COPY), shareQrLabel(url)];
}
