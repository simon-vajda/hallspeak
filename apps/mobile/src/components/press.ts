import { Platform } from 'react-native';

/**
 * Material's press feedback is a ripple that starts where the finger landed, and it is what
 * an Android control is expected to do. `foreground` draws it over the row's own fill rather
 * than under it, so a filled surface does not swallow it.
 */
export function ripple(color: string, borderless = false, os: string = Platform.OS) {
  return os === 'android' ? { color, borderless, foreground: true } : undefined;
}

/**
 * The dim iOS presses with. Android returns nothing to dim, because a ripple already reports
 * the press and the two together read as a control fading out under the finger.
 */
export function pressOpacity(pressed: boolean, dimmed = 0.9, os: string = Platform.OS): number {
  return os === 'android' || !pressed ? 1 : dimmed;
}
