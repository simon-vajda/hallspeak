export const APP_NOTICE_KEY = 'linguacast-app-notice';

export function appListenerLink(channelUrl: string): string {
  return `https://open.linguacast.app/?url=${encodeURIComponent(channelUrl)}`;
}

export function hasAnsweredAppNotice(): boolean {
  try {
    return localStorage.getItem(APP_NOTICE_KEY) !== null;
  } catch {
    return false;
  }
}

export function answerAppNotice(answer: 'not-now' | 'listen'): void {
  try {
    localStorage.setItem(APP_NOTICE_KEY, answer);
  } catch {
    // Storage may be blocked. The mounted notice still closes normally.
  }
}
