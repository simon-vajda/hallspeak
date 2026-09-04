import { useEffect, useReducer, useRef } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { addVenueReducer, addVenueView, INITIAL_ADD_VENUE_STATE } from '@/venues/add-venue-state';
import { openEvent } from '@/venues/client';
import type { Venue } from '@/venues/types';

const TITLE = 'Enter the link';
const HELP = 'The link printed at your venue, starting with https.';
const PLACEHOLDER = 'https://…/events/000000';

export type LinkEntrySheetProps = {
  onClose: () => void;
  onOpened: (venue: Venue) => void;
};

/**
 * One surface behind two triggers: the home screen's paste action and the scanner's fallback
 * are entry points to it rather than two implementations of the same job.
 *
 * Mounted only while it is open, so a second visit starts from an empty field rather than the
 * outcome of the last one.
 */
export function LinkEntrySheet({ onClose, onOpened }: LinkEntrySheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [state, dispatch] = useReducer(addVenueReducer, INITIAL_ADD_VENUE_STATE);
  const view = addVenueView(state);
  const input = useRef('');

  const pending = state.pending;
  useEffect(() => {
    if (pending === null) {
      return;
    }
    let cancelled = false;
    void openEvent(pending.host, pending.pin).then((lookup) => {
      if (!cancelled) {
        dispatch({ kind: 'resolved', lookup });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pending]);

  const opened = view.openEvent;
  useEffect(() => {
    if (opened !== null) {
      onOpened(opened);
    }
  }, [opened, onOpened]);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="Close" style={styles.dismissArea} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: theme.colors.secondary,
                paddingBottom: insets.bottom + spacing.panel,
              },
            ]}
          >
            <View style={[styles.grabber, { backgroundColor: theme.colors.border }]} />
            <Text variant="title" style={styles.title}>
              {TITLE}
            </Text>

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.background,
                  borderColor: view.error === null ? theme.colors.input : theme.colors.destructive,
                  color: theme.colors.foreground,
                },
              ]}
              placeholder={PLACEHOLDER}
              placeholderTextColor={theme.colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              inputMode="url"
              returnKeyType="go"
              editable={!view.busy}
              onChangeText={(value) => {
                input.current = value;
              }}
              onSubmitEditing={() => dispatch({ kind: 'submit', input: input.current })}
            />

            <Text
              variant="note"
              color={view.error === null ? 'mutedForeground' : 'destructive'}
              style={styles.help}
            >
              {view.error ?? HELP}
            </Text>

            <Pressable
              accessibilityRole="button"
              disabled={view.busy}
              onPress={() => dispatch({ kind: 'submit', input: input.current })}
              style={({ pressed }) => [
                styles.submit,
                { backgroundColor: pressed ? theme.colors.primaryHover : theme.colors.primary },
                view.busy ? styles.busy : null,
              ]}
            >
              <Icon name="link" size={19} color="primaryForeground" />
              <Text variant="section" color="primaryForeground">
                {view.busy ? 'Opening…' : 'Open event'}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.step * 3,
    paddingHorizontal: spacing.panel,
    gap: spacing.step * 3,
  },
  grabber: {
    alignSelf: 'center',
    width: spacing.step * 8,
    height: spacing.step,
    borderRadius: radius.full,
  },
  title: {
    marginTop: spacing.step,
  },
  input: {
    height: spacing.pill,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.panel,
    fontSize: 16,
  },
  help: {
    paddingHorizontal: spacing.step,
  },
  submit: {
    height: spacing.pill,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.step * 2.5,
  },
  busy: {
    opacity: 0.6,
  },
});
