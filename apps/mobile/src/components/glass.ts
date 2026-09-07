import { Platform } from 'react-native';

export type GlassMode = 'glass' | 'fallback';

/**
 * Liquid glass is progressive enhancement, never a requirement. Some iOS 26 builds shipped
 * without the API and crash on use, so the runtime check decides rather than the version;
 * Android never gets glass at all, because Material's answer is tonal elevation and a blur
 * over a large surface costs real frames on mid-range hardware.
 */
export function glassMode(available: boolean, os: string = Platform.OS): GlassMode {
  return os === 'ios' && available ? 'glass' : 'fallback';
}
