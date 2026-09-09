import type { ConfigContext, ExpoConfig } from 'expo/config';
import mobileManifest from './package.json';

/** Store-facing version comes from same manifest as runtime compatibility handshake. */
export default ({ config }: ConfigContext): ExpoConfig =>
  ({ ...config, version: mobileManifest.version }) as ExpoConfig;
