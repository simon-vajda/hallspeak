/** The event, never a channel: a newcomer who scans it picks their own language. */
export function listenerEventUrl(origin: string, pin: string): string {
  return `${origin}/events/${pin}`;
}
