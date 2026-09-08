/** Maps the handshake gate's connect_error to user-facing copy. Never an HTTP 404. */
export function socketMessage(code: string): string {
  if (code === 'channel_busy') {
    return 'Someone is already speaking on this channel.';
  }
  if (code === 'client_too_old') {
    return 'This page is out of date. Reload it.';
  }
  return `Connection failed: ${code}`;
}
