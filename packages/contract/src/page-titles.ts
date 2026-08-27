export const DEFAULT_PAGE_TITLE = 'LinguaCast';

export function formatEventPageTitle(eventName: string): string {
  return `${eventName} | ${DEFAULT_PAGE_TITLE}`;
}

export function formatChannelPageTitle(eventName: string, channelName: string): string {
  return `${eventName} - ${channelName} | ${DEFAULT_PAGE_TITLE}`;
}
