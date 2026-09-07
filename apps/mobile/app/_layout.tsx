import { SpaceGrotesk_600SemiBold, useFonts } from '@expo-google-fonts/space-grotesk';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { shouldRetryApiQuery } from '@/lib/query-retry';
import { ThemeProvider, useTheme } from '@/theme/provider';
import { radius } from '@/theme/tokens';
import { DISPLAY_FONT } from '@/theme/typography';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden, which is not a failure worth showing a listener.
});

// Retry transport and server failures, never a domain refusal the same request cannot fix.
// The server meters failed public lookups per address and a room of guests shares one NAT,
// so retrying a 404 spends a token to learn what the first answer already said.
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: shouldRetryApiQuery } },
});

export const unstable_settings = { initialRouteName: 'index' };

/**
 * Android caps a form sheet at three detents and renders neither a header nor a nested stack
 * inside one, so every sheet owns its title and its dismiss control as content.
 */
const SHEET = {
  presentation: 'formSheet',
  sheetAllowedDetents: [0.5, 0.92],
  sheetGrabberVisible: true,
  sheetCornerRadius: radius.xl,
  headerShown: false,
} satisfies Parameters<typeof Stack.Screen>[0]['options'];

function Navigator() {
  const { scheme, colors } = useTheme();

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerTintColor: colors.primary,
          headerLargeTitleStyle: { fontFamily: DISPLAY_FONT, color: colors.foreground },
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors.foreground },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="scan" options={{ headerShown: false }} />
        <Stack.Screen name="link" options={SHEET} />
        <Stack.Screen
          name="events/[host]/[pin]/index"
          options={{ headerLargeTitle: true, title: '' }}
        />
        <Stack.Screen name="events/[host]/[pin]/[slug]" options={{ title: '' }} />
        <Stack.Screen name="events/[host]/[pin]/[slug]/audio" options={SHEET} />
        <Stack.Screen name="events/[host]/[pin]/[slug]/report" options={SHEET} />
      </Stack>
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <Navigator />
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
