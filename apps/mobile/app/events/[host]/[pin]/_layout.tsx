import { Stack, useLocalSearchParams } from 'expo-router';
import { SHEET_OPTIONS } from '@/components/sheet-options';
import { readEventParams } from '@/links/route';
import { EventSocketProvider } from '@/socket/provider';
import { useColors } from '@/theme/provider';

/**
 * Declared here as well as at the root: the root's setting applies to the root stack alone,
 * so a deep link straight to a channel would otherwise leave no Event screen underneath and
 * the Channel screen's back control nothing to return to.
 */
export const unstable_settings = { initialRouteName: 'index' };

/** Owns the event's one socket, so both screens and both sheets read the same connection. */
export default function EventLayout() {
  const colors = useColors();
  const params = useLocalSearchParams<{ host: string; pin: string }>();
  const route = readEventParams(params.host, params.pin);

  return (
    <EventSocketProvider host={route?.host ?? ''} pin={route?.pin ?? ''}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {/*
          Declared in the order the guest meets them, and the sheet last. Expo Router hands
          React Navigation its explicitly declared screens before the rest, and this
          navigator is given no initial route name of its own — so a sheet declared first
          becomes the route the stack starts on, and opening an event lands on the report
          sheet drawn as a full screen.
        */}
        <Stack.Screen name="index" />
        <Stack.Screen name="[slug]" />
        <Stack.Screen name="[slug]/report" options={SHEET_OPTIONS} />
      </Stack>
    </EventSocketProvider>
  );
}
