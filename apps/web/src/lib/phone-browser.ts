/** Phone browsers only: a narrow desktop window or an Android tablet is not a phone. */
export function isPhoneBrowser(userAgent: string): boolean {
  return (
    /iPhone|iPod|Windows Phone/i.test(userAgent) ||
    (/Android/i.test(userAgent) && /Mobile/i.test(userAgent))
  );
}
