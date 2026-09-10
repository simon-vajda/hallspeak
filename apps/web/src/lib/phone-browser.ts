/** Phone browsers only: a narrow desktop window or an Android tablet is not a phone. */
export function isPhoneBrowser(userAgent: string): boolean {
  return (
    /iPhone|iPod|Windows Phone/i.test(userAgent) ||
    (/Android/i.test(userAgent) && /Mobile/i.test(userAgent))
  );
}

/**
 * Phones and tablets. iPadOS reports a desktop Safari user agent, so the touch count is
 * the only thing separating an iPad from the Mac it claims to be.
 */
export function isHandheldBrowser(userAgent: string, maxTouchPoints: number): boolean {
  return (
    isPhoneBrowser(userAgent) ||
    /iPad|Android|Windows Phone/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)
  );
}
