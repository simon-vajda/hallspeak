import { Redirect } from 'expo-router';

/**
 * iOS chooses appearance from native menus (Home's appearance control and the header menu), so
 * this route exists only as the fallback `appearance.android.tsx` requires.
 */
export default function AppearanceRoute() {
  return <Redirect href="/" />;
}
