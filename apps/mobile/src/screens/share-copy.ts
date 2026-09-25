export const SHARE_COPY = {
  menuLabel: 'More options',
  menuShare: 'Share event',
  menuAppearance: 'Appearance',
  title: 'Share event',
  copyAction: 'Copy link',
  copied: 'Copied',
  copyFailed: 'The link couldn’t be copied. Try again.',
  refusedBody: 'This event can’t be shared from here. Open it again and try once more.',
} as const;

export function shareQrLabel(url: string): string {
  return `QR code linking to ${url}`;
}

export function allShareCopy(url: string): string[] {
  return [...Object.values(SHARE_COPY), shareQrLabel(url)];
}
