import {
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  useFonts,
} from '@expo-google-fonts/space-grotesk';
import { shouldRetryApiQuery } from '@hallspeak/client-core/query-retry';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { registerGlobals } from 'react-native-webrtc';
import { DIALOG_OPTIONS, FULL_SCREEN_DIALOG_OPTIONS } from '@/components/dialog-options';
import { SHEET_OPTIONS } from '@/components/sheet-options';
import { ThemeProvider, useTheme } from '@/theme/provider';

// Before anything can construct a mediasoup device: it reads the WebRTC constructors off
// the global object, and a device built before this call would find none of them.
registerGlobals();

SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden, which is not a failure worth showing a listener.
});

// Retry transport and server failures, never a domain refusal the same request cannot fix.
// The server meters failed public lookups per address and a room of guests shares one NAT,
// so retrying a 404 spends a token to learn what the first answer already said.
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: shouldRetryApiQuery } },
});

// Full height only on iOS: held up to be scanned, a half-height detent shrank the code and a drag
// between detents could shrink it mid-scan.
const SHARE_OPTIONS =
  Platform.OS === 'android'
    ? FULL_SCREEN_DIALOG_OPTIONS
    : { ...SHEET_OPTIONS, sheetAllowedDetents: [1] };

export const unstable_settings = { initialRouteName: 'index' };

function Navigator() {
  const { scheme, colors } = useTheme();

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          // Every screen draws its own header as content, so the navigator supplies none.
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="link" options={SHEET_OPTIONS} />
        <Stack.Screen name="appearance" options={DIALOG_OPTIONS} />
        <Stack.Screen name="speaker-link" options={SHEET_OPTIONS} />
        <Stack.Screen name="share-event" options={SHARE_OPTIONS} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  // React Native resolves an unregistered family by falling back rather than erroring, so an
  // unloaded face is silent. Holding the splash screen is what makes it observable.
  const [fontsLoaded] = useFonts({ SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold });

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
