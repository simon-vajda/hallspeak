import type { ConfigContext, ExpoConfig } from 'expo/config';
import mobileManifest from './package.json';

/** Store-facing version comes from same manifest as runtime compatibility handshake. */
export default ({ config }: ConfigContext): ExpoConfig => {
  const base = { ...config, version: mobileManifest.version } as ExpoConfig;
  if (process.env.APP_VARIANT !== 'development') {
    return base;
  }

  // The development client installs beside the store app, so it claims none of its identity,
  // including the universal link, which only the store bundle id is listed for.
  const { associatedDomains: _domains, ...ios } = base.ios ?? {};
  const { intentFilters: _filters, ...android } = base.android ?? {};
  return {
    ...base,
    name: 'Hallspeak Dev',
    scheme: 'hallspeak-dev',
    ios: { ...ios, bundleIdentifier: 'app.hallspeak.mobile.dev' },
    android: { ...android, package: 'app.hallspeak.mobile.dev' },
  };
};
