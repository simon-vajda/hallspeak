/** Maps the handshake gate's connect_error to user-facing copy. Never an HTTP 404. */
export function socketMessage(code: string): string {
  if (code === 'channel_busy') {
    return 'Someone is already speaking on this channel.';
  }
  if (code === 'web_version_mismatch') {
    return 'This page is out of date. Reload it.';
  }
  if (code === 'mobile_version_too_old') {
    return 'This app version is no longer supported. Update LinguaCast.';
  }
  return `Connection failed: ${code}`;
}
