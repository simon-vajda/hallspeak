export const DEFAULT_PAGE_TITLE = 'Hallspeak';

export function formatNotFoundPageTitle(): string {
  return `Page not found | ${DEFAULT_PAGE_TITLE}`;
}

export function formatEventPageTitle(eventName: string): string {
  return `${eventName} | ${DEFAULT_PAGE_TITLE}`;
}

export function formatChannelPageTitle(eventName: string, channelName: string): string {
  return `${eventName} - ${channelName} | ${DEFAULT_PAGE_TITLE}`;
}
