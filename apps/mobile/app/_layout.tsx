import { SpaceGrotesk_600SemiBold, useFonts } from '@expo-google-fonts/space-grotesk';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ThemeProvider, useTheme } from '@/theme/provider';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden, which is not a failure worth surfacing to a listener.
});

function Navigator() {
  const { scheme, colors } = useTheme();

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </>
  );
}

export default function RootLayout() {
  // React Native resolves an unregistered family by falling back rather than erroring, so an
  // unloaded face is silent. Holding the splash screen is what makes it observable.
  const [fontsLoaded] = useFonts({ SpaceGrotesk_600SemiBold });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider>
      <Navigator />
    </ThemeProvider>
  );
}
